const Replicate = require('replicate');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const { analyzeEmotionalTimeline, buildMusicPrompt, CHUNK_DURATION } = require('./emotion-analysis');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const DEMUCS_MODEL = process.env.DEMUCS_MODEL || 'htdemucs';
const MUSIC_TEMP_DIR = path.join(os.tmpdir(), 'reflectly-server', 'music');

// Semaphore: limit concurrent Replicate MusicGen calls.
// Free tier: 2-3 safe; paid tier: raise MAX_CONCURRENT_MUSICGEN to 5+
const MAX_CONCURRENT_MUSICGEN = parseInt(process.env.MAX_CONCURRENT_MUSICGEN) || 3;
let _activeReplicate = 0;
const _replicateQueue = [];
function acquireReplicateSlot() {
  return new Promise((resolve) => {
    if (_activeReplicate < MAX_CONCURRENT_MUSICGEN) {
      _activeReplicate++;
      resolve();
    } else {
      _replicateQueue.push(resolve);
    }
  });
}
function releaseReplicateSlot() {
  const next = _replicateQueue.shift();
  if (next) {
    next(); // give slot to next waiter without decrementing
  } else {
    _activeReplicate--;
  }
}

function ensureTempDir() {
  if (!fs.existsSync(MUSIC_TEMP_DIR)) {
    fs.mkdirSync(MUSIC_TEMP_DIR, { recursive: true });
  }
}

async function downloadFile(url, outputPath) {
  // Replicate SDK may return URL objects instead of strings
  const urlStr = typeof url === 'string' ? url : url.toString();
  return new Promise((resolve, reject) => {
    const protocol = urlStr.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);

    protocol.get(urlStr, (response) => {
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

  await acquireReplicateSlot();
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
    
    // Normalize output to a URL string — handles string, URL object, FileOutput, or {output} wrapper
    let musicUrl;
    if (typeof output === 'string') {
      musicUrl = output;
    } else if (output && typeof output.url === 'function') {
      // Replicate SDK v1+ FileOutput
      musicUrl = output.url().toString();
    } else if (output && output.url) {
      musicUrl = output.url.toString();
    } else if (output && output.output) {
      musicUrl = output.output.toString();
    }

    if (musicUrl && musicUrl.startsWith('http')) {
      await downloadFile(musicUrl, musicPath);
      console.log(`✅ Music downloaded: ${musicPath}`);
      releaseReplicateSlot();
      return { success: true, path: musicPath, url: musicUrl };
    }

    console.log('MusicGen output type:', typeof output, JSON.stringify(output).substring(0, 200));
    releaseReplicateSlot();
    return { success: false, error: 'Unexpected MusicGen output format' };

  } catch (error) {
    console.error('❌ MusicGen failed:', error);
    releaseReplicateSlot();
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

async function applyFade(inputPath, totalDuration) {
  const outputPath = inputPath.replace('.wav', '_final.m4a');
  const paddedDuration = totalDuration + 4; // +4s to cover cube beginning/end animations
  const fadeOutStart = Math.max(0, totalDuration - 2);

  return new Promise((resolve) => {
    // -stream_loop -1: loop audio to cover full video duration (handles large groups
    // where generated music is shorter than total video length)
    const args = [
      '-stream_loop', '-1',
      '-i', inputPath,
      '-af', `afade=t=in:d=1,afade=t=out:st=${fadeOutStart}:d=2`,
      '-t', String(paddedDuration),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-y', outputPath
    ];
    execFile('ffmpeg', args, { timeout: 60000 }, (err) => {
      if (err) {
        console.warn('⚠️ Fade apply failed, using original wav:', err.message);
        resolve(inputPath);
      } else {
        console.log('✅ Fade applied:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

async function generateMusicForVideo(transcriptionSegments, totalDuration, style, numClips) {
  console.log('🎶 Starting music generation pipeline...');
  console.log(`Duration: ${totalDuration}s, Style hint: ${style || 'auto'}, Clips: ${numClips || 'auto'}`);

  const emotionData = await analyzeEmotionalTimeline(transcriptionSegments, totalDuration, { numClips });
  if (!emotionData.success) {
    console.warn('⚠️ Emotion analysis had issues, using fallback');
  }

  const { chunkPrompts = [], musicalDNA = {}, chunkDuration = CHUNK_DURATION } = emotionData;
  console.log(`🎵 Musical DNA: ${musicalDNA.basePrompt || '—'}`);
  console.log(`🎵 Generating ${chunkPrompts.length} chunk(s) of ${chunkDuration}s each`);

  // Generate all chunks in parallel — each Replicate call is independent and cloud-side,
  // so parallelising reduces total time from N×45s → ~45s regardless of chunk count.
  console.log(`🚀 Generating ${chunkPrompts.length} chunk(s) in parallel...`);
  let chunkPaths;
  try {
    chunkPaths = await Promise.all(
      chunkPrompts.map(async (prompt, i) => {
        console.log(`🎵 Chunk ${i + 1}/${chunkPrompts.length} started: ${prompt.substring(0, 80)}...`);
        const result = await generateMusic(prompt, chunkDuration);
        if (!result.success) {
          console.warn(`⚠️ Chunk ${i + 1} failed: ${result.error} — retrying with fallback`);
          const fallback = await generateMusic(
            `${musicalDNA.basePrompt || 'gentle piano, C major, 80 BPM'}, begins softly, returns to calm, ${chunkDuration} seconds`,
            chunkDuration
          );
          if (!fallback.success) {
            throw new Error(`Chunk ${i + 1} generation failed: ${result.error}`);
          }
          return fallback.path;
        }
        return result.path;
      })
    );
  } catch (parallelErr) {
    return { success: false, error: parallelErr.message };
  }

  // Concatenate chunks if more than one
  ensureTempDir();
  let rawMusicPath;
  try {
    rawMusicPath = await concatenateChunks(chunkPaths);
  } catch (concatErr) {
    console.warn('⚠️ Concatenation failed, using first chunk:', concatErr.message);
    rawMusicPath = chunkPaths[0];
  }

  // Clean up intermediate chunk files
  chunkPaths.forEach(p => {
    if (p !== rawMusicPath) try { fs.unlinkSync(p); } catch (e) {}
  });

  // Apply fade-in/out and convert to m4a
  const finalMusicPath = await applyFade(rawMusicPath, totalDuration);
  if (finalMusicPath !== rawMusicPath) {
    try { fs.unlinkSync(rawMusicPath); } catch (e) {}
  }

  return {
    success: true,
    musicPath: finalMusicPath,
    musicUrl: null,
    emotionTimeline: emotionData.timeline,
    musicPrompt: chunkPrompts[0] || '',
    musicalKey: musicalDNA.musicalKey || emotionData.musicalKey,
    bpm: musicalDNA.bpm || emotionData.bpm,
    chunkCount: chunkPaths.length,
  };
}

function cleanupMusicFiles(musicPath) {
  try {
    if (musicPath && fs.existsSync(musicPath)) {
      fs.unlinkSync(musicPath);
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
