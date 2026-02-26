const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const MUSIC_TEMP_DIR = path.join(process.cwd(), 'temp', 'music');

function ensureTempDir() {
  if (!fs.existsSync(MUSIC_TEMP_DIR)) {
    fs.mkdirSync(MUSIC_TEMP_DIR, { recursive: true });
  }
}

const EQ_PRESETS = {
  warm: 'equalizer=f=250:t=q:w=1:g=3,equalizer=f=3000:t=q:w=1:g=-2',
  bright: 'equalizer=f=5000:t=q:w=1:g=4,equalizer=f=10000:t=q:w=1:g=3',
  deep: 'equalizer=f=80:t=q:w=1:g=5,equalizer=f=200:t=q:w=1:g=3',
  neutral: 'anull'
};

const REVERB_LEVELS = {
  dry: 0.1,
  medium: 0.4,
  spacious: 0.7,
  cathedral: 0.9
};

const STEREO_WIDTHS = {
  narrow: 0.3,
  normal: 0.6,
  wide: 0.9
};

function buildStemVolumeFilter(stemName, timeline, totalDuration) {
  const volumePoints = [];
  
  for (const seg of timeline) {
    let level;
    switch (stemName) {
      case 'drums':
        level = (seg.drums ?? 50) / 100;
        break;
      case 'bass':
        level = (seg.bass ?? 50) / 100;
        break;
      case 'other':
      case 'piano':
      case 'guitar':
        level = (seg.melody ?? 70) / 100;
        break;
      case 'vocals':
        level = 0;
        break;
      default:
        level = 0.5;
    }
    
    volumePoints.push(`volume=enable='between(t,${seg.start},${seg.end})':volume=${level.toFixed(2)}`);
  }

  if (volumePoints.length === 0) {
    return 'volume=0.5';
  }

  return volumePoints.join(',');
}

function buildDynamicVolumeExpr(stemName, timeline) {
  const parts = [];
  
  for (const seg of timeline) {
    let level;
    switch (stemName) {
      case 'drums':
        level = (seg.drums ?? 50) / 100;
        break;
      case 'bass':
        level = (seg.bass ?? 50) / 100;
        break;
      case 'other':
      case 'piano':
      case 'guitar':
        level = (seg.melody ?? 70) / 100;
        break;
      case 'vocals':
        level = 0;
        break;
      default:
        level = 0.5;
    }
    
    parts.push(`between(t,${seg.start},${seg.end})*${level.toFixed(2)}`);
  }

  if (parts.length === 0) return '0.5';
  return parts.join('+');
}

async function mixStemsWithTimeline(stems, timeline, totalDuration, outputPath) {
  console.log('🎚️ Mixing stems with emotional timeline...');
  console.log(`Stems: ${Object.keys(stems).join(', ')}`);
  console.log(`Timeline segments: ${timeline.length}`);

  ensureTempDir();

  const availableStems = Object.entries(stems).filter(([name, path]) => {
    if (name === 'vocals') return false;
    return fs.existsSync(path);
  });

  if (availableStems.length === 0) {
    throw new Error('No valid stems available for mixing');
  }

  if (availableStems.length === 1) {
    console.log('Only one stem available, applying dynamic volume only');
    return applySingleStemDynamics(availableStems[0][1], availableStems[0][0], timeline, outputPath);
  }

  const inputArgs = [];
  const filterParts = [];
  
  availableStems.forEach(([name, stemPath], idx) => {
    inputArgs.push('-i', stemPath);
    
    const volExpr = buildDynamicVolumeExpr(name, timeline);
    filterParts.push(`[${idx}:a]volume='${volExpr}':eval=frame[${name}]`);
  });

  const stemLabels = availableStems.map(([name]) => `[${name}]`).join('');
  filterParts.push(`${stemLabels}amix=inputs=${availableStems.length}:duration=longest:dropout_transition=2[mixed]`);

  const globalEq = timeline[0]?.eq || 'neutral';
  const eqFilter = EQ_PRESETS[globalEq] || EQ_PRESETS.neutral;
  
  filterParts.push(`[mixed]${eqFilter},alimiter=limit=0.95[final]`);

  const filterComplex = filterParts.join(';');

  return new Promise((resolve, reject) => {
    const args = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[final]',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-y', outputPath
    ];

    console.log('FFmpeg mix command:', 'ffmpeg', args.slice(0, 6).join(' '), '...');

    execFile('ffmpeg', args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Stem mixing failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 500));
        reject(err);
      } else {
        console.log('✅ Stems mixed successfully:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

async function applySingleStemDynamics(stemPath, stemName, timeline, outputPath) {
  const volExpr = buildDynamicVolumeExpr(stemName, timeline);
  
  return new Promise((resolve, reject) => {
    const args = [
      '-i', stemPath,
      '-af', `volume='${volExpr}':eval=frame,alimiter=limit=0.95`,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-y', outputPath
    ];

    execFile('ffmpeg', args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Single stem dynamics failed:', err.message);
        reject(err);
      } else {
        console.log('✅ Single stem dynamics applied:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

async function analyzeLoudness(videoPath) {
  return new Promise((resolve) => {
    const args = [
      '-i', videoPath,
      '-af', 'loudnorm=I=-16:LRA=7:TP=-1.5:print_format=json',
      '-f', 'null',
      '-'
    ];
    execFile('ffmpeg', args, { timeout: 60000 }, (err, stdout, stderr) => {
      const combined = (stdout || '') + (stderr || '');
      const jsonMatch = combined.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const stats = JSON.parse(jsonMatch[0]);
          console.log('📊 Loudness analysis:', JSON.stringify(stats));
          resolve(stats);
        } catch (e) {
          console.warn('⚠️ Could not parse loudnorm JSON, using defaults');
          resolve(null);
        }
      } else {
        console.warn('⚠️ No loudnorm stats found in FFmpeg output');
        resolve(null);
      }
    });
  });
}

async function mixMusicWithVideo(videoPath, musicPath, outputPath, musicVolume = 0.08) {
  console.log('🎬 Pass 1: Analyzing speech loudness...');

  const stats = await analyzeLoudness(videoPath);

  let voiceFilter;
  if (stats && stats.input_i && stats.input_i !== '-inf') {
    const measuredI = parseFloat(stats.input_i);
    const measuredLRA = parseFloat(stats.input_lra);
    const measuredTP = parseFloat(stats.input_tp);
    const measuredThresh = parseFloat(stats.input_thresh);
    const offset = parseFloat(stats.target_offset);
    console.log(`📊 Pass 2: Normalizing speech from ${measuredI.toFixed(1)} LUFS → -14 LUFS`);
    voiceFilter = `loudnorm=I=-14:LRA=7:TP=-1.5:measured_I=${measuredI}:measured_LRA=${measuredLRA}:measured_TP=${measuredTP}:measured_thresh=${measuredThresh}:offset=${offset}:linear=true`;
  } else {
    console.log('📊 Pass 2: No valid levels detected, using volume boost fallback');
    voiceFilter = 'volume=2.0';
  }

  const filterComplex = `[0:a]${voiceFilter}[voice];[1:a]volume=0.06[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`;

  console.log('🎬 Pass 2: Mixing with music...');
  console.log(`Music: ${musicPath} at 0.06`);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-i', musicPath,
      '-filter_complex', filterComplex,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      '-y', outputPath
    ];

    execFile('ffmpeg', args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Video+music mixing failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 500));
        reject(err);
      } else {
        console.log('✅ Video+music mixed successfully:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

async function mixMusicWithVideoNoAudio(videoPath, musicPath, outputPath, musicVolume = 0.5) {
  console.log('🎬 Adding music to video (no original audio)...');

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-i', musicPath,
      '-filter_complex',
      `[1:a]volume=${musicVolume}[music]`,
      '-map', '0:v',
      '-map', '[music]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      '-y', outputPath
    ];

    execFile('ffmpeg', args, { timeout: 180000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Video+music (no audio) failed:', err.message);
        reject(err);
      } else {
        console.log('✅ Music added to video:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

module.exports = {
  mixStemsWithTimeline,
  mixMusicWithVideo,
  mixMusicWithVideoNoAudio
};
