'use strict';
/**
 * cube-render-poc.js
 * Isolated server-side Cube rendering proof-of-concept.
 *
 * Feature flag: SERVER_CUBE_RENDER_POC=true (env var) must be set or this module
 * will refuse to process any job.
 *
 * ROLLBACK: set SERVER_CUBE_RENDER_POC=false (or delete it) — all POC endpoints
 * return 403 immediately. No production code is affected.
 *
 * This module NEVER writes to:
 *   - stories/{storyId}.finalVideoUrl
 *   - edited/ storage path
 * It writes ONLY to: poc-renders/{storyId}/{jobId}/cube-poc.mp4
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

let puppeteer;
try { puppeteer = require('puppeteer'); } catch { puppeteer = null; }

const {
  downloadFile,
  getVideoDuration,
} = require('../format-renderer');

// ─── POC quality profile ──────────────────────────────────────────────────────
// These settings apply ONLY to POC renders. format-renderer.js defaults are
// unchanged (540×960, 12fps, jpeg, crf26, ultrafast).
const POC_WIDTH      = 720;
const POC_HEIGHT     = 1280;
const POC_FPS        = 24;
const POC_CRF        = 26;
const POC_PRESET     = 'veryfast';
const POC_SCREENSHOT = 'jpeg'; // jpeg reduces Chrome memory pressure vs png

// ─── Safety limits ────────────────────────────────────────────────────────────
const MAX_STORY_DURATION_SECS = 300; // max story length for server render (5 min)
const MIN_DISK_BYTES          = 700 * 1024 * 1024; // 700 MB
const STALE_JOB_MINUTES       = 30;

// ─── Firestore collection (separate from stories) ─────────────────────────────
const POC_COLLECTION = 'render_poc_jobs';

// ─── Process-level race guard ─────────────────────────────────────────────────
// Protects against concurrent renders on the same server instance.
// Firestore check (getActiveJob) handles cross-restart duplicates.
let _pocActive = false;

// ─── Chromium path ────────────────────────────────────────────────────────────
function findChromium() {
  if (process.platform === 'win32') {
    for (const p of [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]) { if (fs.existsSync(p)) return p; }
    return '';
  }
  try {
    return execSync(
      'which chromium 2>/dev/null || find /nix -name "chromium" -type f 2>/dev/null | head -1',
      { timeout: 5000 }
    ).toString().trim();
  } catch { return ''; }
}

// ─── Disk check ───────────────────────────────────────────────────────────────
async function getDiskAvailableBytes() {
  try {
    // Linux: df -B1 /tmp  → line 2 field 4 = available bytes
    const out = execSync("df -B1 /tmp | awk 'NR==2 {print $4}'", { timeout: 5000 }).toString().trim();
    const n = parseInt(out, 10);
    return Number.isFinite(n) ? n : Infinity;
  } catch { return Infinity; }
}

// ─── ffprobe helpers ──────────────────────────────────────────────────────────
function probeStreams(filePath) {
  try {
    const out = execSync(
      `ffprobe -v quiet -print_format json -show_streams "${filePath}"`,
      { timeout: 10000 }
    ).toString();
    return JSON.parse(out).streams || [];
  } catch { return []; }
}

// ─── Normalization ────────────────────────────────────────────────────────────
/**
 * Transcode one clip to H.264/AAC MP4 with stable fps.
 * - Preserves audio when present; uses -an when there is no audio stream.
 * - Never overwrites the source file.
 * - Returns { ok, hasAudio, sizeMb, errorMessage }
 */
async function normalizeClip(srcPath, destPath) {
  const streams = probeStreams(srcPath);
  const hasAudio = streams.some(s => s.codec_type === 'audio');

  // Build audio args: optional mapping avoids "no audio stream" failure
  const audioArgs = hasAudio
    ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2']
    : ['-an'];

  // -vf transpose= is NOT used; FFmpeg reads orientation from metadata (-noautorotate
  // is NOT set so FFmpeg applies rotation metadata automatically since FFmpeg 4.x)
  const args = [
    'ffmpeg', '-y',
    '-i', `"${srcPath}"`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '30',              // stable output frame rate
    '-movflags', '+faststart',
    ...audioArgs,
    `"${destPath}"`,
  ].join(' ');

  try {
    execSync(args, { timeout: 120000, stdio: 'pipe' });
    const ok = fs.existsSync(destPath) && fs.statSync(destPath).size > 1000;
    const sizeMb = ok ? fs.statSync(destPath).size / (1024 * 1024) : 0;
    return { ok, hasAudio, sizeMb: parseFloat(sizeMb.toFixed(2)) };
  } catch (e) {
    return { ok: false, hasAudio, sizeMb: 0, errorMessage: e.message.slice(0, 300) };
  }
}

// ─── Output validation ────────────────────────────────────────────────────────
/**
 * Validates the produced MP4 with ffprobe.
 * Returns { ok, reason?, sizeMb, duration, fps, hasAudio, audioCodec, probeJson }
 */
function validateOutput(outputPath, expectedDurationSecs) {
  if (!fs.existsSync(outputPath)) return { ok: false, reason: 'output file missing' };

  const sizeMb = fs.statSync(outputPath).size / (1024 * 1024);
  if (sizeMb < 0.05) return { ok: false, reason: `file too small: ${sizeMb.toFixed(3)} MB` };

  let probe;
  try {
    const raw = execSync(
      `ffprobe -v quiet -print_format json -show_streams -show_format "${outputPath}"`,
      { timeout: 15000 }
    ).toString();
    probe = JSON.parse(raw);
  } catch (e) { return { ok: false, reason: `ffprobe error: ${e.message.slice(0, 200)}` }; }

  const vs = probe.streams?.find(s => s.codec_type === 'video');
  const as = probe.streams?.find(s => s.codec_type === 'audio');

  if (!vs) return { ok: false, reason: 'no video stream' };
  if (vs.codec_name !== 'h264')    return { ok: false, reason: `codec=${vs.codec_name} (expected h264)` };
  if (vs.width  !== POC_WIDTH)     return { ok: false, reason: `width=${vs.width} (expected ${POC_WIDTH})` };
  if (vs.height !== POC_HEIGHT)    return { ok: false, reason: `height=${vs.height} (expected ${POC_HEIGHT})` };
  if (vs.pix_fmt !== 'yuv420p')   return { ok: false, reason: `pix_fmt=${vs.pix_fmt}` };

  const [fn, fd] = (vs.r_frame_rate || '0/1').split('/').map(Number);
  const fps = fd ? fn / fd : 0;
  if (Math.abs(fps - POC_FPS) > 2) return { ok: false, reason: `fps=${fps.toFixed(1)} (expected ~${POC_FPS})` };

  const duration = parseFloat(probe.format?.duration || 0);
  if (expectedDurationSecs > 0) {
    const tol = Math.max(4, expectedDurationSecs * 0.25);
    if (Math.abs(duration - expectedDurationSecs) > tol) {
      return { ok: false, reason: `duration=${duration.toFixed(1)}s (expected ~${expectedDurationSecs.toFixed(1)}s)` };
    }
  }

  return {
    ok: true,
    sizeMb: parseFloat(sizeMb.toFixed(2)),
    duration: parseFloat(duration.toFixed(2)),
    fps: parseFloat(fps.toFixed(2)),
    hasAudio: !!as,
    audioCodec: as?.codec_name || null,
    width: vs.width,
    height: vs.height,
    pixFmt: vs.pix_fmt,
    probeJson: JSON.stringify(probe).substring(0, 4000),
  };
}

// ─── Memory logging helper ────────────────────────────────────────────────────
function logMemory(label) {
  const m = process.memoryUsage();
  console.log(
    `[POC][MEM] ${label} — ` +
    `rss=${(m.rss / 1024 / 1024).toFixed(0)}MB ` +
    `heap=${(m.heapUsed / 1024 / 1024).toFixed(0)}/${(m.heapTotal / 1024 / 1024).toFixed(0)}MB ` +
    `ext=${(m.external / 1024 / 1024).toFixed(0)}MB`
  );
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function updateJob(firestoreDb, jobId, fields) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection(POC_COLLECTION).doc(jobId).update({
      ...fields,
      updatedAt: new Date(),
    });
  } catch (e) {
    // Heartbeat / status writes must not abort the render
    console.error(`[POC] Firestore update failed (${jobId}):`, e.message);
  }
}

/**
 * Query Firestore for an active (non-stale) POC job.
 * Filters stale jobs (updatedAt older than STALE_JOB_MINUTES) in app code
 * to avoid requiring a composite index.
 */
async function getActiveJob(firestoreDb) {
  if (!firestoreDb) return null;
  const activeStatuses = ['queued', 'downloading', 'normalizing', 'rendering', 'encoding', 'uploading'];
  let snap;
  try {
    snap = await firestoreDb.collection(POC_COLLECTION)
      .where('status', 'in', activeStatuses)
      .get();
  } catch { return null; }

  const now = Date.now();
  for (const doc of snap.docs) {
    const d = doc.data();
    // updatedAt may be a Firestore Timestamp or plain Date
    const ts = d.updatedAt?.toMillis?.() ?? d.updatedAt?.getTime?.() ?? 0;
    if ((now - ts) / 60000 < STALE_JOB_MINUTES) return { id: doc.id, ...d };
  }
  return null;
}

// ─── Image-sequence cube HTML (replaces video elements for headless Chrome) ───
/**
 * Same visual output as generateCubeHTML but loads JPEG frames extracted by
 * FFmpeg instead of <video> elements. ctx.drawImage(<img>) always works in
 * headless Chrome; ctx.drawImage(<video>) returns black without GPU decode.
 */
// Node.js helper — mirrors getVideoAtTime in the browser
function getVideoAtTimeNode(globalTime, videoDurations, cumulativeTimes) {
  for (let i = videoDurations.length - 1; i >= 0; i--) {
    if (globalTime >= cumulativeTimes[i]) {
      const lt = globalTime - cumulativeTimes[i];
      if (lt <= videoDurations[i]) return { videoIndex: i, localTime: Math.min(lt, videoDurations[i] - 0.01) };
    }
  }
  return { videoIndex: videoDurations.length - 1, localTime: videoDurations[videoDurations.length - 1] - 0.01 };
}

/**
 * Cube HTML that receives JPEG frames as base64 data URIs from Node.js
 * (passed via page.evaluate), avoiding any HTTP requests from the browser.
 * This sidesteps Chrome's null-origin → localhost blocking even with --disable-web-security.
 */
function generateCubeHtmlFromFrames(videoDurations, fps, bgUrl, logoB64, storyTitle) {
  const CS = 634; // cube size px (634/720 = 88% of frame width — +20% from 528)
  const W  = POC_WIDTH;
  const H  = POC_HEIGHT;
  const bgHtml = bgUrl
    ? `<video id="custom-bg" src="${bgUrl.replace(/'/g,'')}" autoplay loop muted playsinline
         style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;"></video>`
    : `<div class="space-bg"></div>`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${W},height=${H}">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;}
body{display:flex;align-items:center;justify-content:center;font-family:sans-serif;}
.space-bg{position:fixed;top:0;left:0;width:100%;height:100%;
  background:radial-gradient(ellipse at center,#0a0a1a 0%,#000 100%);z-index:0;}
.stars{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;}
.stars-layer{position:absolute;width:100%;height:100%;}
.stars-layer-1{background-image:
  radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.9) 0%,transparent 100%),
  radial-gradient(1px 1px at 25% 45%,rgba(255,255,255,.7) 0%,transparent 100%),
  radial-gradient(1.5px 1.5px at 40% 15%,rgba(255,255,255,.8) 0%,transparent 100%),
  radial-gradient(1px 1px at 55% 70%,rgba(255,255,255,.6) 0%,transparent 100%),
  radial-gradient(2px 2px at 70% 35%,rgba(255,255,255,.9) 0%,transparent 100%),
  radial-gradient(1px 1px at 85% 60%,rgba(255,255,255,.7) 0%,transparent 100%);
  animation:twinkle 4s ease-in-out infinite;}
.stars-layer-2{background-image:
  radial-gradient(1px 1px at 5% 55%,rgba(255,255,255,.5) 0%,transparent 100%),
  radial-gradient(1.5px 1.5px at 20% 30%,rgba(255,255,255,.6) 0%,transparent 100%),
  radial-gradient(1px 1px at 60% 25%,rgba(255,255,255,.7) 0%,transparent 100%),
  radial-gradient(2px 2px at 75% 55%,rgba(255,255,255,.5) 0%,transparent 100%);
  animation:twinkle 6s ease-in-out infinite 2s;}
.depth-grid{position:fixed;top:0;left:0;width:100%;height:100%;
  background:linear-gradient(rgba(255,107,157,.03) 1px,transparent 1px),
             linear-gradient(90deg,rgba(255,107,157,.03) 1px,transparent 1px);
  background-size:50px 50px;
  transform:perspective(500px) rotateX(60deg);transform-origin:center 120%;z-index:1;opacity:.5;}
@keyframes twinkle{0%,100%{opacity:1;}50%{opacity:.5;}}
.scene{width:${CS}px;height:${CS}px;perspective:1512px;perspective-origin:50% 50%;z-index:10;position:relative;}
.cube{width:100%;height:100%;position:relative;transform-style:preserve-3d;}
.cube-face{position:absolute;width:${CS}px;height:${CS}px;
  border:4px solid rgba(255,255,255,.7);border-radius:16px;overflow:hidden;
  background:#000;box-shadow:0 0 30px rgba(0,0,0,.3);backface-visibility:hidden;}
.cube-face canvas{width:100%;height:100%;position:absolute;top:0;left:0;background:#000;}
.front {transform:rotateY(0deg)   translateZ(${CS/2}px);}
.back  {transform:rotateY(180deg) translateZ(${CS/2}px);}
.right {transform:rotateY(90deg)  translateZ(${CS/2}px);}
.left  {transform:rotateY(-90deg) translateZ(${CS/2}px);}
.top   {transform:rotateX(90deg)  translateZ(${CS/2}px);}
.bottom{transform:rotateX(-90deg) translateZ(${CS/2}px);}
.float-wrapper{width:100%;height:100%;transform-style:preserve-3d;}
.spin-wrapper {width:100%;height:100%;transform-style:preserve-3d;}
</style></head>
<body>
${bgHtml}
<div class="stars"><div class="stars-layer stars-layer-1"></div><div class="stars-layer stars-layer-2"></div></div>
<div class="depth-grid"></div>
<div id="title-card" style="opacity:0;transition:opacity 0.6s ease-in;position:fixed;top:0;left:0;width:100%;height:100%;
  background:linear-gradient(180deg,#0d0020 0%,#1a0535 100%);
  z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;">
  ${logoB64 ? `<img src="data:image/png;base64,${logoB64}" style="width:288px;height:auto;object-fit:contain;">` : ''}
  ${storyTitle ? `<div style="color:#fff;font-size:112px;font-weight:800;text-align:center;padding:0 32px;line-height:1.2;font-family:sans-serif;word-break:break-word;">${storyTitle.replace(/</g,'&lt;')}</div>` : ''}
  <div style="position:absolute;bottom:90px;color:rgba(255,255,255,0.6);font-size:64px;font-weight:300;font-family:sans-serif;letter-spacing:12px;">סוף</div>
</div>
<div class="scene">
  <div class="float-wrapper" id="float-wrapper">
    <div class="spin-wrapper" id="spin-wrapper">
      <div class="cube" id="cube">
        <div class="cube-face front"  id="face-0"></div>
        <div class="cube-face back"   id="face-1"></div>
        <div class="cube-face right"  id="face-2"></div>
        <div class="cube-face left"   id="face-3"></div>
        <div class="cube-face top"    id="face-4"></div>
        <div class="cube-face bottom" id="face-5"></div>
      </div>
    </div>
  </div>
</div>
<script>
const videoDurations = ${JSON.stringify(videoDurations)};
const FPS         = ${fps};
const CANVAS_SIZE = ${CS};
const ROTATION_PATH = [
  {faceId:0,rotX:0,  rotY:0},
  {faceId:2,rotX:12, rotY:-90},
  {faceId:1,rotX:-35,rotY:-180},
  {faceId:3,rotX:10, rotY:-270},
];
const HALF_ANGLE = 45;
const imgElements = []; // <img> per face — composites correctly in headless Chrome (unlike <canvas>)
let cumulativeTimes = [], totalDuration = 0;

function init() {
  let t = 0;
  for (let i = 0; i < videoDurations.length; i++) { cumulativeTimes.push(t); t += videoDurations[i]; }
  totalDuration = t;
  [0,1,2,3,4,5].forEach(faceId => {
    const el = document.getElementById('face-'+faceId);
    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;display:block;';
    el.appendChild(img);
    imgElements[faceId] = img;
  });
}

function getFaceForIndex(idx) { return ROTATION_PATH[idx%4].faceId; }
function getTargetRotation(idx) {
  const cycle = Math.floor(idx/4), step = ROTATION_PATH[idx%4];
  return {rotX:step.rotX, rotY:step.rotY-(cycle*360)};
}
function getVideoAtTime(globalTime) {
  for (let i = videoDurations.length-1; i >= 0; i--) {
    if (globalTime >= cumulativeTimes[i]) {
      const lt = globalTime - cumulativeTimes[i];
      if (lt <= videoDurations[i]) return {videoIndex:i, localTime:Math.min(lt, videoDurations[i]-0.01)};
    }
  }
  return {videoIndex:videoDurations.length-1, localTime:videoDurations[videoDurations.length-1]-0.01};
}

// frameBase64: base64-encoded JPEG passed from Node.js via page.evaluate
window.__seekAndDraw = function(globalTime, frameBase64) {
  return new Promise(resolve => {
    if (globalTime >= totalDuration) { resolve({done:true}); return; }
    const {videoIndex, localTime} = getVideoAtTime(globalTime);
    const faceId = getFaceForIndex(videoIndex);

    const finishAndRotate = () => {
      const dur = videoDurations[videoIndex];
      const vp  = dur > 0 ? Math.min(localTime/dur, 1) : 0;
      const from = getTargetRotation(videoIndex), to = getTargetRotation(videoIndex+1);
      const ease = vp < 0.5 ? 2*vp*vp : 1-Math.pow(-2*vp+2,2)/2;
      const rX = from.rotX+(to.rotX-from.rotX)*ease;
      const rY = (from.rotY+HALF_ANGLE)+((to.rotY+HALF_ANGLE)-(from.rotY+HALF_ANGLE))*ease;
      const e  = globalTime;
      const fx = Math.sin(e*.5)*22+Math.sin(e*.3)*13;
      const fy = Math.sin(e*.4+1)*26+Math.cos(e*.25)*16;
      const fz = Math.sin(e*.35+2)*38+Math.cos(e*.2)*20;
      const ds = .95+Math.sin(e*.15)*.22+Math.sin(e*.4+1.5)*.11;
      const dz = Math.sin(e*.18+2)*110+Math.cos(e*.12)*70;
      const spinEl  = document.getElementById('spin-wrapper');
      const floatEl = document.getElementById('float-wrapper');
      if (spinEl)  spinEl.style.transform  = 'rotateX('+rX+'deg) rotateY('+rY+'deg)';
      if (floatEl) floatEl.style.transform = 'translate3d('+fx+'px,'+fy+'px,'+(fz+dz)+'px) scale('+ds+')';
      resolve({done:false, videoIndex, localTime:localTime.toFixed(2), faceId});
    };

    if (frameBase64) {
      const el = imgElements[faceId];
      el.onload = () => { finishAndRotate(); };
      el.onerror = finishAndRotate;
      el.src = 'data:image/jpeg;base64,' + frameBase64;
    } else {
      finishAndRotate();
    }
  });
};
// Fill all 6 faces with thumbnails so no face is ever black.
// thumbs: array of base64 JPEG strings (one per clip). Cycles if fewer than 6.
window.__initFaces = function(thumbs) {
  return new Promise(resolve => {
    if (!thumbs || !thumbs.length) { resolve(); return; }
    let done = 0;
    [0,1,2,3,4,5].forEach(faceId => {
      const b64 = thumbs[faceId % thumbs.length];
      if (!b64) { if (++done === 6) resolve(); return; }
      const el = imgElements[faceId];
      el.onload = () => { if (++done === 6) resolve(); };
      el.onerror = () => { if (++done === 6) resolve(); };
      el.src = 'data:image/jpeg;base64,' + b64;
    });
  });
};
window.__getTotalDuration = function() { return totalDuration; };
window.__showTitle = function() {
  const card = document.getElementById('title-card');
  if (card) card.style.opacity = '1';
};
window.__ready = true;
init();
console.log('READY: image-frames cube, totalDuration='+totalDuration);
</script>
</body></html>`;
}

// ─── Main POC render function ─────────────────────────────────────────────────
/**
 * renderCubePoc(storyId, deps)
 *
 * deps = { firestoreDb, bucket, uploadToFirebase, isAllowedVideoUrl }
 *   All deps are passed explicitly by the endpoint handler — no module-level
 *   global state, no circular imports from video-converter-api.js.
 *
 * Returns { jobId, outputUrl } on success.
 * Throws on any failure (job is marked 'failed' in Firestore before throw).
 */
async function renderCubePoc(storyId, { jobId: preJobId, firestoreDb, bucket, uploadToFirebase, isAllowedVideoUrl }) {
  // ── Gate: feature flag ────────────────────────────────────────────────────
  if (process.env.SERVER_CUBE_RENDER_POC !== 'true') {
    const e = new Error('POC feature flag is disabled');
    e.code = 'POC_DISABLED';
    throw e;
  }

  // ── Gate: process-level race guard ────────────────────────────────────────
  if (_pocActive) {
    const e = new Error('A POC render is already active on this server instance');
    e.code = 'ACTIVE_JOB';
    throw e;
  }

  // ── Gate: Firestore active-job check (handles cross-restart duplicates) ───
  const existingJob = await getActiveJob(firestoreDb);
  if (existingJob) {
    const e = new Error(`Active POC job exists: ${existingJob.jobId} (status: ${existingJob.status})`);
    e.code = 'ACTIVE_JOB';
    e.existingJobId = existingJob.jobId;
    throw e;
  }

  // ── Load story ────────────────────────────────────────────────────────────
  const storySnap = await firestoreDb.collection('stories').doc(storyId).get();
  if (!storySnap.exists) {
    const e = new Error(`Story not found: ${storyId}`);
    e.code = 'STORY_NOT_FOUND';
    throw e;
  }
  const story = storySnap.data();

  // Cube faces: participant reflections only (creator video is NOT included)
  const videoUrls = [];

  // Participant reflections (separate collection)
  const reflSnap = await firestoreDb.collection('reflections')
    .where('storyId', '==', storyId)
    .get();
  for (const doc of reflSnap.docs) {
    const r = doc.data();
    if (r.videoUrl) videoUrls.push(r.videoUrl);
  }

  if (videoUrls.length === 0) {
    const e = new Error('Story has no video clips');
    e.code = 'NO_CLIPS';
    throw e;
  }

  // Security: all URLs must be Firebase Storage
  for (const url of videoUrls) {
    if (!isAllowedVideoUrl(url)) {
      const e = new Error('Story contains a disallowed video URL');
      e.code = 'INVALID_URL';
      throw e;
    }
  }

  // ── Create Firestore job doc ──────────────────────────────────────────────
  const jobId = preJobId || `poc_${storyId}_${Date.now()}`;
  const nowDate = new Date();
  await firestoreDb.collection(POC_COLLECTION).doc(jobId).set({
    jobId,
    storyId,
    format: 'cube-3d',
    status: 'queued',
    createdAt: nowDate,
    updatedAt: nowDate,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    outputUrl: null,
    errorCode: null,
    errorMessage: null,
    inputVideoCount: videoUrls.length,
    inputTotalSizeMb: null,
    inputDownloadDurationMs: null,
    normalizationDurationMs: null,
    renderAndEncodeDurationMs: null,
    totalDurationMs: null,
    frameCount: null,
    outputSizeMb: null,
    outputResolution: `${POC_WIDTH}x${POC_HEIGHT}`,
    outputFps: POC_FPS,
    ffprobeResult: null,
    cleanupStatus: 'pending',
    renderProfile: { width: POC_WIDTH, height: POC_HEIGHT, fps: POC_FPS, crf: POC_CRF, preset: POC_PRESET, screenshot: POC_SCREENSHOT },
  });

  // ── Claim render slot ─────────────────────────────────────────────────────
  _pocActive = true;
  const totalStart = Date.now();

  // Temp directories
  const tmpDir   = path.join(os.tmpdir(), `render_${jobId}`);
  const videosDir = path.join(tmpDir, 'videos');   // raw downloads (preserved)
  const normDir   = path.join(tmpDir, 'norm');     // normalized clips
  const framesDir = path.join(tmpDir, 'frames');   // PNG frames
  const outputPath = path.join(tmpDir, 'output.mp4');

  let heartbeatTimer = null;
  let browser       = null;
  let frameCount    = 0;

  // Write current render stage to the story doc so the client can show real progress
  const updateStoryStage = (stage) => {
    if (firestoreDb && storyId) {
      firestoreDb.collection('stories').doc(storyId).update({ renderStage: stage }).catch(() => {});
    }
  };

  try {
    fs.mkdirSync(videosDir,  { recursive: true });
    fs.mkdirSync(normDir,    { recursive: true });
    fs.mkdirSync(framesDir,  { recursive: true });

    updateStoryStage('downloading');
    await updateJob(firestoreDb, jobId, { status: 'downloading', startedAt: new Date() });

    // ── Disk check ────────────────────────────────────────────────────────
    const diskBefore = await getDiskAvailableBytes();
    console.log(`[POC] Disk available: ${(diskBefore / 1024 / 1024).toFixed(0)} MB`);
    if (diskBefore < MIN_DISK_BYTES) {
      const e = new Error(`Insufficient disk space: ${(diskBefore / 1024 / 1024).toFixed(0)} MB available, need 700 MB`);
      e.code = 'DISK_FULL';
      throw e;
    }

    // ── Download clips (parallel) ─────────────────────────────────────────
    const dlStart = Date.now();
    await Promise.all(videoUrls.map((url, i) =>
      downloadFile(url, path.join(videosDir, `video_${i}.mp4`))
    ));
    let inputTotalSizeMb = 0;
    for (let i = 0; i < videoUrls.length; i++) {
      const mb = fs.statSync(path.join(videosDir, `video_${i}.mp4`)).size / (1024 * 1024);
      inputTotalSizeMb += mb;
      console.log(`[POC] Downloaded clip ${i}: ${mb.toFixed(1)} MB`);
    }
    const inputDownloadDurationMs = Date.now() - dlStart;
    console.log(`[POC] All ${videoUrls.length} clips downloaded in parallel: ${(inputDownloadDurationMs/1000).toFixed(1)}s`);

    updateStoryStage('normalizing');
    await updateJob(firestoreDb, jobId, {
      status: 'normalizing',
      inputDownloadDurationMs,
      inputTotalSizeMb: parseFloat(inputTotalSizeMb.toFixed(2)),
    });

    // ── Normalize clips ───────────────────────────────────────────────────
    const normStart = Date.now();
    const normPaths = [];
    const videoDurations = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const srcPath  = path.join(videosDir, `video_${i}.mp4`);
      const destPath = path.join(normDir,   `norm_${i}.mp4`);
      const srcSizeMb = parseFloat((fs.statSync(srcPath).size / (1024 * 1024)).toFixed(1));
      console.log(`[POC] Normalizing clip ${i}/${videoUrls.length - 1} (${srcSizeMb} MB source)`);
      logMemory(`before-normalize-clip-${i}`);
      const result = await normalizeClip(srcPath, destPath);
      if (!result.ok) {
        const errMsg = `Normalization failed for clip ${i}: ${result.errorMessage || 'unknown FFmpeg error'}`;
        console.error(`[POC] ${errMsg}`);
        // Record clip index and error in Firestore before throwing so diagnostics survive OOM restart
        await updateJob(firestoreDb, jobId, {
          normalizationFailedClipIndex: i,
          normalizationFailedClipSizeMb: srcSizeMb,
          normalizationFailedReason: (result.errorMessage || 'unknown').slice(0, 500),
        }).catch(() => {});
        const e = new Error(errMsg);
        e.code = 'NORMALIZATION_FAILED';
        throw e;
      }
      logMemory(`after-normalize-clip-${i}`);
      console.log(`[POC] Normalized clip ${i}: hasAudio=${result.hasAudio} outputSize=${result.sizeMb} MB`);
      normPaths.push(destPath);
      const dur = getVideoDuration(destPath);
      videoDurations.push(dur > 0 ? dur : 5);
      console.log(`[POC] Clip ${i} duration: ${videoDurations[i].toFixed(2)}s`);
    }
    const normalizationDurationMs = Date.now() - normStart;

    // Duration gate
    const totalInputDuration = videoDurations.reduce((s, d) => s + d, 0);
    console.log(`[POC] Total story duration: ${totalInputDuration.toFixed(1)}s (limit: ${MAX_STORY_DURATION_SECS}s)`);
    if (totalInputDuration > MAX_STORY_DURATION_SECS) {
      const e = new Error(
        `Story too long for first POC: ${totalInputDuration.toFixed(1)}s > ${MAX_STORY_DURATION_SECS}s. ` +
        'Use a story with shorter clips for the first test.'
      );
      e.code = 'DURATION_EXCEEDED';
      throw e;
    }

    // Disk check before rendering
    const diskMid = await getDiskAvailableBytes();
    console.log(`[POC] Disk before render: ${(diskMid / 1024 / 1024).toFixed(0)} MB`);
    if (diskMid < MIN_DISK_BYTES) {
      const e = new Error(`Insufficient disk before render: ${(diskMid / 1024 / 1024).toFixed(0)} MB`);
      e.code = 'DISK_FULL';
      throw e;
    }

    updateStoryStage('rendering');
    await updateJob(firestoreDb, jobId, { status: 'rendering', normalizationDurationMs });

    // ── Extract frame sequences from normalized clips ──────────────────────
    // ctx.drawImage(<video>) returns black in headless Chrome without GPU.
    // ctx.drawImage(<img>) always works — so we pre-extract frames via FFmpeg.
    const frameCounts = [];
    for (let i = 0; i < normPaths.length; i++) {
      const vfDir = path.join(tmpDir, `vframes_${i}`);
      fs.mkdirSync(vfDir, { recursive: true });
      execSync(
        `ffmpeg -y -i "${normPaths[i]}" -vf fps=${POC_FPS} -q:v 3 "${path.join(vfDir, 'f_%06d.jpg')}"`,
        { timeout: 180000, stdio: 'pipe' }
      );
      const count = fs.readdirSync(vfDir).filter(f => f.endsWith('.jpg')).length;
      frameCounts.push(count);
      console.log(`[POC] Extracted ${count} frames from clip ${i}`);
    }

    // Cumulative start times (mirrors browser-side logic, used in frame loop)
    const cumulativeTimes = [];
    let cumT = 0;
    for (const d of videoDurations) { cumulativeTimes.push(cumT); cumT += d; }

    // ── Chromium / Puppeteer ──────────────────────────────────────────────
    if (!puppeteer) {
      const e = new Error('puppeteer is not installed on this server');
      e.code = 'NO_CHROMIUM';
      throw e;
    }
    // Full puppeteer package ships its own Chrome — use it.
    // Fall back to findChromium() only for local dev (puppeteer-core / system Chrome).
    const chromiumPath = (typeof puppeteer.executablePath === 'function')
      ? puppeteer.executablePath()
      : findChromium();
    if (!chromiumPath) {
      const e = new Error('Chromium executable not found');
      e.code = 'NO_CHROMIUM';
      throw e;
    }

    logMemory('before-chromium-launch');
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: 'new',
      args: [
        // Sandbox / GPU
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // Memory-saving: disable subsystems not needed for frame capture
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-component-update',
        '--no-first-run',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--mute-audio',
        '--metrics-recording-only',
        // Playback
        '--autoplay-policy=no-user-gesture-required',
        '--disable-web-security',
        `--window-size=${POC_WIDTH},${POC_HEIGHT}`,
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: POC_WIDTH, height: POC_HEIGHT });
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
    page.on('pageerror', err => console.error(`[Browser Error] ${err.message}`));

    // Background: use story's background URL if available (image only for POC;
    // video background may not render reliably without GPU — treated as best-effort)
    const bgUrl = story.backgroundVideoUrl || story.backgroundUrl || null;
    const storyTitle = story.title || story.storyName || story.name || '';
    const logoPath = path.join(__dirname, '../../assets/rilio-logo-primary.png.png');
    const logoB64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    if (logoB64) console.log('[POC] Logo loaded for title card');
    const html = generateCubeHtmlFromFrames(videoDurations, POC_FPS, bgUrl, logoB64, storyTitle);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

    try {
      await page.waitForFunction('window.__ready === true', { timeout: 60000 });
      console.log('[POC] All videos loaded in browser');
    } catch { console.log('[POC] Video load timeout — proceeding anyway'); }

    const animDuration = await page.evaluate(() => window.__getTotalDuration());
    console.log(`[POC] Cube animation duration: ${animDuration.toFixed(2)}s`);

    // Initialize all 6 cube faces with a thumbnail from each clip (no black faces).
    // 1 clip → same thumbnail on all 6. Multiple clips → distributed across faces.
    const thumbnailB64s = normPaths.map((_, i) => {
      const f = path.join(tmpDir, `vframes_${i}`, 'f_000001.jpg');
      return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : '';
    }).filter(Boolean);
    if (thumbnailB64s.length > 0) {
      await page.evaluate((thumbs) => window.__initFaces(thumbs), thumbnailB64s);
      console.log(`[POC] Initialized 6 cube faces with ${thumbnailB64s.length} thumbnail(s)`);
    }

    const totalFrames = Math.ceil(animDuration * POC_FPS) + POC_FPS * 2; // +2s tail
    const cdpSession = await page.createCDPSession();
    const renderStart = Date.now();

    // Heartbeat: keep updatedAt fresh so stale-job detection doesn't block
    // future tests if this render takes a long time.
    // frameCount is read by reference from the outer scope.
    heartbeatTimer = setInterval(() => {
      updateJob(firestoreDb, jobId, { frameCount }).catch(() => {});
    }, 30000);

    // ── Frame capture loop ────────────────────────────────────────────────
    for (let f = 0; f < totalFrames; f++) {
      const globalTime = f / POC_FPS;

      // Compute frame path in Node.js and pass as base64 to avoid
      // Chrome null-origin → localhost HTTP blocking
      const { videoIndex, localTime } = getVideoAtTimeNode(globalTime, videoDurations, cumulativeTimes);
      const frameIdx  = Math.max(0, Math.min(frameCounts[videoIndex] - 1, Math.floor(localTime * POC_FPS)));
      const frameFile = path.join(tmpDir, `vframes_${videoIndex}`, `f_${String(frameIdx + 1).padStart(6, '0')}.jpg`);
      const frameB64  = fs.existsSync(frameFile) ? fs.readFileSync(frameFile).toString('base64') : '';

      const result = await page.evaluate((t, b64) => window.__seekAndDraw(t, b64), globalTime, frameB64);

      const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.jpg`);
      const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(framePath, Buffer.from(data, 'base64'));
      frameCount++;

      if (frameCount % 50 === 0) logMemory(`frame-${frameCount}`);

      if (result.done) {
        // Show title card (logo + story name) for 2 seconds at the end
        await page.evaluate(() => window.__showTitle());
        await new Promise(r => setTimeout(r, 150)); // allow opacity transition to start
        for (let x = 0; x < POC_FPS * 2; x++) {
          const { data: titleData } = await cdpSession.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
          const tailPath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.jpg`);
          fs.writeFileSync(tailPath, Buffer.from(titleData, 'base64'));
          frameCount++;
        }
        console.log('[POC] Title card captured');
        break;
      }
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    await cdpSession.detach();
    await browser.close();
    browser = null;
    logMemory('after-browser-close');

    console.log(`[POC] Captured ${frameCount} frames (${(frameCount / POC_FPS).toFixed(1)}s)`);
    if (frameCount < 10) {
      const e = new Error('Too few frames captured — render likely failed silently');
      e.code = 'CAPTURE_FAILED';
      throw e;
    }

    updateStoryStage('encoding');
    await updateJob(firestoreDb, jobId, { status: 'encoding', frameCount });

    // ── Audio assembly ────────────────────────────────────────────────────
    // Concat normalized clips for audio; -an clips contribute silence (concat handles gracefully).
    const audioPath = path.join(tmpDir, 'audio.aac');
    let hasAudio = false;
    try {
      const concatList = path.join(tmpDir, 'audio-concat.txt');
      const lines = normPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(concatList, lines);
      const audioDurationSecs = frameCount / POC_FPS;
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatList}" -vn -c:a aac -b:a 128k -t ${audioDurationSecs} "${audioPath}"`,
        { timeout: 60000 }
      );
      hasAudio = fs.existsSync(audioPath) && fs.statSync(audioPath).size > 100;
    } catch (e) {
      console.log('[POC] Audio extraction skipped:', e.message.slice(0, 200));
    }

    // ── FFmpeg encode at POC quality ──────────────────────────────────────
    const inputPattern = path.join(framesDir, 'frame_%06d.jpg');
    const videoArgsParts = [
      '-c:v', 'libx264',
      '-preset', POC_PRESET,
      '-crf', String(POC_CRF),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-vf', `scale=${POC_WIDTH}:${POC_HEIGHT}`,
    ];
    let ffmpegCmd;
    if (hasAudio) {
      ffmpegCmd = [
        'ffmpeg -y',
        `-framerate ${POC_FPS} -i "${inputPattern}"`,
        `-i "${audioPath}"`,
        videoArgsParts.join(' '),
        '-c:a aac -b:a 128k -shortest',
        `"${outputPath}"`,
      ].join(' ');
    } else {
      ffmpegCmd = [
        'ffmpeg -y',
        `-framerate ${POC_FPS} -i "${inputPattern}"`,
        videoArgsParts.join(' '),
        `"${outputPath}"`,
      ].join(' ');
    }
    logMemory('before-ffmpeg');
    execSync(ffmpegCmd, { timeout: 300000 });

    // Delete frames immediately after encoding — free disk before upload
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { }
    console.log('[POC] Frames directory deleted after encoding');
    logMemory('after-frames-deleted');

    const renderAndEncodeDurationMs = Date.now() - renderStart;

    // ── Output validation ─────────────────────────────────────────────────
    updateStoryStage('uploading');
    await updateJob(firestoreDb, jobId, { status: 'uploading', renderAndEncodeDurationMs });
    const validation = validateOutput(outputPath, animDuration);
    console.log('[POC] Validation result:', validation.ok ? '✅ PASS' : `❌ FAIL: ${validation.reason}`);
    if (!validation.ok) {
      const e = new Error(`Output validation failed: ${validation.reason}`);
      e.code = 'VALIDATION_FAILED';
      throw e;
    }

    // ── Upload to separate POC storage path ───────────────────────────────
    // NEVER writes to edited/ or touches stories/{storyId}.finalVideoUrl
    const storagePath = `poc-renders/${storyId}/${jobId}/cube-poc.mp4`;
    let outputUrl;
    if (bucket) {
      outputUrl = await uploadToFirebase(outputPath, storagePath);
    } else {
      // Local dev fallback only
      const localFallback = path.join(os.tmpdir(), `${jobId}_result.mp4`);
      fs.copyFileSync(outputPath, localFallback);
      outputUrl = `file://${localFallback}`;
      console.log('[POC] No Firebase bucket — saved locally:', localFallback);
    }

    const totalDurationMs = Date.now() - totalStart;
    const outputSizeMb = parseFloat((fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2));

    // Cleanup remaining temp files (videos, norm, audio — frames already deleted)
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    logMemory('after-total-cleanup');

    await updateJob(firestoreDb, jobId, {
      status: 'completed',
      completedAt: new Date(),
      outputUrl,
      totalDurationMs,
      renderAndEncodeDurationMs,
      normalizationDurationMs,
      frameCount,
      outputSizeMb,
      ffprobeResult: validation.probeJson || null,
      cleanupStatus: 'done',
    });

    console.log(`[POC] ✅ Done — jobId=${jobId} url=${outputUrl} total=${totalDurationMs}ms`);
    return { jobId, outputUrl, generatedMusicUrl: story.generatedMusicUrl || null };

  } catch (err) {
    console.error('[POC] ❌ Render failed:', err.code || 'UNKNOWN', err.message);
    const totalDurationMs = Date.now() - totalStart;

    await updateJob(firestoreDb, jobId, {
      status: 'failed',
      failedAt: new Date(),
      errorCode: err.code || 'UNKNOWN',
      errorMessage: err.message?.slice(0, 500) || 'unknown error',
      totalDurationMs,
    }).catch(() => {});

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    await updateJob(firestoreDb, jobId, { cleanupStatus: 'done' }).catch(() => {});

    throw err;

  } finally {
    _pocActive = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (browser) { try { await browser.close(); } catch { } }
  }
}

module.exports = { renderCubePoc, POC_COLLECTION };
