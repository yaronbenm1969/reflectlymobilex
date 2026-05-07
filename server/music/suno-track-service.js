/**
 * suno-track-service.js
 * Selects, cuts, and assembles Suno pre-made tracks for a video.
 *
 * Strategy:
 *   - Tracks are organized in 11 sets. Each set shares the same BPM + musical key
 *     so crossfades within a set are smooth.
 *   - GPT-4o picks the best set based on the overall emotional context.
 *   - Clip mode is determined by avgClipDuration:
 *       ≤20s (15s clips, >12 participants) → clipsPerTrack=3, cutDuration=45s
 *       >20s (30s clips, ≤12 participants) → clipsPerTrack=1, cutDuration=30s
 *   - Tracks are downloaded from their Firebase Storage URL and cut with ffmpeg
 *     starting from the track's `startOffset` field (default 45s, skips Suno intro).
 *   - Cuts are crossfaded and looped to cover totalDuration.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const https = require('https');
const http  = require('http');
const { execFile } = require('child_process');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEMP_DIR = path.join(os.tmpdir(), 'reflectly-server', 'suno');

function ensureDir() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Set metadata for GPT-4o prompt
// ---------------------------------------------------------------------------
const SET_INFO = [
  { set: 1,  key: 'Dm', bpm: 48,  tone: 'loss, grief, profound absence' },
  { set: 2,  key: 'Am', bpm: 58,  tone: 'melancholy, tender sadness, longing' },
  { set: 3,  key: 'C',  bpm: 64,  tone: 'hope, new beginning, gentle optimism' },
  { set: 4,  key: 'G',  bpm: 70,  tone: 'warmth, family, belonging' },
  { set: 5,  key: 'D',  bpm: 76,  tone: 'achievement, pride, quiet triumph' },
  { set: 6,  key: 'G',  bpm: 82,  tone: 'celebratory, joyful, festive' },
  { set: 7,  key: 'D',  bpm: 92,  tone: 'grand event, community, inspiring' },
  { set: 8,  key: 'A',  bpm: 104, tone: 'energetic, sport, motivating' },
  { set: 9,  key: 'F',  bpm: 66,  tone: 'intimate, personal, vulnerable' },
  { set: 10, key: 'C',  bpm: 60,  tone: 'universal, ambient, neutral' },
  { set: 11, key: 'Em', bpm: 110, tone: 'digital, electronic, modern' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function downloadFile(url, dest) {
  const urlStr = typeof url === 'string' ? url : url.toString();
  return new Promise((resolve, reject) => {
    const proto = urlStr.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(dest);
    proto.get(urlStr, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function ffmpegCut(inputPath, outputPath, startSec, durationSec) {
  return new Promise((resolve, reject) => {
    const args = [
      '-ss', String(startSec),
      '-i', inputPath,
      '-t', String(durationSec),
      '-c:a', 'pcm_s16le',   // lossless WAV for concat quality
      '-ar', '44100',
      '-y', outputPath,
    ];
    execFile('ffmpeg', args, { timeout: 60000 }, (err) => {
      if (err) reject(new Error(`ffmpeg cut failed: ${err.message}`));
      else resolve(outputPath);
    });
  });
}

function ffmpegConcat(inputPaths, outputPath) {
  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return Promise.resolve(outputPath);
  }

  const crossfade = 2;
  return new Promise((resolve, reject) => {
    const args = ['-y'];
    inputPaths.forEach(p => args.push('-i', p));

    let filterGraph;
    if (inputPaths.length === 2) {
      filterGraph = `[0][1]acrossfade=d=${crossfade}:c1=tri:c2=tri[out]`;
    } else {
      const parts = [];
      let lastLabel = '[0]';
      for (let i = 1; i < inputPaths.length; i++) {
        const outLabel = i === inputPaths.length - 1 ? '[out]' : `[cf${i}]`;
        parts.push(`${lastLabel}[${i}]acrossfade=d=${crossfade}:c1=tri:c2=tri${outLabel}`);
        lastLabel = outLabel;
      }
      filterGraph = parts.join(';');
    }

    args.push('-filter_complex', filterGraph, '-map', '[out]',
              '-c:a', 'pcm_s16le', '-ar', '44100', outputPath);

    execFile('ffmpeg', args, { timeout: 120000 }, (err) => {
      if (err) reject(new Error(`ffmpeg concat failed: ${err.message}`));
      else resolve(outputPath);
    });
  });
}

function ffmpegFadeAndLoop(inputPath, outputPath, totalDuration) {
  const paddedDuration = totalDuration + 4;
  const fadeOutStart   = Math.max(0, totalDuration - 2);
  return new Promise((resolve, reject) => {
    const args = [
      '-stream_loop', '-1',
      '-i', inputPath,
      '-af', `afade=t=in:d=1,afade=t=out:st=${fadeOutStart}:d=2`,
      '-t', String(paddedDuration),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-y', outputPath,
    ];
    execFile('ffmpeg', args, { timeout: 120000 }, (err) => {
      if (err) reject(new Error(`ffmpeg fade/loop failed: ${err.message}`));
      else resolve(outputPath);
    });
  });
}

// ---------------------------------------------------------------------------
// GPT-4o set selection
// ---------------------------------------------------------------------------
async function selectSet(transcriptionSegments, numClips, style, userHint, excludeSet) {
  // Build a short text summary of the transcription for the prompt
  const text = (transcriptionSegments || [])
    .map(s => s.text || s.transcription || '')
    .join(' ')
    .trim()
    .slice(0, 1200);

  const setDescriptions = SET_INFO
    .map(s => `Set ${s.set}: ${s.tone} (${s.key} ${s.bpm} BPM)`)
    .join('\n');

  const parts = [];
  if (text)       parts.push(`Video transcription:\n"${text}"`);
  if (style)      parts.push(`Style hint: ${style}`);
  if (userHint)   parts.push(`Creator's explicit request: "${userHint}" — give this strong priority.`);
  if (excludeSet) parts.push(`IMPORTANT: Do NOT choose Set ${excludeSet} — it was already used and the creator wants something different.`);
  if (!parts.length) parts.push('No context available. Pick a warm, universal set.');

  const userContext = parts.join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 20,
      messages: [
        {
          role: 'system',
          content:
            'You are a music supervisor. Based on the video content and any explicit creator requests, choose the single most appropriate music set number (1-11). Reply with ONLY the set number, nothing else.',
        },
        {
          role: 'user',
          content: `${userContext}\n\nAvailable sets:\n${setDescriptions}\n\nBest set number:`,
        },
      ],
    });

    const raw = (response.choices[0]?.message?.content || '').trim();
    const num = parseInt(raw, 10);
    if (num >= 1 && num <= 11) {
      console.log(`🎵 GPT-4o selected Set ${num}: ${SET_INFO[num - 1].tone}`);
      return num;
    }
  } catch (err) {
    console.warn('⚠️ GPT-4o set selection failed:', err.message);
  }

  // Fallback: Set 4 (warm/family), or 3 if 4 is excluded
  const fallback = excludeSet === 4 ? 3 : 4;
  console.log(`🎵 Falling back to Set ${fallback}`);
  return fallback;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * generateSunoMusicForVideo
 * @param {object[]} transcriptionSegments - array of { text, start, end }
 * @param {number}   totalDuration         - full video duration in seconds
 * @param {string}   style                 - optional style hint
 * @param {number}   numClips              - number of video clips
 * @param {object}   db                    - Firestore Admin instance (firestoreDb)
 * @param {string}   [userHint]            - Optional free-text from creator ("something more uplifting")
 * @returns {{ success, musicPath, set, error? }}
 */
async function generateSunoMusicForVideo(transcriptionSegments, totalDuration, style, numClips, db, userHint, excludeSet) {
  ensureDir();
  const ts = Date.now();

  // ------------------------------------------------------------------
  // 1. Load tracks from Firestore
  // ------------------------------------------------------------------
  let allTracks;
  try {
    const snap = await db.collection('suno_tracks').get();
    allTracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return { success: false, error: `Firestore read failed: ${err.message}` };
  }

  if (!allTracks.length) {
    return { success: false, error: 'No Suno tracks in Firestore' };
  }

  // Group tracks by set number
  const bySet = {};
  allTracks.forEach(t => {
    const s = parseInt(t.set) || 0;
    if (!bySet[s]) bySet[s] = [];
    bySet[s].push(t);
  });

  const availableSets = Object.keys(bySet).map(Number).sort((a, b) => a - b);
  console.log(`🎵 Suno library: ${allTracks.length} tracks across sets ${availableSets.join(', ')}`);

  // ------------------------------------------------------------------
  // 2. Select best set via GPT-4o
  // ------------------------------------------------------------------
  let chosenSet = await selectSet(transcriptionSegments, numClips, style, userHint, excludeSet);
  if (!bySet[chosenSet] || bySet[chosenSet].length === 0) {
    // Fallback: find closest available set, preferring one different from excludeSet
    const preferred = availableSets.filter(s => s !== excludeSet);
    chosenSet = preferred.length > 0 ? preferred[0] : availableSets[0];
    console.warn(`⚠️ Chosen set not available, using Set ${chosenSet}`);
  }
  // If still same as excludeSet and there's an alternative, switch
  if (excludeSet && chosenSet === excludeSet && availableSets.length > 1) {
    const alt = availableSets.find(s => s !== excludeSet);
    if (alt) { chosenSet = alt; console.log(`🎵 Switched to Set ${chosenSet} to avoid repeat`); }
  }
  const setTracks = [...bySet[chosenSet]]; // copy so we can shuffle
  console.log(`🎵 Using Set ${chosenSet} — ${setTracks.length} tracks available`);

  // ------------------------------------------------------------------
  // 3. Determine clip mode and cut parameters
  // ------------------------------------------------------------------
  const clips        = numClips || 1;
  const avgClipDur   = totalDuration / clips;
  const isShortClips = avgClipDur <= 20; // 15s mode

  const clipsPerTrack  = isShortClips ? 3 : 1;
  const trackCutDur    = isShortClips ? 45 : 30;
  const numCuts        = Math.ceil(clips / clipsPerTrack);

  console.log(`🎵 Clip mode: ${isShortClips ? '15s' : '30s'} | clipsPerTrack=${clipsPerTrack} | cuts needed=${numCuts}`);

  // Shuffle tracks for variety (Fisher-Yates)
  for (let i = setTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [setTracks[i], setTracks[j]] = [setTracks[j], setTracks[i]];
  }

  // ------------------------------------------------------------------
  // 4. Download and cut each track
  // ------------------------------------------------------------------
  const cutPaths = [];
  const tempFiles = [];

  try {
    for (let i = 0; i < numCuts; i++) {
      const track = setTracks[i % setTracks.length]; // cycle through set tracks
      const startOffset = typeof track.startOffset === 'number' ? track.startOffset : 45;

      if (!track.url) {
        console.warn(`⚠️ Track ${track.id} has no URL — skipping`);
        continue;
      }

      // Download
      const dlPath = path.join(TEMP_DIR, `suno_dl_${ts}_${i}.mp3`);
      console.log(`⬇️  Downloading ${track.id} (Set ${chosenSet}, offset ${startOffset}s)...`);
      await downloadFile(track.url, dlPath);
      tempFiles.push(dlPath);

      // Cut from startOffset
      const cutPath = path.join(TEMP_DIR, `suno_cut_${ts}_${i}.wav`);
      await ffmpegCut(dlPath, cutPath, startOffset, trackCutDur);
      cutPaths.push(cutPath);
      tempFiles.push(cutPath);

      console.log(`✂️  Cut ${i + 1}/${numCuts}: ${track.id} [${startOffset}s → ${startOffset + trackCutDur}s]`);
    }
  } catch (err) {
    cleanup(tempFiles);
    return { success: false, error: `Track download/cut failed: ${err.message}` };
  }

  if (cutPaths.length === 0) {
    return { success: false, error: 'No tracks could be cut (all tracks missing URL?)' };
  }

  // ------------------------------------------------------------------
  // 5. Concatenate cuts
  // ------------------------------------------------------------------
  const rawPath = path.join(TEMP_DIR, `suno_raw_${ts}.wav`);
  try {
    await ffmpegConcat(cutPaths, rawPath);
    tempFiles.push(rawPath);
    console.log(`✅ Concatenated ${cutPaths.length} cuts`);
  } catch (err) {
    cleanup(tempFiles);
    return { success: false, error: `Concat failed: ${err.message}` };
  }

  // ------------------------------------------------------------------
  // 6. Apply fade-in/out and loop to cover totalDuration
  // ------------------------------------------------------------------
  const finalPath = path.join(TEMP_DIR, `suno_final_${ts}.m4a`);
  try {
    await ffmpegFadeAndLoop(rawPath, finalPath, totalDuration);
    console.log(`✅ Suno music ready: ${finalPath}`);
  } catch (err) {
    cleanup(tempFiles);
    return { success: false, error: `Fade/loop failed: ${err.message}` };
  }

  // Clean up intermediate files (keep finalPath — caller cleans that)
  cleanup(tempFiles);

  return { success: true, musicPath: finalPath, set: chosenSet };
}

function cleanup(paths) {
  paths.forEach(p => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  });
}

module.exports = { generateSunoMusicForVideo };
