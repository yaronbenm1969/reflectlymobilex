const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MUSIC_TEMP_DIR = path.join(os.tmpdir(), 'reflectly-server', 'music');

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

  // Voice enhancement chain: denoise → compress → normalize
  const voiceEnhance = 'highpass=f=80,afftdn=nf=-25,acompressor=threshold=-25dB:ratio=3:attack=5:release=50';

  let voiceFilter;
  if (stats && stats.input_i && stats.input_i !== '-inf') {
    const measuredI = parseFloat(stats.input_i);
    const measuredLRA = parseFloat(stats.input_lra);
    const measuredTP = parseFloat(stats.input_tp);
    const measuredThresh = parseFloat(stats.input_thresh);
    const offset = parseFloat(stats.target_offset);
    console.log(`📊 Pass 2: Normalizing speech from ${measuredI.toFixed(1)} LUFS → -14 LUFS + denoise`);
    voiceFilter = `${voiceEnhance},loudnorm=I=-14:LRA=7:TP=-1.5:measured_I=${measuredI}:measured_LRA=${measuredLRA}:measured_TP=${measuredTP}:measured_thresh=${measuredThresh}:offset=${offset}:linear=true`;
  } else {
    console.log('📊 Pass 2: No valid levels detected, using enhanced fallback');
    voiceFilter = `${voiceEnhance},volume=2.5`;
  }

  const filterComplex = [
    `[0:v]setpts=PTS-STARTPTS[vout]`,
    `[0:a]${voiceFilter}[voice]`,
    `[1:a]volume=${musicVolume}[music]`,
    `[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
  ].join(';');

  console.log('🎬 Pass 2: Mixing with music...');
  console.log(`Music: ${musicPath} at ${musicVolume}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-stream_loop', '-1',
      '-i', musicPath,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-r', '30',
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
      '-stream_loop', '-1',
      '-i', musicPath,
      '-filter_complex',
      `[0:v]setpts=PTS-STARTPTS[vout];[1:a]volume=${musicVolume}[music]`,
      '-map', '[vout]',
      '-map', '[music]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'baseline',
      '-pix_fmt', 'yuv420p',
      '-bf', '0',
      '-vsync', 'cfr',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-ac', '2',
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

/**
 * Mix clean vocals (from Demucs separation) with a background music track.
 * The original video audio is completely replaced.
 *
 * @param {string} videoPath   - Original video (its audio track is discarded)
 * @param {string} vocalsPath  - Clean vocals WAV from Demucs
 * @param {string} musicPath   - Background music file (MP3/M4A/WAV)
 * @param {string} outputPath  - Output MP4 path
 * @param {number} musicVolume - Music volume relative to vocals (default 0.15)
 */
async function mixVocalsWithMusic(videoPath, vocalsPath, musicPath, outputPath, musicVolume = 0.15) {
  console.log('🎚️ Mixing clean vocals + music into video...');
  console.log(`Vocals: ${vocalsPath}`);
  console.log(`Music:  ${musicPath} at vol=${musicVolume}`);

  // loudnorm on vocals for consistent levels, then mix with music
  const filterComplex = [
    `[1:a]loudnorm=I=-14:LRA=7:TP=-1.5[voice]`,
    `[2:a]volume=${musicVolume}[music]`,
    `[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
  ].join(';');

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,         // [0] video (audio ignored via map)
      '-i', vocalsPath,        // [1] clean vocals
      '-stream_loop', '-1',
      '-i', musicPath,         // [2] background music (looped)
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
        console.error('❌ mixVocalsWithMusic failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 500));
        reject(err);
      } else {
        console.log('✅ Vocals + music mixed:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

// Fast single-pass mix using the recording's own audio [0:a] + music.
// Uses alimiter (zero latency) instead of 2-pass loudnorm → much faster, lip-sync preserved.
async function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', videoPath
    ], { timeout: 10000 }, (err, stdout) => {
      const dur = parseFloat(stdout?.trim());
      resolve(isNaN(dur) ? null : dur);
    });
  });
}

async function mixRecordingAudioWithMusic(videoPath, musicPath, outputPath, musicVolume = 0.1) {
  console.log(`🎬 Fast mix: recording audio [0:a] + music at vol=${musicVolume}...`);
  // Use -c:v copy to preserve original iOS h264 stream without re-encoding.
  // Re-encoding with libx264 causes WhatsApp iOS to show audio-only.
  // asetpts=PTS-STARTPTS on both audio inputs: iOS VFR recordings may have large
  // audio PTS offsets that cause amix to produce empty output (7592-byte container).
  // duration=first: use video audio duration (not shortest) to avoid early cutoff.
  const filterComplex = [
    `[0:a]asetpts=PTS-STARTPTS[va]`,
    `[1:a]volume=${musicVolume},asetpts=PTS-STARTPTS[m]`,
    `[va][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
  ].join(';');
  const args = [
    '-i', videoPath,
    '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    '-movflags', '+faststart',
    '-y', outputPath
  ];
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ mixRecordingAudioWithMusic failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 1000));
        reject(err);
      } else {
        const outSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
        if (outSize < 10000) {
          console.error(`❌ mixRecordingAudioWithMusic: output too small (${outSize} bytes) — empty container`);
          console.error('FFmpeg stderr:', stderr?.substring(0, 1000));
          reject(new Error(`Mixed output too small: ${outSize} bytes`));
        } else {
          console.log('✅ Recording audio + music mixed (fast, lip-sync preserved):', outputPath);
          resolve(outputPath);
        }
      }
    });
  });
}

async function mixCubeWithVoicesAndMusic(videoPath, clipPaths, musicPath, outputPath, musicVolume = 0.1) {
  console.log(`🎬 Cube mix: ${clipPaths.length} voice clips + music at vol=${musicVolume}...`);

  if (clipPaths.length === 0) {
    return mixMusicWithVideoNoAudio(videoPath, musicPath, outputPath, 0.9);
  }

  // [0]=cube_video (silent), [1..N]=participant clips, [N+1]=music
  const inputs = ['-i', videoPath];
  clipPaths.forEach(p => inputs.push('-i', p));
  inputs.push('-i', musicPath);

  const N = clipPaths.length;
  const musicIdx = N + 1;
  const concatInputs = clipPaths.map((_, i) => `[${i + 1}:a]`).join('');

  const filterComplex = [
    // Reset video PTS to start at 0 — fixes audio/video drift when source is WebM-converted MP4
    `[0:v]setpts=PTS-STARTPTS[vout]`,
    `${concatInputs}concat=n=${N}:v=0:a=1[voices]`,
    // alimiter instead of loudnorm: loudnorm adds ~1.7s lookahead latency per pass → voices lag video.
    // alimiter is near-zero latency and prevents clipping.
    `[voices]highpass=f=80,afftdn=nf=-25,acompressor=threshold=-25dB:ratio=3:attack=5:release=50,alimiter=limit=0.95[v]`,
    `[${musicIdx}:a]volume=${musicVolume}[m]`,
    `[v][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
  ].join(';');

  const args = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',   // re-encode so muxer writes correct PTS (copy preserves WebM drift)
    '-profile:v', 'baseline',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-r', '30',          // force CFR 30fps — prevents WhatsApp recompression sync drift
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    '-y', outputPath
  ];

  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ mixCubeWithVoicesAndMusic failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 500));
        reject(err);
      } else {
        console.log('✅ Cube video with voices + music done:', outputPath);
        resolve(outputPath);
      }
    });
  });
}

// Remux iOS recording for WhatsApp (no music added) — copy video stream, re-encode audio only.
// The raw iOS WebView h264 stream IS WhatsApp-compatible; re-encoding it breaks playback.
async function reencodeForWhatsApp(videoPath, outputPath) {
  console.log('🎬 Remuxing for WhatsApp (copy video, re-encode audio only)...');
  const args = [
    '-i', videoPath,
    '-map', '0:v',
    '-map', '0:a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    '-y', outputPath
  ];
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 300000 }, (err, _stdout, stderr) => {
      if (err) {
        console.error('❌ reencodeForWhatsApp failed:', err.message);
        console.error('FFmpeg stderr:', stderr?.substring(0, 300));
        reject(err);
      } else {
        console.log('✅ Remuxed for WhatsApp (video copied, audio re-encoded):', outputPath);
        resolve(outputPath);
      }
    });
  });
}

module.exports = {
  mixStemsWithTimeline,
  mixMusicWithVideo,
  mixMusicWithVideoNoAudio,
  mixVocalsWithMusic,
  mixCubeWithVoicesAndMusic,
  mixRecordingAudioWithMusic,
  reencodeForWhatsApp
};
