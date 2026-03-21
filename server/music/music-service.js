const Replicate = require('replicate');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { analyzeEmotionalTimeline, buildMusicPrompt, CHUNK_DURATION } = require('./emotion-analysis');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const DEMUCS_MODEL = process.env.DEMUCS_MODEL || 'htdemucs';
const MUSIC_TEMP_DIR = path.join(process.cwd(), 'temp', 'music');

function ensureTempDir() {
  if (!fs.existsSync(MUSIC_TEMP_DIR)) {
    fs.mkdirSync(MUSIC_TEMP_DIR, { recursive: true });
  }
}

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      reject(err);
    });
  });
}

async function generateMusic(prompt, durationSeconds) {
  console.log('🎵 Generating music with MusicGen...');
  console.log(`Prompt: ${prompt.substring(0, 150)}...`);
  console.log(`Duration: ${durationSeconds}s`);

  try {
    const output = await replicate.run(
      'meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb',
      {
        input: {
          prompt: prompt,
          duration: Math.min(durationSeconds, 30),
          model_version: 'stereo-large',
          output_format: 'wav',
          normalization_strategy: 'peak'
        }
      }
    );

    console.log('✅ MusicGen output received');
    
    ensureTempDir();
    const musicPath = path.join(MUSIC_TEMP_DIR, `musicgen_${Date.now()}.wav`);
    
    const musicUrl = typeof output === 'string' ? output : output?.output || output;
    
    if (typeof musicUrl === 'string' && musicUrl.startsWith('http')) {
      await downloadFile(musicUrl, musicPath);
      console.log(`✅ Music downloaded: ${musicPath}`);
      return { success: true, path: musicPath, url: musicUrl };
    }

    if (output && typeof output === 'object' && output.url) {
      await downloadFile(output.url, musicPath);
      return { success: true, path: musicPath, url: output.url };
    }

    console.log('MusicGen output type:', typeof output, JSON.stringify(output).substring(0, 200));
    return { success: false, error: 'Unexpected MusicGen output format' };
    
  } catch (error) {
    console.error('❌ MusicGen failed:', error);
    return { success: false, error: error.message };
  }
}

async function separateInstruments(musicFilePath) {
  console.log(`🎛️ Separating instruments with Demucs (${DEMUCS_MODEL})...`);

  try {
    const musicData = fs.readFileSync(musicFilePath);
    const base64Music = musicData.toString('base64');
    const dataUri = `data:audio/wav;base64,${base64Music}`;

    const output = await replicate.run(
      'ardianfe/demucs-prod:3b8bf0e0aa0acbc689cbee5ba0e1eee3aee86b468b3e30e0d498a26832414a67',
      {
        input: {
          audio: dataUri,
          model: DEMUCS_MODEL,
          stem: 'none',
          shifts: 1,
          overlap: 0.25,
          jobs: 0,
          segment: null,
          split: true
        }
      }
    );

    console.log('✅ Demucs output received');
    
    ensureTempDir();
    const stemDir = path.join(MUSIC_TEMP_DIR, `stems_${Date.now()}`);
    fs.mkdirSync(stemDir, { recursive: true });

    const stems = {};
    const stemNames = DEMUCS_MODEL === 'htdemucs_6s' 
      ? ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other']
      : ['drums', 'bass', 'vocals', 'other'];

    if (typeof output === 'object' && output !== null) {
      for (const [key, url] of Object.entries(output)) {
        if (typeof url === 'string' && url.startsWith('http')) {
          const stemName = key.toLowerCase();
          const stemPath = path.join(stemDir, `${stemName}.wav`);
          await downloadFile(url, stemPath);
          stems[stemName] = stemPath;
          console.log(`✅ Stem downloaded: ${stemName}`);
        }
      }
    }

    if (Object.keys(stems).length === 0) {
      console.warn('⚠️ No stems received, using original music as "other" stem');
      stems.other = musicFilePath;
    }

    return { 
      success: true, 
      stems, 
      model: DEMUCS_MODEL,
      stemCount: Object.keys(stems).length
    };
  } catch (error) {
    console.error('❌ Demucs separation failed:', error);
    return { 
      success: false, 
      error: error.message,
      stems: { other: musicFilePath }
    };
  }
}

async function concatenateChunks(chunkPaths) {
  if (chunkPaths.length === 1) return chunkPaths[0];

  const outputPath = path.join(MUSIC_TEMP_DIR, `music_full_${Date.now()}.wav`);
  const crossfade = 2; // seconds of crossfade between chunks

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    chunkPaths.forEach(p => { cmd = cmd.input(p); });

    if (chunkPaths.length === 2) {
      cmd
        .complexFilter(`[0][1]acrossfade=d=${crossfade}:c1=tri:c2=tri[out]`, 'out')
        .output(outputPath)
        .on('end', () => { console.log(`✅ Concatenated ${chunkPaths.length} chunks`); resolve(outputPath); })
        .on('error', reject)
        .run();
    } else {
      // Chain N-way acrossfade
      const filters = [];
      let lastOut = '[0]';
      for (let i = 1; i < chunkPaths.length; i++) {
        const outLabel = i === chunkPaths.length - 1 ? '[out]' : `[cf${i}]`;
        filters.push(`${lastOut}[${i}]acrossfade=d=${crossfade}:c1=tri:c2=tri${outLabel}`);
        lastOut = outLabel;
      }
      cmd
        .complexFilter(filters, 'out')
        .output(outputPath)
        .on('end', () => { console.log(`✅ Concatenated ${chunkPaths.length} chunks`); resolve(outputPath); })
        .on('error', reject)
        .run();
    }
  });
}

async function generateMusicForVideo(transcriptionSegments, totalDuration, style) {
  console.log('🎶 Starting full music generation pipeline...');
  console.log(`Duration: ${totalDuration}s, Style hint: ${style || 'auto'}`);

  const emotionData = await analyzeEmotionalTimeline(transcriptionSegments, totalDuration);
  if (!emotionData.success) {
    console.warn('⚠️ Emotion analysis had issues, using fallback');
  }

  const { chunkPrompts = [], musicalDNA = {} } = emotionData;
  console.log(`🎵 Musical DNA: ${musicalDNA.basePrompt || '—'}`);
  console.log(`🎵 Generating ${chunkPrompts.length} chunk(s) of ${CHUNK_DURATION}s each`);

  // Generate each chunk sequentially
  const chunkPaths = [];
  for (let i = 0; i < chunkPrompts.length; i++) {
    console.log(`🎵 Chunk ${i + 1}/${chunkPrompts.length}: ${chunkPrompts[i].substring(0, 80)}...`);
    const result = await generateMusic(chunkPrompts[i], CHUNK_DURATION);
    if (!result.success) {
      console.warn(`⚠️ Chunk ${i + 1} failed: ${result.error}`);
      // Try fallback with base DNA prompt
      const fallback = await generateMusic(
        `${musicalDNA.basePrompt || 'gentle piano, C major, 80 BPM'}, begins softly, returns to calm, 30 seconds`,
        CHUNK_DURATION
      );
      if (!fallback.success) {
        return { success: false, error: `Chunk ${i + 1} generation failed: ${result.error}` };
      }
      chunkPaths.push(fallback.path);
    } else {
      chunkPaths.push(result.path);
    }
  }

  // Concatenate all chunks with crossfade
  ensureTempDir();
  let finalMusicPath;
  try {
    finalMusicPath = await concatenateChunks(chunkPaths);
  } catch (concatErr) {
    console.warn('⚠️ Concatenation failed, using first chunk:', concatErr.message);
    finalMusicPath = chunkPaths[0];
  }

  // Clean up intermediate chunk files (keep only the final)
  chunkPaths.forEach(p => {
    if (p !== finalMusicPath) try { fs.unlinkSync(p); } catch (e) {}
  });

  const stemsResult = await separateInstruments(finalMusicPath);

  return {
    success: true,
    musicPath: finalMusicPath,
    musicUrl: null, // caller uploads to Firebase
    stems: stemsResult.stems,
    stemModel: stemsResult.model,
    emotionTimeline: emotionData.timeline,
    musicPrompt: chunkPrompts[0] || '',
    musicalKey: musicalDNA.musicalKey || emotionData.musicalKey,
    bpm: musicalDNA.bpm || emotionData.bpm,
    chunkCount: chunkPaths.length,
  };
}

function cleanupMusicFiles(musicPath, stems) {
  try {
    if (musicPath && fs.existsSync(musicPath)) {
      fs.unlinkSync(musicPath);
    }
    if (stems) {
      for (const stemPath of Object.values(stems)) {
        if (stemPath && fs.existsSync(stemPath)) {
          fs.unlinkSync(stemPath);
        }
      }
      const stemDir = path.dirname(Object.values(stems)[0] || '');
      if (stemDir && fs.existsSync(stemDir)) {
        fs.rmdirSync(stemDir, { recursive: true });
      }
    }
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

module.exports = {
  generateMusic,
  separateInstruments,
  generateMusicForVideo,
  cleanupMusicFiles,
  DEMUCS_MODEL
};
