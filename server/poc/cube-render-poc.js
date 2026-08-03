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
  startLocalVideoServer,
  generateCubeHTML,
} = require('../format-renderer');

// ─── POC quality profile ──────────────────────────────────────────────────────
// These settings apply ONLY to POC renders. format-renderer.js defaults are
// unchanged (540×960, 12fps, jpeg, crf26, ultrafast).
const POC_WIDTH      = 720;
const POC_HEIGHT     = 1280;
const POC_FPS        = 24;
const POC_CRF        = 20;
const POC_PRESET     = 'fast';
const POC_SCREENSHOT = 'png'; // lossless per-frame capture

// ─── Safety limits ────────────────────────────────────────────────────────────
const MAX_STORY_DURATION_SECS = 120; // max story length for server render
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

  // Creator clip
  const videoUrls = [];
  const creatorUrl = story.videoUri || story.videoUrl || null;
  if (creatorUrl) videoUrls.push(creatorUrl);

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
  let localServer   = null;
  let frameCount    = 0;

  try {
    fs.mkdirSync(videosDir,  { recursive: true });
    fs.mkdirSync(normDir,    { recursive: true });
    fs.mkdirSync(framesDir,  { recursive: true });

    await updateJob(firestoreDb, jobId, { status: 'downloading', startedAt: new Date() });

    // ── Disk check ────────────────────────────────────────────────────────
    const diskBefore = await getDiskAvailableBytes();
    console.log(`[POC] Disk available: ${(diskBefore / 1024 / 1024).toFixed(0)} MB`);
    if (diskBefore < MIN_DISK_BYTES) {
      const e = new Error(`Insufficient disk space: ${(diskBefore / 1024 / 1024).toFixed(0)} MB available, need 700 MB`);
      e.code = 'DISK_FULL';
      throw e;
    }

    // ── Download clips ────────────────────────────────────────────────────
    const dlStart = Date.now();
    let inputTotalSizeMb = 0;
    for (let i = 0; i < videoUrls.length; i++) {
      const destPath = path.join(videosDir, `video_${i}.mp4`);
      await downloadFile(videoUrls[i], destPath);
      const mb = fs.statSync(destPath).size / (1024 * 1024);
      inputTotalSizeMb += mb;
      console.log(`[POC] Downloaded clip ${i}: ${mb.toFixed(1)} MB`);
    }
    const inputDownloadDurationMs = Date.now() - dlStart;

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

    await updateJob(firestoreDb, jobId, { status: 'rendering', normalizationDurationMs });

    // ── Local video server for normalized clips ────────────────────────────
    const localPort = 9200 + Math.floor(Math.random() * 700);
    localServer = await startLocalVideoServer(normDir, localPort);
    const localUrls = normPaths.map((_, i) => `http://127.0.0.1:${localPort}/norm_${i}.mp4`);

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
        // Limit V8 old-space to reduce peak heap
        '--js-flags=--max-old-space-size=128',
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
    const html = generateCubeHTML(localUrls, videoDurations, bgUrl);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

    try {
      await page.waitForFunction('window.__ready === true', { timeout: 60000 });
      console.log('[POC] All videos loaded in browser');
    } catch { console.log('[POC] Video load timeout — proceeding anyway'); }

    const animDuration = await page.evaluate(() => window.__getTotalDuration());
    console.log(`[POC] Cube animation duration: ${animDuration.toFixed(2)}s`);

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
      const result = await page.evaluate(async (t) => window.__seekAndDraw(t), globalTime);

      const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.png`);
      const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(framePath, Buffer.from(data, 'base64'));
      frameCount++;

      if (frameCount % 50 === 0) logMemory(`frame-${frameCount}`);

      if (result.done) {
        // Append 1-second still tail so the final frame is visible
        const tailData = data;
        for (let x = 0; x < POC_FPS; x++) {
          const tailPath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.png`);
          fs.writeFileSync(tailPath, Buffer.from(tailData, 'base64'));
          frameCount++;
        }
        break;
      }
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    await cdpSession.detach();
    await browser.close();
    browser = null;
    localServer.close();
    localServer = null;
    logMemory('after-browser-close');

    console.log(`[POC] Captured ${frameCount} frames (${(frameCount / POC_FPS).toFixed(1)}s)`);
    if (frameCount < 10) {
      const e = new Error('Too few frames captured — render likely failed silently');
      e.code = 'CAPTURE_FAILED';
      throw e;
    }

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
    const inputPattern = path.join(framesDir, 'frame_%06d.png');
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
    if (localServer) { try { localServer.close(); } catch { } }
  }
}

module.exports = { renderCubePoc, POC_COLLECTION };
