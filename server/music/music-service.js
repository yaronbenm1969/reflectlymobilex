const Replicate = require('replicate');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyzeEmotionalTimeline, buildMusicPrompt } = require('./emotion-analysis');

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
      'facebook/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbb',
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

async function generateMusicForVideo(transcriptionSegments, totalDuration, style) {
  console.log('🎶 Starting full music generation pipeline...');
  console.log(`Duration: ${totalDuration}s, Style hint: ${style || 'auto'}`);

  const emotionData = await analyzeEmotionalTimeline(transcriptionSegments, totalDuration);
  
  if (!emotionData.success) {
    console.warn('⚠️ Emotion analysis had issues, using fallback');
  }

  const musicPrompt = await buildMusicPrompt(emotionData, totalDuration);
  console.log(`🎵 Final MusicGen prompt: ${musicPrompt}`);

  const musicResult = await generateMusic(musicPrompt, totalDuration);
  if (!musicResult.success) {
    return { success: false, error: `Music generation failed: ${musicResult.error}` };
  }

  const stemsResult = await separateInstruments(musicResult.path);
  
  return {
    success: true,
    musicPath: musicResult.path,
    musicUrl: musicResult.url,
    stems: stemsResult.stems,
    stemModel: stemsResult.model,
    emotionTimeline: emotionData.timeline,
    musicPrompt: musicPrompt,
    musicalKey: emotionData.musicalKey,
    bpm: emotionData.bpm
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
