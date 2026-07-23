// Prevent unhandled errors from crashing the process
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException (server stays alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection (server stays alive):', reason?.message || reason);
});

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Expo } = require('expo-server-sdk');
const expoClient = new Expo();
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');
const { ConversionQueue } = require('./conversion-queue');
const { renderFormatVideo, cleanupRenderDir } = require('./format-renderer');
const { buildWebRecordHtml } = require('./web-record-template');

const app = express();

const MAX_CONCURRENT_CONVERSIONS = parseInt(process.env.MAX_CONCURRENT_CONVERSIONS) || 3;
const conversionQueue = new ConversionQueue({ maxConcurrent: MAX_CONCURRENT_CONVERSIONS });
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'https://reflectlymobilex.onrender.com',
  'https://rilio.io',
  'https://www.rilio.io',
  // local development
  'http://localhost:3001',
  'http://localhost:19006',
  'http://localhost:8081',
];
const _corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false); // reject without throwing — handled below
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-app-access-code'],
});
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  _corsMiddleware(req, res, next);
});
app.use(express.json());

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const ACCESS_CODE = process.env.ACCESS_CODE || '';

const tempDir = path.join(os.tmpdir(), 'reflectly-server', 'uploads');
const convertedDir = path.join(os.tmpdir(), 'reflectly-server', 'converted');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });
const upload = multer({ dest: tempDir, limits: { fileSize: 100 * 1024 * 1024 } });

const PUBLIC_ROUTES = ['/health', '/api/maintenance-status', '/api/verify-access', '/api/convert-from-url', '/api/convert-url', '/api/queue', '/converted', '/api/stories', '/api/render-status', '/api/generate-music', '/api/music-status', '/join', '/record', '/record-invite', '/invite', '/api/upload-player-clip', '/api/player-upload-url', '/api/player-clip-done', '/api/notify-reflection', '/api/ambient-track', '/api/suno-sets', '/api/test-mix', '/api/delete-story', '/api/delete-account', '/api/support', '/api/invitations', '/privacy', '/terms', '/support', '/assets'];

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for upload endpoints (no extra dependency)
// ---------------------------------------------------------------------------
const _uploadRateBuckets = new Map(); // ip -> { count, resetAt }
const UPLOAD_RATE_LIMIT   = 10;
const UPLOAD_RATE_WINDOW  = 60 * 60 * 1000; // 1 hour

function checkUploadRateLimit(ip) {
  const now   = Date.now();
  const entry = _uploadRateBuckets.get(ip);
  if (!entry || now > entry.resetAt) {
    _uploadRateBuckets.set(ip, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW });
    return true;
  }
  if (entry.count >= UPLOAD_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Purge stale entries every hour so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _uploadRateBuckets) {
    if (now > entry.resetAt) _uploadRateBuckets.delete(ip);
  }
}, UPLOAD_RATE_WINDOW);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm',
  'video/x-msvideo', 'video/3gpp', 'video/mpeg',
  'application/octet-stream', // iOS sometimes sends this for .mov
]);

function isValidStoragePath(p) {
  return typeof p === 'string'
    && /^stories\/[a-zA-Z0-9_-]{1,128}\/.+/.test(p)
    && !p.includes('..');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const accessControlMiddleware = (req, res, next) => {
  if (PUBLIC_ROUTES.some(route => req.path === route || req.path.startsWith(route))) {
    return next();
  }
  
  if (MAINTENANCE_MODE) {
    return res.status(503).json({ error: 'Service under maintenance' });
  }
  
  const providedCode = req.headers['x-app-access-code'];
  
  if (!ACCESS_CODE) {
    return next();
  }
  
  if (!providedCode || providedCode !== ACCESS_CODE) {
    return res.status(403).json({ error: 'Access denied - invalid or missing access code' });
  }
  
  next();
};

app.get('/', (req, res) => {
  res.status(200).send('Reflectly server is live');
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// ─── Legal / Public pages ─────────────────────────────────────────────────────
// Served at rilio.io/privacy (and reflectlymobilex.onrender.com/privacy for staging).
// Source files live in /web/ at repo root — referenced relative to server/ with '../web/'.

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'privacy.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'support.html'));
});

// Static assets (logo, background images) served from project root /assets/
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Simple in-memory rate limiter: max 5 support emails per IP per hour
const _supportRateMap = new Map();
function _supportRateOk(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _supportRateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) { _supportRateMap.set(ip, { count: 1, start: now }); return true; }
  if (entry.count >= 5) return false;
  entry.count++;
  _supportRateMap.set(ip, entry);
  return true;
}

app.post('/api/support', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!_supportRateOk(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { name, email, subject, message } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'A valid email address is required.' });
  if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required.' });

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Support email not configured: GMAIL_USER / GMAIL_APP_PASSWORD missing');
    return res.status(500).json({ error: 'Email service is not configured. Please contact us at yaronbenm1@gmail.com.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"Rilio Support" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      subject: `[Rilio Support] ${(subject || 'Rilio Support').trim()}`,
      text: `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
      html: `<p><strong>Name:</strong> ${name.trim()}</p><p><strong>Email:</strong> ${email.trim()}</p><hr/><p>${message.trim().replace(/\n/g, '<br/>')}</p>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Support email send failed:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again or email us directly at yaronbenm1@gmail.com.' });
  }
});

// Invitation landing page — loads story from Firestore, dark cinematic design, OG tags for WhatsApp
app.get('/join/:storyId', async (req, res) => {
  const { storyId } = req.params;
  const BASE_URL = 'https://reflectlymobilex.onrender.com';

  let creatorName = 'מישהו';
  let storyTitle = 'סיפור';

  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('stories').doc(storyId).get();
      if (snap.exists) {
        const data = snap.data();
        creatorName = data.creatorName || data.userName || creatorName;
        storyTitle  = data.storyTitle  || data.title    || storyTitle;
      }
    } catch (e) {
      console.warn('Could not load story for /join/:', e.message);
    }
  }

  const ogImage = `${BASE_URL}/assets/home-bg-poster.jpg`;
  const ogTitle = `${creatorName} מזמין אותך לסיפור: ${storyTitle}`;
  const ogDesc  = 'הקלט את התגובה שלך ב-60 שניות — כי המילים שלך חשובות.';
  const recordUrl = `${BASE_URL}/record/${storyId}`;

  res.set('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${ogTitle}</title>

  <!-- Open Graph / WhatsApp -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${BASE_URL}/join/${storyId}">
  <meta property="og:title"       content="${ogTitle}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:image"       content="${ogImage}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #040c18;
      color: #fff;
      overflow-x: hidden;
    }

    /* Fullscreen background */
    .bg {
      position: fixed; inset: 0;
      background: url('/assets/home-bg-poster.jpg') center/cover no-repeat;
      z-index: 0;
    }
    .bg::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(4, 12, 24, 0.55) 0%,
        rgba(4, 12, 24, 0.70) 50%,
        rgba(4, 12, 24, 0.92) 100%
      );
    }

    /* Content layer */
    .page {
      position: relative; z-index: 1;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 24px 60px;
      text-align: center;
    }

    /* Logo */
    .logo-wrap { margin-bottom: 32px; }
    .logo-wrap img { height: 36px; opacity: 0.92; }

    /* Invitation text */
    .invite-label {
      font-size: 13px; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.45);
      margin-bottom: 10px;
    }
    .creator-name {
      font-size: 28px; font-weight: 700; line-height: 1.2;
      color: #fff; margin-bottom: 6px;
    }
    .story-title {
      font-size: 16px; font-weight: 300; color: rgba(255,255,255,0.70);
      margin-bottom: 12px; max-width: 300px;
    }
    .record-hint {
      font-size: 13px; color: rgba(255,255,255,0.38);
      margin-bottom: 36px; max-width: 260px; line-height: 1.5;
    }

    /* Primary CTA */
    .cta-btn {
      display: block;
      width: 100%; max-width: 320px;
      padding: 18px 24px;
      border-radius: 14px;
      font-size: 17px; font-weight: 700;
      text-decoration: none; color: #040c18;
      background: linear-gradient(135deg, #7ecfe0 0%, #5ab4cc 100%);
      box-shadow: 0 6px 32px rgba(94,190,218,0.40);
      margin-bottom: 14px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .cta-btn:active { transform: scale(0.97); box-shadow: 0 3px 16px rgba(94,190,218,0.30); }

    /* Secondary (app deep link) */
    .secondary-link {
      display: block;
      font-size: 13px; color: rgba(255,255,255,0.45);
      text-decoration: none; margin-top: 6px;
      padding: 8px 0;
    }
    .secondary-link:hover { color: rgba(255,255,255,0.70); }

    /* Tagline at bottom */
    .tagline {
      position: fixed; bottom: 24px;
      font-size: 11px; color: rgba(255,255,255,0.22);
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <div class="bg"></div>

  <div class="page">
    <div class="logo-wrap">
      <img src="/assets/rilio-logo-primary.png.png" alt="RILIO">
    </div>

    <p class="invite-label">הוזמנת</p>
    <h1 class="creator-name">${escapeHtml(creatorName)}</h1>
    <p class="story-title">מזמין אותך לסיפור: <strong>${escapeHtml(storyTitle)}</strong></p>
    <p class="record-hint">תצלם קליפ קצר שיהפוך לחלק מהסרט הסופי</p>

    <a class="cta-btn" href="${recordUrl}">הצטרף לסיפור</a>
    <a class="secondary-link" href="reflectly://s/${storyId}">יש לי את האפליקציה ←</a>
  </div>

  <span class="tagline">RILIO &nbsp;·&nbsp; rilio.io</span>
</body>
</html>`);
});

// Web recording page — participant records directly in the browser, no app needed
app.get('/record/:storyId', async (req, res) => {
  const { storyId } = req.params;

  let story = null;
  if (firestoreDb) {
    try {
      const snap = await firestoreDb.collection('stories').doc(storyId).get();
      if (snap.exists) story = { id: snap.id, ...snap.data() };
    } catch (e) {
      console.warn('Could not load story for web-record:', e.message);
    }
  }

  if (!story) {
    return res.status(404).send('סיפור לא נמצא');
  }

  const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  const musicTrackId = story.musicAmbient?.id || (
    story.music && story.music !== 'none' && story.music !== 'ai-generated' ? story.music : null
  );
  let musicUrl = story.musicAmbient?.url || null;

  // If musicUrl is missing but lockedSet is known, look up first track URL from suno_tracks
  if (!musicUrl && story.lockedSet != null && firestoreDb) {
    try {
      const snap = await firestoreDb.collection('suno_tracks')
        .where('set', '==', story.lockedSet).limit(5).get();
      const tracks = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.url)
        .sort((a, b) => (a.posInSet || 0) - (b.posInSet || 0));
      if (tracks.length) {
        musicUrl = tracks[0].url;
        // Patch story in Firestore so native app also benefits next load
        firestoreDb.collection('stories').doc(story.id).update({
          'musicAmbient.url': musicUrl,
          'musicAmbient.previewTrackId': tracks[0].id,
        }).catch(() => {});
        console.log(`🎵 Auto-filled musicUrl for lockedSet ${story.lockedSet}: ${musicUrl.substring(0, 60)}`);
      }
    } catch (e) {
      console.warn('Could not auto-fill musicUrl:', e.message);
    }
  }

  const storyData = {
    id:             story.id,
    name:           story.name           || 'סיפור',
    creatorName:    story.creatorName    || '',
    clipCount:      story.clipCount      || 3,
    maxClipDuration:story.maxClipDuration|| 60,
    instructions:   story.instructions  || '',
    videoUri:       story.videoUri || story.videoUrl || story.keyStoryUrl || null,
    instructionAudioUrl: story.instructionAudioUrl || null,
    musicUrl,
    musicTrackId,
    hasMusic:       !!(musicUrl || musicTrackId),
    musicName:      story.musicAmbient?.nameHe || story.musicAmbient?.name || null,
    lockedSet:      story.lockedSet || null,
  };

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(buildWebRecordHtml(storyData, firebaseConfig));
});

// Upload a player clip via server (bypasses Firebase Storage rules for unauthenticated browsers)
app.post('/api/upload-player-clip', upload.single('video'), async (req, res) => {
  // Rate limit: 10 uploads/IP/hour
  const uploaderIp = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkUploadRateLimit(uploaderIp)) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(429).json({ error: 'Too many uploads — please try again later' });
  }

  if (!req.file) return res.status(400).json({ error: 'No video file' });

  // MIME type validation
  const fileMime = req.file.mimetype || '';
  if (!ALLOWED_VIDEO_MIMES.has(fileMime)) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(415).json({ error: 'Only video files are accepted' });
  }

  const { storyId, playerName, clipNumber = '1', webUid, participantId } = req.body;
  if (!storyId) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'storyId required' }); }
  if (!bucket) { fs.unlinkSync(req.file.path); return res.status(503).json({ error: 'Storage not configured' }); }

  const tempPath = req.file.path;
  const origName = req.file.originalname || '';
  const ext = origName.endsWith('.mp4') ? 'mp4' : origName.endsWith('.mov') ? 'mov' : 'webm';
  const pid = participantId || webUid || ('native_' + Date.now());
  const storagePath = `stories/${storyId}/players/${pid}/video${clipNumber}_${Date.now()}.${ext}`;

  // Respond immediately — player can close the app now
  res.json({ success: true, pending: true });

  // Process upload + Firestore in background (non-blocking)
  setImmediate(async () => {
    try {
      const contentType = ext === 'mp4' ? 'video/mp4' : ext === 'mov' ? 'video/quicktime' : 'video/webm';
      await bucket.upload(tempPath, { destination: storagePath, metadata: { contentType } });
      await bucket.file(storagePath).makePublic();
      const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      if (firestoreDb) {
        await firestoreDb.collection('reflections').add({
          storyId,
          videoUrl:        downloadUrl,
          convertedUrl:    null,
          conversionStatus:'pending',
          playerName:      playerName || 'משתתף',
          participantName: playerName || 'משתתף',
          participantId:   pid,
          uid:             webUid || pid,
          clipNumber:      parseInt(clipNumber, 10),
          source:          'native',
          status:          'pending',
          createdAt:       new Date(),
        });
        firestoreDb.collection('stories').doc(storyId).update({
          pendingReflectionsCount: FieldValue.increment(1),
        }).catch(() => {});
      }

      sendCreatorNotification(storyId, playerName || null).catch(() => {});
      console.log(`✅ Player clip uploaded (bg): ${storagePath}`);
    } catch (err) {
      console.error('❌ upload-player-clip bg failed:', err.message);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    }
  });
});

// Generate a signed URL so the browser can PUT directly to GCS (no double-hop through Render)
app.get('/api/player-upload-url', async (req, res) => {
  const { storyId, clipNumber = '1', webUid, contentType = 'video/webm' } = req.query;
  if (!storyId) return res.status(400).json({ error: 'storyId required' });
  if (!bucket) return res.status(503).json({ error: 'Storage not configured' });

  const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
  const uid = webUid || ('web_' + Date.now());
  const storagePath = `stories/${storyId}/players/${uid}/video${clipNumber}_${Date.now()}.${ext}`;

  try {
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 3600 * 1000,
      contentType,
    });
    res.json({ signedUrl, storagePath });
  } catch (err) {
    console.error('getSignedUrl failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Called after direct GCS upload — makes file public and saves reflection to Firestore
app.post('/api/player-clip-done', async (req, res) => {
  const { storyId, storagePath, playerName, clipNumber, webUid } = req.body;
  if (!storyId || !storagePath) return res.status(400).json({ error: 'storyId and storagePath required' });

  // Validate storagePath to prevent making arbitrary GCS objects public
  if (!isValidStoragePath(storagePath)) {
    return res.status(400).json({ error: 'Invalid storage path' });
  }

  // Rate limit
  const callerIp = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkUploadRateLimit(callerIp)) {
    return res.status(429).json({ error: 'Too many requests — please try again later' });
  }

  try {
    if (bucket) {
      await bucket.file(storagePath).makePublic();
    }
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    if (firestoreDb) {
      await firestoreDb.collection('reflections').add({
        storyId,
        videoUrl:        downloadUrl,
        playerName:      playerName || 'משתתף',
        participantName: playerName || 'משתתף',
        uid:             webUid || 'web_anonymous',
        clipNumber:      parseInt(clipNumber, 10) || 1,
        source:          'web',
        createdAt:       new Date(),
      });
      firestoreDb.collection('stories').doc(storyId).update({
        pendingReflectionsCount: FieldValue.increment(1),
        lastPlayerName: playerName || 'משתתף',
      }).catch(() => {});
    }

    // Notify story creator (fire-and-forget)
    sendCreatorNotification(storyId, playerName || null).catch(() => {});

    console.log(`✅ Player clip done (direct upload): ${storagePath}`);
    res.json({ success: true, url: downloadUrl });
  } catch (err) {
    console.error('❌ player-clip-done failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Native app calls this after uploading player clips so server notifies the creator
app.post('/api/notify-reflection', async (req, res) => {
  const { storyId, playerName } = req.body;
  if (!storyId) return res.status(400).json({ error: 'storyId required' });
  sendCreatorNotification(storyId, playerName || null).catch(() => {});
  res.json({ ok: true });
});

app.get('/api/maintenance-status', (req, res) => {
  res.json({ 
    maintenance: MAINTENANCE_MODE,
    requiresCode: !!ACCESS_CODE && !MAINTENANCE_MODE
  });
});

app.post('/api/verify-access', (req, res) => {
  const { code } = req.body;
  
  if (MAINTENANCE_MODE) {
    return res.json({ valid: false, maintenance: true });
  }
  
  if (!ACCESS_CODE) {
    return res.json({ valid: true });
  }
  
  const isValid = code === ACCESS_CODE;
  res.json({ valid: isValid });
});

// Serve admin HTML before access control so the page itself loads without a header
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve web player static assets at root (before access control — players are unauthenticated)
// index.html uses absolute paths like /app.js, /config.js — must be at root
const webPlayerDir = path.join(__dirname, '..', 'web-player');
app.use(express.static(webPlayerDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
// Handle /s/:storyId deep links → serve index.html (no-cache so users always get latest)
app.get('/s/:storyId', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(webPlayerDir, 'index.html'));
});

// Proxy creator video for web player (no auth needed — players are unauthenticated)
app.get('/proxy-video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url' });
  try {
    const https = require('https');
    const http = require('http');
    const parsed = new URL(videoUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;
    // Forward Range header so iOS Safari can seek/stream video properly (206 Partial Content)
    const upstreamHeaders = { 'User-Agent': 'Mozilla/5.0' };
    if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

    const proxyReq = protocol.get(videoUrl, { headers: upstreamHeaders }, (proxyRes) => {
      const outHeaders = {
        'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      };
      if (proxyRes.headers['content-length']) outHeaders['Content-Length'] = proxyRes.headers['content-length'];
      if (proxyRes.headers['content-range']) outHeaders['Content-Range'] = proxyRes.headers['content-range'];
      res.writeHead(proxyRes.statusCode, outHeaders);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      console.error('proxy-video error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch video' });
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid URL' });
  }
});

app.use(accessControlMiddleware);


let bucket = null;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token"
    };

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET
    });

    const storage = getStorage();
    bucket = storage.bucket();
    console.log('Firebase Storage initialized for video converter');
    // Configure CORS so browsers can PUT directly to GCS via signed URLs
    bucket.setMetadata({
      cors: [{
        origin: ['*'],
        method: ['PUT', 'GET', 'HEAD'],
        responseHeader: ['Content-Type', 'Content-Length'],
        maxAgeSeconds: 3600,
      }],
    }).catch(e => console.warn('CORS set (non-fatal):', e.message));
  } else {
    console.log('Firebase credentials not found - using local storage only');
  }
} catch (error) {
  console.log('Firebase initialization failed:', error.message);
}

let firestoreDb = null;
try {
  firestoreDb = getFirestore();
  console.log('Firestore initialized for video converter');
} catch (error) {
  console.log('Firestore initialization skipped:', error.message);
}

let adminAuth = null;
try {
  adminAuth = getAdminAuth();
  console.log('Firebase Admin Auth initialized');
} catch (error) {
  console.log('Firebase Admin Auth initialization skipped:', error.message);
}

function needsConversion(mimeType, filename) {
  const incompatibleTypes = [
    'video/quicktime',
    'video/x-m4v',
    'video/hevc'
  ];
  
  const incompatibleExtensions = ['.mov', '.m4v', '.hevc'];
  const ext = path.extname(filename).toLowerCase();
  
  return incompatibleTypes.includes(mimeType) || incompatibleExtensions.includes(ext);
}

async function getVideoRotation(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err || !metadata || !metadata.streams) {
        resolve(0);
        return;
      }
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream && videoStream.rotation) {
        resolve(parseInt(videoStream.rotation) || 0);
      } else if (videoStream && videoStream.tags && videoStream.tags.rotate) {
        resolve(parseInt(videoStream.tags.rotate) || 0);
      } else {
        resolve(0);
      }
    });
  });
}

async function hasAudioStream(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err || !metadata || !metadata.streams) {
        resolve(false);
        return;
      }
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(!!audioStream);
    });
  });
}

async function convertVideo(inputPath, outputPath) {
  const rotation = await getVideoRotation(inputPath);
  const hasAudio = await hasAudioStream(inputPath);
  console.log(`Converting: ${inputPath} -> ${outputPath}`);
  console.log(`Video rotation detected: ${rotation}°, has audio: ${hasAudio}`);
  
  let vfFilters = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  
  if (rotation === 90) {
    vfFilters = 'transpose=1,' + vfFilters;
  } else if (rotation === 180) {
    vfFilters = 'transpose=1,transpose=1,' + vfFilters;
  } else if (rotation === 270 || rotation === -90) {
    vfFilters = 'transpose=2,' + vfFilters;
  }
  
  console.log(`Using video filter: ${vfFilters}`);
  
  const audioFilter = 'highpass=f=80,lowpass=f=12000,afftdn=nf=-25:nr=12:nt=w,volume=20.0,acompressor=threshold=0.01:ratio=12:attack=2:release=50:makeup=8,dynaudnorm=f=100:g=11:p=0.95:m=30';
  console.log(`🔊 Audio filter (denoise+amplify+normalize): ${audioFilter}`);
  
  if (!hasAudio) {
    console.log('⚠️ No audio track found - adding silent audio via raw ffmpeg for iOS compatibility');
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-g', '30',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', vfFilters,
        '-map', '1:v:0', '-map', '0:a:0',
        '-shortest',
        '-metadata:s:v:0', 'rotate=0',
        '-y', outputPath
      ];
      console.log('FFmpeg started:', 'ffmpeg', args.join(' '));
      const proc = execFile('ffmpeg', args, { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('Conversion error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        } else {
          console.log('Conversion completed (with silent audio)');
          resolve(outputPath);
        }
      });
    });
  }
  
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-g', '30',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', vfFilters,
        '-af', audioFilter,
        '-metadata:s:v:0', 'rotate=0',
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('FFmpeg started:', cmd))
      .on('progress', (p) => {
        if (p.percent) console.log(`Progress: ${Math.round(p.percent)}%`);
      })
      .on('end', () => {
        clearTimeout(killTimer);
        console.log('Conversion completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        clearTimeout(killTimer);
        console.error('Conversion error:', err);
        reject(err);
      })
      .run();

    // Kill ffmpeg if it hangs (5 min max per file)
    const killTimer = setTimeout(() => {
      console.error('⏱️ ffmpeg timed out after 5 min, killing process');
      try { command.kill('SIGKILL'); } catch (_) {}
      reject(new Error('ffmpeg conversion timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

async function uploadToFirebase(filePath, storagePath) {
  if (!bucket) {
    throw new Error('Firebase Storage not initialized');
  }

  const file = bucket.file(storagePath);
  
  await file.save(fs.readFileSync(filePath), {
    metadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        uploadedAt: new Date().toISOString(),
        converted: 'true',
        firebaseStorageDownloadTokens: require('crypto').randomUUID()
      }
    },
    public: true
  });

  const bucketName = bucket.name;
  const token = require('crypto').randomUUID();
  
  await file.setMetadata({
    metadata: {
      firebaseStorageDownloadTokens: token
    }
  });
  
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  
  return publicUrl;
}

// Proxy Firebase/GCS storage videos so the WebView recording canvas can fetch
// them as blobs (same-origin blob URL → no iOS canvas taint).
app.get('/api/proxy-video', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const decoded = decodeURIComponent(url);
  // Security: only proxy known Firebase / GCS domains
  const allowed =
    decoded.startsWith('https://firebasestorage.googleapis.com/') ||
    decoded.startsWith('https://storage.googleapis.com/');
  if (!allowed) return res.status(403).json({ error: 'Only Firebase Storage URLs allowed' });

  try {
    const upstream = await fetch(decoded);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('❌ proxy-video error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  const queueStatus = conversionQueue.getQueueStatus();
  res.json({ 
    status: 'ok', 
    firebase: bucket ? 'connected' : 'not configured',
    ffmpeg: 'available',
    queue: {
      activeJobs: queueStatus.activeJobs,
      queuedJobs: queueStatus.queueLength,
      maxConcurrent: queueStatus.maxConcurrent,
      stats: queueStatus.stats
    }
  });
});

app.post('/api/convert-and-upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const { storyId, type = 'story', recipientId, clipNumber } = req.body;
  
  if (!storyId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'storyId is required' });
  }

  const inputPath = req.file.path;
  const originalName = req.file.originalname || 'video.mov';
  const mimeType = req.file.mimetype || 'video/quicktime';
  
  console.log(`Received video: ${originalName}, type: ${mimeType}, size: ${req.file.size}`);

  const conversionProcessor = async (data, updateProgress) => {
    let finalPath = data.inputPath;
    let wasConverted = false;

    updateProgress(10);

    if (needsConversion(data.mimeType, data.originalName)) {
      console.log('Video needs conversion (HEVC/MOV -> H.264/MP4)');
      const outputPath = path.join(convertedDir, `${data.storyId}_${Date.now()}.mp4`);
      await convertVideo(data.inputPath, outputPath);
      finalPath = outputPath;
      wasConverted = true;
      fs.unlinkSync(data.inputPath);
    }

    updateProgress(50);

    let storagePath;
    if (data.type === 'reflection' && data.recipientId) {
      storagePath = `reflections/${data.storyId}/${data.recipientId}_clip${data.clipNumber || 1}.mp4`;
    } else {
      storagePath = `stories/${data.storyId}.mp4`;
    }

    let publicUrl;
    if (bucket) {
      publicUrl = await uploadToFirebase(finalPath, storagePath);
      console.log(`Uploaded to Firebase: ${publicUrl}`);
    } else {
      publicUrl = `/local-videos/${path.basename(finalPath)}`;
      console.log('Saved locally (Firebase not configured)');
    }

    updateProgress(90);

    if (wasConverted || bucket) {
      fs.unlinkSync(finalPath);
    }

    updateProgress(100);
    return { url: publicUrl, converted: wasConverted, storagePath };
  };

  try {
    const { jobId, promise } = await conversionQueue.addJob('convert-and-upload', {
      inputPath, originalName, mimeType, storyId, type, recipientId, clipNumber
    }, conversionProcessor);

    const result = await promise;
    res.json({ success: true, ...result });

  } catch (error) {
    console.error('Processing error:', error);
    
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    res.status(500).json({ 
      error: 'Video processing failed', 
      details: error.message 
    });
  }
});

app.post('/api/check-format', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const mimeType = req.file.mimetype;
  const filename = req.file.originalname;
  const needs = needsConversion(mimeType, filename);
  
  fs.unlinkSync(req.file.path);

  res.json({
    mimeType,
    filename,
    needsConversion: needs,
    reason: needs ? 'HEVC/MOV format not supported by most browsers' : 'Format is browser-compatible'
  });
});

const convertedCache = new Map();

app.post('/api/convert-from-url', async (req, res) => {
  const { videoUrl, storyId } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }
  
  const cacheKey = storyId || videoUrl;
  if (convertedCache.has(cacheKey)) {
    console.log('Returning cached conversion for:', cacheKey);
    return res.json({ success: true, url: convertedCache.get(cacheKey), converted: true, cached: true });
  }
  
  const lowerUrl = videoUrl.toLowerCase();
  const needsConvert = lowerUrl.includes('.mov') || lowerUrl.includes('.hevc') || lowerUrl.includes('.m4v');
  
  if (!needsConvert) {
    return res.json({ success: true, url: videoUrl, converted: false });
  }
  
  console.log('Converting video from URL:', videoUrl);
  
  const conversionProcessor = async (data, updateProgress) => {
    updateProgress(10);
    
    const response = await fetch(data.videoUrl);
    if (!response.ok) throw new Error('Failed to download video');
    const buffer = Buffer.from(await response.arrayBuffer());
    const inputPath = path.join(tempDir, `download_${Date.now()}.mov`);
    const outputPath = path.join(convertedDir, `converted_${data.storyId || Date.now()}.mp4`);
    fs.writeFileSync(inputPath, buffer);
    console.log(`Downloaded video: ${buffer.length} bytes`);
    updateProgress(30);
    
    await convertVideo(inputPath, outputPath);
    updateProgress(70);
    
    fs.unlinkSync(inputPath);
    
    let publicUrl;
    if (bucket) {
      const storagePath = `converted/${data.storyId || Date.now()}.mp4`;
      publicUrl = await uploadToFirebase(outputPath, storagePath);
      fs.unlinkSync(outputPath);
      console.log('Converted and uploaded:', publicUrl);
    } else {
      publicUrl = `/converted/${path.basename(outputPath)}`;
      console.log('Converted locally:', publicUrl);
    }
    
    updateProgress(100);
    if (convertedCache.size >= 200) convertedCache.delete(convertedCache.keys().next().value);
    convertedCache.set(data.cacheKey, publicUrl);
    return { url: publicUrl, converted: true };
  };
  
  try {
    const { jobId, promise } = await conversionQueue.addJob('convert-from-url', { 
      videoUrl, storyId, cacheKey 
    }, conversionProcessor);
    
    const result = await promise;
    res.json({ success: true, ...result });
    
  } catch (error) {
    console.error('Conversion from URL error:', error);
    res.status(500).json({ 
      error: 'Conversion failed', 
      details: error.message,
      originalUrl: videoUrl
    });
  }
});

const aiService = require('./ai-service');

app.post('/api/transcribe', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  // multer saves without extension — rename so ffmpeg can detect format
  const originalPath = req.file.path;
  const ext = path.extname(req.file.originalname) || '.m4a';
  const renamedPath = originalPath + ext;
  try {
    fs.renameSync(originalPath, renamedPath);
  } catch (e) {
    // rename failed, continue with original
  }
  const filePath = fs.existsSync(renamedPath) ? renamedPath : originalPath;

  try {
    const result = await aiService.transcribeVideo(filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// ─── Suno Library: בחירת טרק לפי תמלול ──────────────────────────────────────
app.post('/api/select-library-track', async (req, res) => {
  const { segments } = req.body;
  if (!segments || !Array.isArray(segments)) {
    return res.status(400).json({ error: 'segments array is required' });
  }
  try {
    const { selectTrackForTranscription } = require('./music/library-selector');
    const result = await selectTrackForTranscription(segments, firestoreDb);
    res.json({
      trackId: result.trackId,
      trackUrl: result.trackUrl,
      nameHe: result.track?.nameHe,
      reason: result.reason,
    });
  } catch (err) {
    console.error('❌ /api/select-library-track:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transcribe-from-urls', async (req, res) => {
  const { clipUrls } = req.body;
  if (!clipUrls || !Array.isArray(clipUrls) || clipUrls.length === 0) {
    return res.status(400).json({ error: 'clipUrls array is required' });
  }

  try {
    // Download and transcribe all clips in parallel, then merge in order
    console.log(`🚀 Transcribing ${clipUrls.length} clips in parallel...`);
    const clipResults = await Promise.all(
      clipUrls.map(async (url, i) => {
        const localPath = path.join(tempDir, `transcribe_${Date.now()}_${i}.mp4`);
        console.log(`📥 Downloading clip ${i + 1}/${clipUrls.length} for transcription`);
        await downloadFile(url, localPath);
        const result = await aiService.transcribeVideo(localPath);
        try { fs.unlinkSync(localPath); } catch (e) {}
        return { index: i, result };
      })
    );

    // Sort by original index and compute time offsets
    clipResults.sort((a, b) => a.index - b.index);
    const allSegments = [];
    let timeOffset = 0;
    for (const { result } of clipResults) {
      const clipDuration = result.duration || 30;
      if (result.success && result.segments && result.segments.length > 0) {
        result.segments.forEach(seg => {
          allSegments.push({
            start: timeOffset + (seg.start || 0),
            end: timeOffset + (seg.end || clipDuration),
            text: seg.text || '',
          });
        });
      } else if (result.success && result.text) {
        allSegments.push({ start: timeOffset, end: timeOffset + clipDuration, text: result.text });
      }
      timeOffset += clipDuration;
    }

    console.log(`✅ Transcribed ${clipUrls.length} clips, ${allSegments.length} segments, total ${timeOffset}s`);
    res.json({ success: true, segments: allSegments, totalDuration: timeOffset });
  } catch (error) {
    console.error('❌ Transcribe-from-urls error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

app.post('/api/analyze-story', async (req, res) => {
  const { transcriptions } = req.body;
  
  if (!transcriptions || !Array.isArray(transcriptions)) {
    return res.status(400).json({ error: 'transcriptions array is required' });
  }

  try {
    const result = await aiService.analyzeStoryThemes(transcriptions);
    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

app.post('/api/editing-suggestions', async (req, res) => {
  const { storyTranscript, reflectionTranscripts } = req.body;
  
  if (!storyTranscript) {
    return res.status(400).json({ error: 'storyTranscript is required' });
  }

  try {
    const result = await aiService.generateEditingSuggestions(
      storyTranscript, 
      reflectionTranscripts || []
    );
    res.json(result);
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions', details: error.message });
  }
});

app.post('/api/generate-title', async (req, res) => {
  const { transcriptions } = req.body;
  
  if (!transcriptions || !Array.isArray(transcriptions)) {
    return res.status(400).json({ error: 'transcriptions array is required' });
  }

  try {
    const title = await aiService.generateVideoTitle(transcriptions);
    res.json({ success: true, title });
  } catch (error) {
    console.error('Title generation error:', error);
    res.status(500).json({ error: 'Failed to generate title', details: error.message });
  }
});

const renderingJobs = new Map();

const ALLOWED_VIDEO_DOMAINS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'reflectly-mobile-x--yaronbenm1.replit.app',
  'reflectly-playback.firebasestorage.app'
];

function isAllowedVideoUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_VIDEO_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

async function downloadVideo(url, outputPath) {
  console.log(`Downloading: ${url}`);
  await downloadFile(url, outputPath);
  console.log(`Downloaded: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
  return outputPath;
}

async function concatenateVideos(inputPaths, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Concatenating ${inputPaths.length} videos...`);
    
    const listPath = path.join(tempDir, `concat_list_${Date.now()}.txt`);
    const listContent = inputPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(listPath, listContent);
    
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v', 'libx264',
        '-g', '30',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('FFmpeg concat:', cmd))
      .on('progress', (p) => {
        if (p.percent) console.log(`Concat progress: ${Math.round(p.percent)}%`);
      })
      .on('end', () => {
        fs.unlinkSync(listPath);
        console.log('Concatenation completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
        console.error('Concat error:', err);
        reject(err);
      })
      .run();
  });
}

const TRANSITION_DURATION = 0.5;

// Cycling transitions for cinematic format — CapCut-style variety
const CINEMATIC_TRANSITIONS = [
  'slideleft',
  'zoomin',
  'fadeblack',
  'slideup',
  'radial',
  'pixelize',
  'circleopen',
  'slideright',
];

function getTransitionFilter(format) {
  switch (format) {
    case 'cinematic':
      return 'cycling';
    case 'fade':
    case 'scale-fade':
      return 'fade';
    case 'slide':
    case 'flow':
      return 'slideleft';
    case 'zoom':
    case 'parallax':
      return 'zoomin';
    case 'blur-rotate':
      return 'circleopen';
    case 'flip-pages':
    case 'paper-fold':
      return 'fadeblack';
    case 'cube-3d':
    case 'carousel-3d':
      return 'diagtr';
    case 'stack-cards':
    case 'tinder-swipe':
      return 'slideright';
    case 'circular':
      return 'radial';
    case 'standard':
    default:
      return null;
  }
}

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.warn(`Could not probe ${filePath}: ${err.message}`);
        resolve({ duration: 5, hasAudio: true });
      } else {
        const duration = metadata.format.duration || 5;
        const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
        console.log(`Probe ${path.basename(filePath)}: ${duration}s, audio: ${hasAudio}`);
        resolve({ duration, hasAudio });
      }
    });
  });
}

async function ensureAudioTrack(inputPath) {
  const info = await getVideoDuration(inputPath);
  if (info.hasAudio) return inputPath;
  
  const outputPath = inputPath.replace('.mp4', '_audio.mp4');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'])
      .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y'])
      .output(outputPath)
      .on('end', () => {
        console.log(`Added silent audio track to ${path.basename(inputPath)}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.warn(`Failed to add audio track: ${err.message}`);
        resolve(inputPath);
      })
      .run();
  });
}

async function concatenateWithTransitions(inputPaths, outputPath, format) {
  const transition = getTransitionFilter(format);
  const isCycling = transition === 'cycling';

  if ((!transition || inputPaths.length < 2) && !isCycling) {
    console.log(`Using simple concatenation (format: ${format})`);
    return concatenateVideos(inputPaths, outputPath);
  }
  if (inputPaths.length < 2) {
    return concatenateVideos(inputPaths, outputPath);
  }

  console.log(`Concatenating with ${isCycling ? 'cycling' : transition} transitions (format: ${format})`);

  const processedPaths = [];
  const durations = [];
  for (const p of inputPaths) {
    const processed = await ensureAudioTrack(p);
    processedPaths.push(processed);
    const info = await getVideoDuration(processed);
    durations.push(info.duration);
  }
  console.log('Video durations:', durations);
  inputPaths = processedPaths;
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    inputPaths.forEach(p => {
      command = command.input(p);
    });
    
    let filterComplex = '';
    const n = inputPaths.length;
    
    for (let i = 0; i < n; i++) {
      filterComplex += `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];`;
      filterComplex += `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}];`;
    }
    
    const getTransition = (index) => isCycling
      ? CINEMATIC_TRANSITIONS[index % CINEMATIC_TRANSITIONS.length]
      : transition;

    if (n === 2) {
      const offset = Math.max(0.5, durations[0] - TRANSITION_DURATION);
      filterComplex += `[v0][v1]xfade=transition=${getTransition(0)}:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(2)}[vout];`;
      filterComplex += `[a0][a1]acrossfade=d=${TRANSITION_DURATION}[aout]`;
    } else {
      let lastV = 'v0';
      let lastA = 'a0';
      let cumulativeOffset = Math.max(0.5, durations[0] - TRANSITION_DURATION);

      for (let i = 1; i < n; i++) {
        const outV = i === n - 1 ? 'vout' : `vt${i}`;
        const outA = i === n - 1 ? 'aout' : `at${i}`;

        filterComplex += `[${lastV}][v${i}]xfade=transition=${getTransition(i - 1)}:duration=${TRANSITION_DURATION}:offset=${cumulativeOffset.toFixed(2)}[${outV}];`;
        filterComplex += `[${lastA}][a${i}]acrossfade=d=${TRANSITION_DURATION}[${outA}];`;

        lastV = outV;
        lastA = outA;
        if (i < n - 1) {
          cumulativeOffset += Math.max(0.5, durations[i] - TRANSITION_DURATION);
        }
      }
    }
    
    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-g', '30',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('FFmpeg transitions:', cmd))
      .on('progress', (p) => {
        if (p.percent) console.log(`Transition progress: ${Math.round(p.percent)}%`);
      })
      .on('end', () => {
        console.log('Transitions completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Transition error, falling back to simple concat:', err.message);
        concatenateVideos(inputPaths, outputPath).then(resolve).catch(reject);
      })
      .run();
  });
}

function shuffleVideosAvoidConsecutive(videos) {
  if (videos.length <= 1) return videos;

  // Single participant — keep natural clip order (1→2→3)
  const uniqueParticipants = new Set(videos.map(v => v.participantId).filter(Boolean));
  if (uniqueParticipants.size <= 1) {
    return [...videos].sort((a, b) => (a.clipNumber || 0) - (b.clipNumber || 0));
  }

  const shuffled = [...videos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].participantId && shuffled[i].participantId === shuffled[i-1].participantId) {
      for (let j = i + 1; j < shuffled.length; j++) {
        if (shuffled[j].participantId !== shuffled[i-1].participantId) {
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          break;
        }
      }
    }
  }

  return shuffled;
}

app.post('/api/stories/:storyId/render', async (req, res) => {
  const { storyId } = req.params;
  const { videoUrls, videos, format = 'standard', musicUrl } = req.body;
  
  let processVideos = [];
  if (videos && Array.isArray(videos) && videos.length > 0) {
    const shuffled = shuffleVideosAvoidConsecutive(videos);
    processVideos = shuffled.map(v => v.url);
    console.log(`Shuffled ${videos.length} videos to avoid consecutive same-player clips`);
  } else if (videoUrls && Array.isArray(videoUrls) && videoUrls.length > 0) {
    processVideos = videoUrls;
  }
  
  if (processVideos.length === 0) {
    return res.status(400).json({ error: 'videoUrls or videos array is required' });
  }
  
  const invalidUrls = processVideos.filter(url => !isAllowedVideoUrl(url));
  if (invalidUrls.length > 0) {
    console.warn('Blocked invalid video URLs:', invalidUrls);
    return res.status(400).json({ 
      error: 'Invalid video URLs detected', 
      message: 'Only Firebase Storage URLs are allowed'
    });
  }
  
  console.log(`📹 Rendering ${processVideos.length} videos with format: ${format}, music: ${musicUrl ? 'yes' : 'no'}`);
  console.log(`📹 Video URLs:`, processVideos.map(u => u.substring(0, 80)));
  
  const jobId = `${storyId}_${Date.now()}`;
  
  renderingJobs.set(jobId, {
    status: 'processing',
    progress: 0,
    storyId,
    startedAt: new Date().toISOString()
  });
  
  res.json({ 
    success: true, 
    jobId, 
    message: 'Rendering started',
    status: 'processing'
  });
  
  (async () => {
    try {
      const downloadDir = path.join(tempDir, jobId);
      fs.mkdirSync(downloadDir, { recursive: true });
      
      renderingJobs.get(jobId).progress = 10;
      
      // Download + convert clips with limited concurrency (3 at a time) to avoid OOM on Render
      const DOWNLOAD_CONCURRENCY = 3;
      let completedClips = 0;
      const localPathsUnordered = [];
      for (let start = 0; start < processVideos.length; start += DOWNLOAD_CONCURRENCY) {
        const batch = processVideos.slice(start, start + DOWNLOAD_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (url, batchIdx) => {
            const i = start + batchIdx;
            const ext = url.toLowerCase().includes('.webm') ? 'webm' : 'mp4';
            const localPath = path.join(downloadDir, `clip_${i}.${ext}`);
            await downloadVideo(url, localPath);

            let finalPath = localPath;
            if (ext === 'webm') {
              const mp4Path = path.join(downloadDir, `clip_${i}.mp4`);
              await convertVideo(localPath, mp4Path);
              fs.unlinkSync(localPath);
              finalPath = mp4Path;
            }

            completedClips++;
            renderingJobs.get(jobId).progress = 10 + Math.round(completedClips / processVideos.length * 40);
            return { i, path: finalPath };
          })
        );
        localPathsUnordered.push(...batchResults);
      }
      // Restore original order (Promise.all preserves order, but be explicit)
      const localPaths = localPathsUnordered
        .sort((a, b) => a.i - b.i)
        .map(item => item.path);
      
      renderingJobs.get(jobId).progress = 50;
      
      const outputPath = path.join(convertedDir, `final_${jobId}.mp4`);
      await concatenateWithTransitions(localPaths, outputPath, format);
      
      renderingJobs.get(jobId).progress = 80;
      
      let finalUrl;
      if (bucket) {
        const storagePath = `edited/${storyId}/final_${Date.now()}.mp4`;
        finalUrl = await uploadToFirebase(outputPath, storagePath);
        fs.unlinkSync(outputPath);
      } else {
        finalUrl = `/edited/${path.basename(outputPath)}`;
      }
      
      for (const p of localPaths) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      fs.rmdirSync(downloadDir, { recursive: true });
      
      renderingJobs.set(jobId, {
        status: 'completed',
        progress: 100,
        storyId,
        finalUrl,
        completedAt: new Date().toISOString()
      });

      // Save finalVideoUrl to Firestore so client can load it after notification tap
      if (firestoreDb && storyId && finalUrl) {
        firestoreDb.collection('stories').doc(storyId).update({ finalVideoUrl: finalUrl }).catch(() => {});
      }
      sendVideoReadyNotification(storyId, finalUrl).catch(() => {});

      console.log(`Rendering completed: ${finalUrl}`);
      
    } catch (error) {
      console.error('Rendering error:', error);
      renderingJobs.set(jobId, {
        status: 'failed',
        error: error.message,
        storyId
      });
    }
  })();
});

app.post('/api/stories/:storyId/render-format', async (req, res) => {
  const { storyId } = req.params;
  const { videoUrls, format = 'cube-3d', storyName = '', backgroundVideoUrl = null, backgroundMediaType = 'video' } = req.body;
  
  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ error: 'videoUrls array is required' });
  }
  
  const invalidUrls = videoUrls.filter(url => !isAllowedVideoUrl(url));
  if (invalidUrls.length > 0) {
    return res.status(400).json({ error: 'Invalid video URLs', message: 'Only Firebase Storage URLs are allowed' });
  }
  
  console.log(`🎬 Format render: ${videoUrls.length} videos, format: ${format}, story: ${storyName}, bg: ${backgroundVideoUrl ? 'yes' : 'none'}`);

  const renderKey = `${videoUrls.sort().join('|')}_${format}_${backgroundVideoUrl || ''}`;
  for (const [existingJobId, existingJob] of renderingJobs.entries()) {
    if (existingJob._renderKey === renderKey && existingJob.status === 'processing') {
      console.log(`♻️ Duplicate render request, reusing job: ${existingJobId}`);
      return res.json({ success: true, jobId: existingJobId, message: 'Format rendering already in progress', status: 'processing' });
    }
    if (existingJob._renderKey === renderKey && existingJob.status === 'completed' && existingJob.finalUrl) {
      const age = Date.now() - (existingJob._completedAt || 0);
      if (age < 10 * 60 * 1000) {
        console.log(`♻️ Recent render found, reusing: ${existingJobId}`);
        return res.json({ success: true, jobId: existingJobId, message: 'Format render already available', status: 'processing' });
      }
    }
  }
  
  const jobId = `fmt_${storyId}_${Date.now()}`;
  
  renderingJobs.set(jobId, {
    status: 'processing',
    progress: 0,
    storyId,
    format,
    _renderKey: renderKey,
    startedAt: new Date().toISOString()
  });
  
  res.json({ success: true, jobId, message: 'Format rendering started', status: 'processing' });
  
  (async () => {
    try {
      const onProgress = (pct, msg) => {
        const job = renderingJobs.get(jobId);
        if (job) {
          job.progress = pct;
          job.progressMessage = msg;
        }
      };
      
      const outputPath = await renderFormatVideo(videoUrls, format, storyName, jobId, onProgress, backgroundVideoUrl);
      
      onProgress(92, 'Uploading');
      
      let finalUrl;
      if (bucket) {
        const storagePath = `edited/${storyId}/format_${Date.now()}.mp4`;
        finalUrl = await uploadToFirebase(outputPath, storagePath);
        fs.unlinkSync(outputPath);
      } else {
        const destPath = path.join(convertedDir, `format_${jobId}.mp4`);
        fs.copyFileSync(outputPath, destPath);
        finalUrl = `/converted/${path.basename(destPath)}`;
      }
      
      cleanupRenderDir(jobId);
      
      renderingJobs.set(jobId, {
        status: 'completed',
        progress: 100,
        storyId,
        format,
        _renderKey: renderKey,
        _completedAt: Date.now(),
        finalUrl,
        completedAt: new Date().toISOString()
      });

      // Save finalVideoUrl to Firestore so client can load it after notification tap
      if (firestoreDb && storyId && finalUrl) {
        firestoreDb.collection('stories').doc(storyId).update({ finalVideoUrl: finalUrl }).catch(() => {});
      }
      sendVideoReadyNotification(storyId, finalUrl).catch(() => {});

      console.log(`✅ Format render completed: ${finalUrl}`);
    } catch (error) {
      console.error('Format render error:', error);
      cleanupRenderDir(jobId);
      renderingJobs.set(jobId, {
        status: 'failed',
        error: error.message,
        storyId,
        format
      });
    }
  })();
});

app.get('/api/render-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = renderingJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

app.get('/api/queue/status', (req, res) => {
  const status = conversionQueue.getQueueStatus();
  res.json(status);
});

app.get('/api/queue/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = conversionQueue.getJobStatus(jobId);
  res.json(status);
});

app.post('/api/convert-url', async (req, res) => {
  const { url, async: asyncMode, reflectionId } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  console.log('🔄 Converting URL:', url);
  if (reflectionId) {
    console.log('📝 Will update reflectionId:', reflectionId);
  }
  
  const conversionProcessor = async (data, updateProgress) => {
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input_${timestamp}.webm`);
    const outputPath = path.join(convertedDir, `output_${timestamp}.mp4`);

    updateProgress(10);

    // Use downloadFile which handles redirects (301/302) and connection errors
    await downloadFile(data.url, inputPath);

    // Validate downloaded file is non-empty
    const fileSize = fs.existsSync(inputPath) ? fs.statSync(inputPath).size : 0;
    console.log(`📥 Downloaded to: ${inputPath} (${fileSize} bytes)`);
    if (fileSize < 1000) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      throw new Error(`Downloaded file too small (${fileSize} bytes) — likely a redirect or error page`);
    }
    updateProgress(30);

    await convertVideo(inputPath, outputPath);
    updateProgress(70);
    
    fs.unlinkSync(inputPath);
    
    let convertedUrl;
    if (bucket) {
      const storagePath = `converted/${timestamp}.mp4`;
      convertedUrl = await uploadToFirebase(outputPath, storagePath);
      fs.unlinkSync(outputPath);
      console.log('✅ Converted and uploaded:', convertedUrl);
    } else {
      convertedUrl = `http://localhost:${PORT}/converted/${timestamp}.mp4`;
      console.log('✅ Converted locally:', convertedUrl);
    }
    
    if (data.reflectionId && firestoreDb && convertedUrl) {
      try {
        await firestoreDb.collection('reflections').doc(data.reflectionId).update({
          convertedUrl: convertedUrl,
          conversionStatus: 'ready'
        });
        console.log('💾 Saved convertedUrl to Firestore for:', data.reflectionId);
      } catch (firestoreError) {
        console.warn('⚠️ Failed to save to Firestore:', firestoreError.message);
      }
    }
    
    updateProgress(100);
    return { convertedUrl };
  };
  
  try {
    const { jobId, promise } = await conversionQueue.addJob('convert-url', { url, reflectionId }, conversionProcessor);
    
    if (asyncMode) {
      return res.json({ 
        success: true, 
        jobId, 
        status: 'queued',
        message: 'Job added to queue. Poll /api/queue/job/:jobId for status.',
        queuePosition: conversionQueue.getJobStatus(jobId).position || 0
      });
    }
    
    const result = await promise;
    return res.json({ success: true, ...result });
    
  } catch (error) {
    console.error('❌ Conversion error:', error);
    return res.status(500).json({ error: error.message, originalUrl: url });
  }
});

app.use('/converted', express.static(convertedDir));

const musicJobs = new Map();

// Throttle: only 1 creator notification per story per 60s
const creatorNotifyThrottle = new Map();

async function sendCreatorNotification(storyId, playerName) {
  if (!firestoreDb) return;
  try {
    const now = Date.now();
    if ((creatorNotifyThrottle.get(storyId) || 0) > now - 60000) {
      console.log(`🔕 Creator notification throttled for story ${storyId}`);
      return;
    }
    creatorNotifyThrottle.set(storyId, now);

    const storyDoc = await firestoreDb.collection('stories').doc(storyId).get();
    if (!storyDoc.exists) { console.warn(`⚠️ sendCreatorNotification: story ${storyId} not found`); return; }
    const story = storyDoc.data();
    const { userId, name: storyName = '', clipCount = 3 } = story;
    if (!userId) { console.warn(`⚠️ sendCreatorNotification: story ${storyId} has no userId`); return; }

    const reflSnap = await firestoreDb.collection('reflections').where('storyId', '==', storyId).get();
    const count = reflSnap.size;

    const userDoc = await firestoreDb.collection('users').doc(userId).get();
    const pushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.warn(`⚠️ sendCreatorNotification: no valid push token for creator ${userId}`);
      return;
    }

    const missing = Math.max(0, clipCount - count);
    let body;
    if (playerName && missing > 0) {
      body = `${playerName} העלה סרטונים ל'${storyName}'. הגיעו ${count} סרטונים, חסר ${missing}`;
    } else if (!playerName && missing > 0) {
      body = `הגיעו ${count} סרטונים ל'${storyName}', חסר ${missing}`;
    } else if (playerName && missing <= 0) {
      body = `${playerName} העלה סרטונים ל'${storyName}'. כל הסרטונים הגיעו. אפשר להתחיל לערוך`;
    } else {
      body = `כל הסרטונים ל'${storyName}' הגיעו. אפשר להתחיל לערוך`;
    }

    await expoClient.sendPushNotificationsAsync([{
      to: pushToken,
      title: 'התקבלו סרטונים חדשים',
      body,
      data: { storyId, type: 'story_reflection_update', storyName, playerName: playerName || null },
    }]);
    console.log(`🔔 Creator notified for story ${storyId}: ${body}`);
  } catch (err) {
    console.warn(`⚠️ sendCreatorNotification failed: ${err.message}`);
  }
}

async function sendVideoReadyNotification(storyId, finalUrl) {
  if (!firestoreDb) return;
  try {
    const storyDoc = await firestoreDb.collection('stories').doc(storyId).get();
    if (!storyDoc.exists) return;
    const { userId, name: storyName = '' } = storyDoc.data();
    if (!userId) return;
    const userDoc = await firestoreDb.collection('users').doc(userId).get();
    const pushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.warn(`⚠️ sendVideoReadyNotification: no push token for creator ${userId}`);
      return;
    }
    await expoClient.sendPushNotificationsAsync([{
      to: pushToken,
      title: '🎬 הסרט מוכן לצפייה!',
      body: `'${storyName}' עובד וממתין לך`,
      data: { type: 'video_ready', storyId, storyName },
    }]);
    console.log(`🔔 Video-ready notification sent for story ${storyId}`);
  } catch (err) {
    console.warn(`⚠️ sendVideoReadyNotification failed: ${err.message}`);
  }
}

async function sendPlayerApprovedNotification(storyId, playerUid) {
  if (!firestoreDb) return;
  try {
    const [storyDoc, userDoc] = await Promise.all([
      firestoreDb.collection('stories').doc(storyId).get(),
      firestoreDb.collection('users').doc(playerUid).get(),
    ]);
    if (!storyDoc.exists) return;
    const storyName = storyDoc.data()?.name || '';
    const pushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.warn(`⚠️ sendPlayerApprovedNotification: no push token for player ${playerUid}`);
      return;
    }
    await expoClient.sendPushNotificationsAsync([{
      to: pushToken,
      title: 'התקבלת לסיפור! 🎬',
      body: `אושרת להצטרף ל'${storyName}'. לחץ כדי להתחיל לצלם`,
      data: { type: 'player_approved', storyId, storyName },
    }]);
    console.log(`🔔 Player ${playerUid} notified: approved for story ${storyId}`);
  } catch (err) {
    console.warn(`⚠️ sendPlayerApprovedNotification failed: ${err.message}`);
  }
}

async function sendNewApplicationNotification(storyId, applicantName, creatorUid) {
  if (!firestoreDb) return;
  try {
    const [storyDoc, userDoc] = await Promise.all([
      firestoreDb.collection('stories').doc(storyId).get(),
      firestoreDb.collection('users').doc(creatorUid).get(),
    ]);
    if (!storyDoc.exists) return;
    const storyName = storyDoc.data()?.name || '';
    const pushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.warn(`⚠️ sendNewApplicationNotification: no push token for creator ${creatorUid}`);
      return;
    }
    await expoClient.sendPushNotificationsAsync([{
      to: pushToken,
      title: 'בקשת הצטרפות חדשה 🎬',
      body: `${applicantName || 'מישהו'} רוצה להצטרף ל'${storyName}'`,
      data: { type: 'new_application', storyId, storyName },
    }]);
    console.log(`🔔 Creator ${creatorUid} notified: new application for story ${storyId}`);
  } catch (err) {
    console.warn(`⚠️ sendNewApplicationNotification failed: ${err.message}`);
  }
}

app.post('/api/notify-new-application', async (req, res) => {
  const { storyId, applicantName, creatorUid, idToken } = req.body;
  if (!storyId || !creatorUid || !idToken) {
    return res.status(400).json({ error: 'storyId, creatorUid and idToken required' });
  }
  try {
    await adminAuth.verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  sendNewApplicationNotification(storyId, applicantName, creatorUid).catch(() => {});
  res.json({ success: true });
});

app.post('/api/notify-player-approved', async (req, res) => {
  const { storyId, playerUid, idToken } = req.body;
  if (!storyId || !playerUid || !idToken) {
    return res.status(400).json({ error: 'storyId, playerUid and idToken required' });
  }
  try {
    await adminAuth.verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  sendPlayerApprovedNotification(storyId, playerUid).catch(() => {});
  res.json({ success: true });
});

app.post('/api/generate-music', async (req, res) => {
  const { storyId, transcriptionSegments, totalDuration, style, numClips, musicEngine, lockedSet } = req.body;
  
  if (!storyId || !totalDuration) {
    return res.status(400).json({ error: 'storyId and totalDuration are required' });
  }
  
  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });
  }

  const jobId = `music_${storyId}_${Date.now()}`;
  
  musicJobs.set(jobId, {
    status: 'processing',
    progress: 0,
    storyId,
    startedAt: new Date().toISOString()
  });

  res.json({ success: true, jobId, message: 'Music generation started' });

  (async () => {
    try {
      const { generateMusicForVideo, cleanupMusicFiles } = require('./music/music-service');

      musicJobs.get(jobId).progress = 10;
      musicJobs.get(jobId).stage = 'analyzing_emotions';

      const segments = transcriptionSegments || [{ start: 0, end: totalDuration, text: '' }];

      const result = await generateMusicForVideo(segments, totalDuration, style, numClips, firestoreDb, null, null, musicEngine, lockedSet ? parseInt(lockedSet) : null);

      if (!result.success) {
        musicJobs.set(jobId, { status: 'failed', error: result.error });
        return;
      }

      musicJobs.get(jobId).progress = 80;
      musicJobs.get(jobId).stage = 'uploading';

      if (!bucket) {
        cleanupMusicFiles(result.musicPath);
        musicJobs.set(jobId, { status: 'failed', error: 'Firebase Storage bucket not configured' });
        console.error('❌ Music generation failed: no Firebase bucket');
        return;
      }

      let musicUrl;
      try {
        const ext = result.musicPath.endsWith('.m4a') ? 'm4a' : 'wav';
        const storagePath = `music/${storyId}/ai_music_${Date.now()}.${ext}`;
        musicUrl = await uploadToFirebase(result.musicPath, storagePath);
        console.log(`✅ Music uploaded to Firebase: ${musicUrl}`);
      } catch (uploadErr) {
        cleanupMusicFiles(result.musicPath);
        musicJobs.set(jobId, { status: 'failed', error: `Firebase upload failed: ${uploadErr.message}` });
        console.error('❌ Music upload failed:', uploadErr.message);
        return;
      }

      cleanupMusicFiles(result.musicPath);

      musicJobs.set(jobId, {
        status: 'completed',
        progress: 100,
        musicUrl,
        emotionTimeline: result.emotionTimeline,
        musicPrompt: result.musicPrompt,
        musicalKey: result.musicalKey,
        bpm: result.bpm,
        completedAt: new Date().toISOString()
      });

      // Write to Firestore so clients can discover the URL even if polling missed it
      let pushToken = null;
      try {
        await firestoreDb.collection('stories').doc(storyId).update({
          generatedMusicUrl: musicUrl,
          // Store for remix-music endpoint so it can re-run with a different style
          transcriptionSegments: segments.slice(0, 50),
          totalDuration,
          numClips: numClips || null,
          musicSet: result.musicSet || null,
        });
        console.log(`✅ Firestore updated with music URL for story ${storyId}`);
        const storyDoc = await firestoreDb.collection('stories').doc(storyId).get();
        pushToken = storyDoc.data()?.pushToken;
      } catch (fsErr) {
        console.warn(`⚠️ Firestore music URL update failed (non-critical): ${fsErr.message}`);
      }

      // Send push notification if token available
      if (pushToken && Expo.isExpoPushToken(pushToken)) {
        try {
          await expoClient.sendPushNotificationsAsync([{
            to: pushToken,
            title: '🎬 הסרטון שלך מוכן!',
            body: 'המוזיקה מוכנה — הסרטון יוקלט אוטומטית',
            data: { storyId },
          }]);
          console.log(`🔔 Push notification sent for story ${storyId}`);
        } catch (pushErr) {
          console.warn(`⚠️ Push notification failed (non-critical): ${pushErr.message}`);
        }
      }

      console.log(`✅ Music generation completed for story ${storyId}`);

    } catch (error) {
      console.error(`❌ Music generation failed for story ${storyId}:`, error);
      musicJobs.set(jobId, { status: 'failed', error: error.message });
    }
  })();
});

app.get('/api/music-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = musicJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

/**
 * POST /api/enhance-clip-audio
 *
 * Full pipeline: separate clean vocals from a recorded clip (using local Demucs),
 * then mix those vocals with a background music track.
 *
 * Body:
 *   videoUrl     {string}  Firebase URL of the recorded clip
 *   musicUrl     {string}  Firebase URL of the ambient music track
 *   storyId      {string}  Used for Firebase Storage path
 *   musicVolume  {number}  Music volume (default 0.15)
 *   musicSource  {string}  'ambient' (default) | 'ai_generated' | 'suno' (future)
 *
 * Returns:
 *   { success: true, videoUrl: <Firebase URL of enhanced clip> }
 */
app.post('/api/enhance-clip-audio', async (req, res) => {
  const {
    videoUrl,
    musicUrl,
    storyId,
    musicVolume = 0.15,
    musicSource = 'ambient',
    // For ai_generated: pass transcription segments
    transcriptionSegments,
    totalDuration,
    style
  } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  const jobDir = path.join(tempDir, `enhance_${Date.now()}`);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const { separateVocals } = require('./music/vocal-separator');
    const { mixVocalsWithMusic } = require('./music/mixing-service');

    // 1. Download the recorded video clip
    const videoPath = path.join(jobDir, 'clip.mp4');
    await downloadFile(videoUrl, videoPath);
    console.log('📥 Clip downloaded:', path.basename(videoPath));

    // 2. Extract audio from video for Demucs input
    const audioPath = path.join(jobDir, 'clip_audio.wav');
    await new Promise((resolve, reject) => {
      const { execFile } = require('child_process');
      execFile('ffmpeg', [
        '-i', videoPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        '-y', audioPath
      ], { timeout: 60000 }, (err) => err ? reject(err) : resolve());
    });
    console.log('🔊 Audio extracted from clip');

    // 3. Separate vocals from music bleed using local Demucs (free)
    const stemsDir = path.join(jobDir, 'stems');
    const { vocalsPath } = await separateVocals(audioPath, stemsDir);
    console.log('🎤 Vocals separated:', path.basename(vocalsPath));

    // 4. Resolve background music based on musicSource
    let finalMusicPath;
    switch (musicSource) {
      case 'ai_generated': {
        // Use existing GPT-4o → MusicGen → stem mixing pipeline
        if (!transcriptionSegments || !totalDuration) {
          return res.status(400).json({ error: 'ai_generated requires transcriptionSegments and totalDuration' });
        }
        const { generateMusicForVideo } = require('./music/music-service');
        const aiResult = await generateMusicForVideo(transcriptionSegments, totalDuration, style, null, firestoreDb);
        if (!aiResult.success) throw new Error(`AI music generation failed: ${aiResult.error}`);
        finalMusicPath = aiResult.musicPath;
        console.log('🤖 AI-generated music ready');
        break;
      }

      case 'suno':
        // TODO: Suno API integration
        // When implemented:
        //   const sunoResult = await callSunoApi({ prompt, duration, style });
        //   finalMusicPath = sunoResult.audioPath;
        // For now, fall through to ambient
        console.log('🎵 Suno not yet integrated — falling back to ambient track');
        // fall through

      case 'ambient':
      default: {
        if (!musicUrl) {
          return res.status(400).json({ error: 'musicUrl is required for ambient musicSource' });
        }
        finalMusicPath = path.join(jobDir, 'music.mp3');
        await downloadFile(musicUrl, finalMusicPath);
        console.log('🎵 Ambient track downloaded');
        break;
      }
    }

    // 5. Mix clean vocals + music → new video
    const outputPath = path.join(jobDir, 'enhanced_clip.mp4');
    await mixVocalsWithMusic(videoPath, vocalsPath, finalMusicPath, outputPath, musicVolume);

    // 6. Upload to Firebase Storage
    let finalUrl = null;
    if (bucket) {
      const storagePath = `enhanced/${storyId || 'unknown'}/clip_${Date.now()}.mp4`;
      finalUrl = await uploadToFirebase(outputPath, storagePath);
      console.log('☁️ Enhanced clip uploaded:', finalUrl);
    }

    fs.rmSync(jobDir, { recursive: true, force: true });
    res.json({ success: true, videoUrl: finalUrl });

  } catch (error) {
    console.error('❌ enhance-clip-audio failed:', error.message);
    try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch (_) {}
    res.status(500).json({ error: error.message });
  }
});

// Probe whether a video file contains an audio stream
function probeVideoHasAudio(videoPath) {
  return new Promise(resolve => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ], (err, stdout) => resolve(!err && stdout.trim() === 'audio'));
  });
}

// POST /api/reencode-for-whatsapp — Re-encodes VFR iOS recording to CFR h264 baseline.
// Use when recording already has music (performance mode) — no AI music mixing needed,
// but VFR→CFR conversion is required for WhatsApp to show video instead of audio-only.
app.post('/api/reencode-for-whatsapp', express.json(), async (req, res) => {
  const { videoUrl, storyId } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
  try {
    const { reencodeForWhatsApp } = require('./music/mixing-service');
    const jobDir = path.join(tempDir, `reencode_${Date.now()}`);
    fs.mkdirSync(jobDir, { recursive: true });
    const videoPath  = path.join(jobDir, 'video.mp4');
    const outputPath = path.join(jobDir, 'output.mp4');
    await downloadFile(videoUrl, videoPath);
    await reencodeForWhatsApp(videoPath, outputPath);
    const outputSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    console.log(`📦 Re-encoded size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
    let finalUrl = null;
    if (bucket) {
      const storagePath = `edited/${storyId || 'unknown'}/reencoded_${Date.now()}.mp4`;
      finalUrl = await uploadToFirebase(outputPath, storagePath);
      console.log(`✅ Re-encoded video uploaded: ${finalUrl?.substring(0, 80)}`);
    } else {
      const filename = `reencoded_${Date.now()}.mp4`;
      const servePath = path.join(convertedDir, filename);
      fs.copyFileSync(outputPath, servePath);
      const serverBase = (process.env.EXPO_PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
      finalUrl = `${serverBase}/converted/${filename}`;
    }
    fs.rmSync(jobDir, { recursive: true, force: true });
    res.json({ success: true, finalUrl, videoUrl: finalUrl });
  } catch (err) {
    console.error('❌ Re-encode for WhatsApp failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/test-mix — Dev shortcut: mix an existing video URL with music, no re-recording needed.
// Body: { videoUrl (required), musicUrl? (optional — picks random Suno track if omitted), musicVolume? }
// Returns: { success, finalUrl } — open in browser or send to WhatsApp to verify.
app.post('/api/test-mix', express.json(), async (req, res) => {
  const { videoUrl, musicUrl: bodyMusicUrl, musicVolume = 0.1 } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
  try {
    const { mixRecordingAudioWithMusic } = require('./music/mixing-service');
    let musicUrl = bodyMusicUrl;
    // Auto-pick a random Suno track if none provided
    if (!musicUrl && firestoreDb) {
      const snap = await firestoreDb.collection('suno_tracks').limit(20).get();
      const tracks = snap.docs.map(d => d.data()).filter(t => t.url);
      if (tracks.length > 0) {
        const pick = tracks[Math.floor(Math.random() * tracks.length)];
        musicUrl = pick.url;
        console.log(`🎵 test-mix: auto-picked track set=${pick.set} id=${pick.id}`);
      }
    }
    if (!musicUrl) return res.status(400).json({ error: 'No musicUrl and no Suno tracks in Firestore' });

    const jobDir = path.join(tempDir, `testmix_${Date.now()}`);
    fs.mkdirSync(jobDir, { recursive: true });
    const videoPath  = path.join(jobDir, 'video.mp4');
    const musicPath  = path.join(jobDir, 'music.mp3');
    const outputPath = path.join(jobDir, 'output.mp4');

    console.log(`⬇️  test-mix: downloading video…`);
    await downloadFile(videoUrl, videoPath);
    console.log(`⬇️  test-mix: downloading music…`);
    await downloadFile(musicUrl, musicPath);
    console.log(`🎬 test-mix: mixing…`);
    await mixRecordingAudioWithMusic(videoPath, musicPath, outputPath, musicVolume);

    const outputSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    console.log(`📦 test-mix output: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);

    let finalUrl = null;
    if (bucket) {
      const storagePath = `test/testmix_${Date.now()}.mp4`;
      finalUrl = await uploadToFirebase(outputPath, storagePath);
    } else {
      const filename = `testmix_${Date.now()}.mp4`;
      const servePath = path.join(convertedDir, filename);
      fs.copyFileSync(outputPath, servePath);
      const serverBase = (process.env.EXPO_PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
      finalUrl = `${serverBase}/converted/${filename}`;
    }
    fs.rmSync(jobDir, { recursive: true, force: true });
    console.log(`✅ test-mix done: ${finalUrl?.substring(0, 80)}`);
    res.json({ success: true, finalUrl });
  } catch (err) {
    console.error('❌ test-mix failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mix-music-with-video', async (req, res) => {
  const { videoUrl, musicUrl, musicVolume = 0.15, storyId, replaceAudio = false, clipUrls, backgroundVideoUrl } = req.body;

  if (!videoUrl || !musicUrl) {
    return res.status(400).json({ error: 'videoUrl and musicUrl are required' });
  }

  try {
    const { mixMusicWithVideo, mixMusicWithVideoNoAudio, mixCubeWithVoicesAndMusic, mixRecordingAudioWithMusic } = require('./music/mixing-service');

    const jobDir = path.join(tempDir, `mix_${Date.now()}`);
    fs.mkdirSync(jobDir, { recursive: true });

    const videoPath = path.join(jobDir, 'video.mp4');
    const musicPath = path.join(jobDir, 'music.m4a');
    const outputPath = path.join(jobDir, 'final_with_music.mp4');
    const bgPath = path.join(jobDir, 'background.mp4');

    // Download cube video + music; also download participant clips if provided
    const clipPaths = [];
    const downloads = [
      downloadFile(videoUrl, videoPath),
      downloadFile(musicUrl, musicPath),
    ];
    if (backgroundVideoUrl) {
      downloads.push(downloadFile(backgroundVideoUrl, bgPath));
    }
    if (clipUrls && Array.isArray(clipUrls) && clipUrls.length > 0) {
      clipUrls.forEach((url, i) => {
        const p = path.join(jobDir, `clip_${i}.mp4`);
        clipPaths.push(p);
        downloads.push(downloadFile(url, p));
      });
      console.log(`📥 Downloading ${clipUrls.length} participant clips for voice mix...`);
    }
    await Promise.all(downloads);

    // Validate downloads before ffmpeg
    const videoSize = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
    const musicSize = fs.existsSync(musicPath) ? fs.statSync(musicPath).size : 0;
    console.log(`📦 Downloaded: video=${videoSize}b, music=${musicSize}b`);
    if (videoSize < 1000) throw new Error(`Video download too small (${videoSize}b) — likely redirect/error page`);
    if (musicSize < 1000) throw new Error(`Music download too small (${musicSize}b) — likely redirect/error page`);

    // Probe video streams for diagnosis
    await new Promise(resolve => {
      execFile('ffprobe', ['-v', 'error', '-show_streams', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate',
        '-of', 'default=noprint_wrappers=1', videoPath],
        (err, stdout) => {
          console.log(`🔍 Video stream: ${stdout?.trim() || err?.message || 'unknown'}`);
          resolve();
        });
    });

    // If a background video URL was provided, composite it behind the cube.
    // colorkey makes pure-black pixels in the cube recording transparent, then overlays
    // the result over the background. Unlike blend=screen, this does NOT alter the colors
    // of the cube face videos — only the black areas (outside the cube) become transparent.
    let mixInputPath = videoPath;
    if (backgroundVideoUrl && fs.existsSync(bgPath) && fs.statSync(bgPath).size > 1000) {
      const compositedPath = path.join(jobDir, 'composited.mp4');
      console.log('🎨 Compositing background behind cube with colorkey...');
      await new Promise((resolve) => {
        execFile('ffmpeg', [
          '-i', bgPath,
          '-i', videoPath,
          '-filter_complex',
          '[1:v]colorkey=color=000000:similarity=0.15:blend=0.05[ck];' +
          '[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[bg];' +
          '[bg][ck]overlay=format=auto[v]',
          '-map', '[v]',
          '-map', '1:a?',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
          '-c:a', 'aac', '-shortest',
          '-y', compositedPath,
        ], { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) {
            console.warn('⚠️ Background colorkey failed, using original video:', err.message);
            if (stderr) console.warn('FFmpeg stderr:', stderr.slice(-500));
            resolve(); // fall through with original videoPath
          } else {
            console.log('✅ Background colorkey composited');
            mixInputPath = compositedPath;
            resolve();
          }
        });
      });
    }

    if (clipPaths.length > 0) {
      // Cube format: mix concatenated participant voices + music into silent cube video
      console.log(`🎬 Cube voice+music mix (${clipPaths.length} clips, musicVol=${musicVolume})`);
      await mixCubeWithVoicesAndMusic(mixInputPath, clipPaths, musicPath, outputPath, musicVolume);
    } else {
      // No clipUrls — use the recording's own audio [0:a] which is in-sync with video frames.
      // Fast single-pass with alimiter (no 2-pass loudnorm delay).
      const hasAudio = !replaceAudio && await probeVideoHasAudio(mixInputPath);
      console.log(`🔊 Video has audio: ${hasAudio}, replaceAudio: ${replaceAudio}`);
      if (hasAudio) {
        await mixRecordingAudioWithMusic(mixInputPath, musicPath, outputPath, musicVolume);
      } else {
        const noAudioVolume = 0.9;
        console.log(`🎵 No audio track — music-only mix at ${noAudioVolume}`);
        await mixMusicWithVideoNoAudio(mixInputPath, musicPath, outputPath, noAudioVolume);
      }
    }

    const mixedSizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    console.log(`📦 Mixed output size: ${mixedSizeBytes} bytes (${(mixedSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
    if (mixedSizeBytes < 50000) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      return res.status(422).json({
        error: `Mix failed: output file too small (${mixedSizeBytes} bytes). amix likely produced an empty container — check Render logs for FFmpeg details.`
      });
    }
    // Probe output video stream for diagnostics
    await new Promise(resolve => {
      execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
        'stream=codec_name,profile,pix_fmt,r_frame_rate,width,height', '-of', 'csv=p=0', outputPath],
        { timeout: 10000 }, (err, stdout) => {
          console.log(`🎬 Output video stream: ${stdout?.trim() || err?.message || 'none'}`);
          resolve();
        });
    });

    let finalUrl = null;
    if (bucket) {
      const storagePath = `edited/${storyId || 'unknown'}/final_music_${Date.now()}.mp4`;
      console.log(`☁️ Uploading mixed video to Firebase: ${storagePath}`);
      finalUrl = await uploadToFirebase(outputPath, storagePath);
      console.log(`✅ Mixed video uploaded: ${finalUrl?.substring(0, 80)}`);
    } else {
      // No Firebase bucket configured — serve file directly via /converted static route
      const filename = `mixed_${Date.now()}.mp4`;
      const servePath = path.join(convertedDir, filename);
      fs.copyFileSync(outputPath, servePath);
      const serverBase = (process.env.EXPO_PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
      finalUrl = `${serverBase}/converted/${filename}`;
      console.log('⚠️ No Firebase bucket — serving mixed file directly:', finalUrl);
    }

    fs.rmSync(jobDir, { recursive: true, force: true });

    res.json({ success: true, finalUrl, videoUrl: finalUrl });
  } catch (error) {
    console.error('❌ Mix music with video failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/remix-music — re-generate music for an existing story with optional user hint
app.post('/api/remix-music', express.json(), async (req, res) => {
  const { storyId, userHint, musicEngine } = req.body;
  if (!storyId) return res.status(400).json({ error: 'storyId required' });
  if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });

  // Load story from Firestore
  let story;
  try {
    const doc = await firestoreDb.collection('stories').doc(storyId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Story not found' });
    story = doc.data();
  } catch (err) {
    return res.status(500).json({ error: `Firestore read failed: ${err.message}` });
  }

  const sourceVideoUrl = story.sourceVideoUrl;
  if (!sourceVideoUrl) {
    return res.status(400).json({ error: 'sourceVideoUrl not stored — please re-record the video first' });
  }

  const transcriptionSegments = story.transcriptionSegments || [];
  const totalDuration          = story.totalDuration || 60;
  const numClips               = story.numClips || story.clipCount || 1;
  const excludeSet             = story.musicSet || null;

  const jobDir = path.join(tempDir, `remix_${Date.now()}`);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const { generateMusicForVideo, cleanupMusicFiles } = require('./music/music-service');
    const { mixMusicWithVideo, mixMusicWithVideoNoAudio } = require('./music/mixing-service');

    // 1. Generate new music (Suno or MusicGen) with userHint
    console.log(`🎵 Remixing music for story ${storyId}${userHint ? ` | hint: "${userHint}"` : ''}`);
    const musicResult = await generateMusicForVideo(
      transcriptionSegments, totalDuration, null, numClips, firestoreDb, userHint, excludeSet, musicEngine
    );
    if (!musicResult.success) {
      return res.status(500).json({ error: `Music generation failed: ${musicResult.error}` });
    }

    // 2. Upload music to Firebase Storage
    const musicStoragePath = `music/${storyId}/remix_${Date.now()}.m4a`;
    let musicUrl = null;
    if (bucket) {
      await bucket.upload(musicResult.musicPath, {
        destination: musicStoragePath,
        metadata: { contentType: 'audio/mp4' },
      });
      await bucket.file(musicStoragePath).makePublic();
      musicUrl = `https://storage.googleapis.com/${bucket.name}/${musicStoragePath}`;
    }
    cleanupMusicFiles(musicResult.musicPath);

    // 3. Download source video + mix
    const videoPath  = path.join(jobDir, 'source.mp4');
    const musicPath  = path.join(jobDir, 'music.m4a');
    const outputPath = path.join(jobDir, 'remixed.mp4');

    await Promise.all([
      downloadFile(sourceVideoUrl, videoPath),
      downloadFile(musicUrl || musicResult.musicPath, musicPath),
    ]);

    const hasAudio = await probeVideoHasAudio(videoPath);
    if (hasAudio) {
      await mixMusicWithVideo(videoPath, musicPath, outputPath, 0.014);
    } else {
      await mixMusicWithVideoNoAudio(videoPath, musicPath, outputPath, 0.15);
    }

    // 4. Upload mixed video to Firebase Storage
    let finalVideoUrl = null;
    if (bucket) {
      const mixedStoragePath = `edited/${storyId}/remix_${Date.now()}.mp4`;
      finalVideoUrl = await uploadToFirebase(outputPath, mixedStoragePath);
    }

    // 5. Update Firestore
    await firestoreDb.collection('stories').doc(storyId).update({
      finalVideoUrl,
      generatedMusicUrl: musicUrl,
      musicSet: musicResult.musicSet || null,
    });

    fs.rmSync(jobDir, { recursive: true, force: true });
    console.log(`✅ Remix complete for story ${storyId}: ${finalVideoUrl}`);
    res.json({ success: true, finalVideoUrl });

  } catch (err) {
    try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch (e) {}
    console.error('❌ Remix failed:', err);
    res.status(500).json({ error: err.message });
  }
});

async function downloadFile(url, outputPath, timeoutMs = 60000) {
  const protocol = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const cleanup = (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      reject(err);
    };
    const req = protocol.get(url, { timeout: timeoutMs }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath, timeoutMs).then(resolve).catch(reject);
      }
      if (response.statusCode && response.statusCode >= 400) {
        cleanup(new Error(`HTTP ${response.statusCode} downloading ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(outputPath); });
    });
    req.on('timeout', () => {
      req.destroy();
      cleanup(new Error(`Download timed out after ${timeoutMs / 1000}s: ${url}`));
    });
    req.on('error', cleanup);
  });
}

app.get('/api/ambient-library', (req, res) => {
  const { getAllPresets } = require('./music/ambient-library');
  res.json({ success: true, presets: getAllPresets() });
});

// GET /api/suno-sets — returns available Suno sets (grouped by set number)
// Each set entry includes: set number, key, bpm, tone, description, and preview URL (first track)
app.get('/api/suno-sets', async (req, res) => {
  const SET_META = [
    { set: 1,  key: 'Dm', bpm: 48,  tone: 'אובדן, עצב עמוק',      toneEn: 'loss, grief',            icon: 'rainy-outline' },
    { set: 2,  key: 'Am', bpm: 58,  tone: 'מלנכוליה, ערגה',        toneEn: 'melancholy, longing',     icon: 'moon-outline' },
    { set: 3,  key: 'C',  bpm: 64,  tone: 'תקווה, ריפוי',           toneEn: 'hope, healing',           icon: 'sunny-outline' },
    { set: 4,  key: 'G',  bpm: 70,  tone: 'חמימות, משפחה',          toneEn: 'warmth, family',          icon: 'heart-outline' },
    { set: 5,  key: 'D',  bpm: 76,  tone: 'הישג, גאווה',            toneEn: 'achievement, pride',      icon: 'trophy-outline' },
    { set: 6,  key: 'G',  bpm: 82,  tone: 'חגיגי, שמחה',            toneEn: 'celebratory, joyful',     icon: 'star-outline' },
    { set: 7,  key: 'D',  bpm: 92,  tone: 'אירוע גדול, קהילה',      toneEn: 'grand event, community',  icon: 'people-outline' },
    { set: 8,  key: 'A',  bpm: 104, tone: 'ספורט, אנרגיה',          toneEn: 'sport, energy',           icon: 'flash-outline' },
    { set: 9,  key: 'F',  bpm: 66,  tone: 'אינטימי, אישי',          toneEn: 'intimate, personal',      icon: 'flower-outline' },
    { set: 10, key: 'C',  bpm: 60,  tone: 'אוניברסלי, אמביינט',    toneEn: 'universal, ambient',      icon: 'globe-outline' },
    { set: 11, key: 'Em', bpm: 110, tone: 'דיגיטלי, מודרני',        toneEn: 'digital, modern',         icon: 'pulse-outline' },
  ];

  try {
    // Find which sets actually have tracks in Firestore
    let availableSets = new Set();
    if (firestoreDb) {
      const snap = await firestoreDb.collection('suno_tracks').get();
      snap.docs.forEach(d => {
        const s = parseInt(d.data().set);
        if (s) availableSets.add(s);
      });

      // Build result: only sets that have at least one track with a URL
      const tracksBySet = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const s = parseInt(data.set);
        if (!s || !data.url) return;
        if (!tracksBySet[s]) tracksBySet[s] = [];
        tracksBySet[s].push({ id: d.id, ...data });
      });

      const result = SET_META
        .filter(m => tracksBySet[m.set])
        .map(m => {
          const tracks = tracksBySet[m.set].sort((a, b) => (a.posInSet || 0) - (b.posInSet || 0));
          return {
            ...m,
            trackCount: tracks.length,
            previewUrl: tracks[0]?.url || null,
            previewTrackId: tracks[0]?.id || null,
          };
        });

      return res.json({ success: true, sets: result });
    }
  } catch (err) {
    console.error('suno-sets error:', err.message);
  }

  // Fallback: return all sets without availability info
  res.json({ success: true, sets: SET_META.map(m => ({ ...m, trackCount: 0, previewUrl: null })) });
});

app.post('/api/generate-ambient-library', async (req, res) => {
  if (!process.env.REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });
  }

  res.json({ success: true, message: 'Library generation started in background' });

  (async () => {
    try {
      const { generateFullLibrary } = require('./music/ambient-library');
      const results = await generateFullLibrary(bucket ? uploadToFirebase : null);
      
      const libraryData = {};
      for (const result of results) {
        if (result.success && result.firebaseUrl) {
          libraryData[result.preset.id] = {
            url: result.firebaseUrl,
            key: result.preset.key,
            bpm: result.preset.bpm,
            name: result.preset.name
          };
        }
      }

      if (firestoreDb) {
        await firestoreDb.collection('settings').doc('ambientLibrary').set({
          tracks: libraryData,
          generatedAt: new Date().toISOString(),
          trackCount: Object.keys(libraryData).length
        });
        console.log('✅ Ambient library metadata saved to Firestore');
      }

      console.log(`✅ Ambient library generation complete: ${Object.keys(libraryData).length} tracks`);
    } catch (error) {
      console.error('❌ Ambient library generation failed:', error);
    }
  })();
});

app.get('/api/ambient-track/:trackId', async (req, res) => {
  const { trackId } = req.params;
  
  try {
    if (firestoreDb) {
      const doc = await firestoreDb.collection('settings').doc('ambientLibrary').get();
      if (doc.exists) {
        const data = doc.data();
        const track = data.tracks?.[trackId];
        if (track) {
          return res.json({ success: true, track });
        }
      }
    }
    
    const { getPresetById } = require('./music/ambient-library');
    const preset = getPresetById(trackId);
    if (preset) {
      return res.json({ success: true, track: { key: preset.key, bpm: preset.bpm, name: preset.name, url: null } });
    }
    
    res.status(404).json({ error: 'Track not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Backgrounds ────────────────────────────────────────────────────

const bgUpload = multer({ dest: tempDir, limits: { fileSize: 200 * 1024 * 1024 } });

// GET /admin/backgrounds — list all backgrounds from Firestore
app.get('/admin/backgrounds', async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const snap = await firestoreDb.collection('backgrounds').orderBy('order', 'asc').get();
    const items = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    res.json({ backgrounds: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/backgrounds/upload — upload image or video, store in Storage + Firestore
app.post('/admin/backgrounds/upload', bgUpload.single('media'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!bucket) return res.status(503).json({ error: 'Firebase Storage not available' });
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { slug, nameHe, order = 99 } = req.body;
    if (!slug || !nameHe) return res.status(400).json({ error: 'slug and nameHe are required' });

    const origMime = req.file.mimetype || '';
    const isImage = origMime.startsWith('image/');
    const ext = isImage ? '.jpg' : '.mp4';
    const mediaType = isImage ? 'image' : 'video';

    const processedPath = path.join(tempDir, `bg_${slug}_${Date.now()}${ext}`);

    if (isImage) {
      // Resize image to max 720px wide, convert to JPEG
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', [
          '-i', tmpPath,
          '-vf', 'scale=720:-2',
          '-q:v', '3',
          '-y', processedPath,
        ], { timeout: 60000 }, (err) => err ? reject(err) : resolve());
      });
    } else {
      // Compress video: 15s, 720p, no audio
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', [
          '-i', tmpPath,
          '-t', '15',
          '-vf', 'scale=720:-2,fps=25',
          '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
          '-an', '-movflags', '+faststart',
          '-y', processedPath,
        ], { timeout: 120000 }, (err) => err ? reject(err) : resolve());
      });
    }

    const destPath = `backgrounds/${slug}${ext}`;
    await bucket.upload(processedPath, {
      destination: destPath,
      metadata: { contentType: isImage ? 'image/jpeg' : 'video/mp4' },
      public: true,
    });
    fs.unlink(processedPath, () => {});

    const url = `https://storage.googleapis.com/${bucket.name}/${destPath}`;

    // Save or update Firestore doc
    const existing = await firestoreDb.collection('backgrounds').where('slug', '==', slug).get();
    let firestoreId;
    if (!existing.empty) {
      firestoreId = existing.docs[0].id;
      await firestoreDb.collection('backgrounds').doc(firestoreId).update({
        url, nameHe, order: Number(order), active: true, mediaType,
      });
    } else {
      const docRef = await firestoreDb.collection('backgrounds').add({
        slug, nameHe, url, mediaType, type: mediaType, order: Number(order),
        active: true, createdAt: new Date(),
      });
      firestoreId = docRef.id;
    }

    res.json({ success: true, firestoreId, slug, url, mediaType });
  } catch (err) {
    console.error('❌ Background upload failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
  }
});

// PATCH /admin/backgrounds/:id — update fields (active, nameHe, order)
app.patch('/admin/backgrounds/:id', express.json(), async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const allowed = ['active', 'nameHe', 'order'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    await firestoreDb.collection('backgrounds').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/backgrounds/:id — remove from Firestore (+ optionally Storage)
app.delete('/admin/backgrounds/:id', async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const doc = await firestoreDb.collection('backgrounds').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });

    const { slug } = doc.data();
    // Delete from Storage
    if (bucket && slug) {
      try { await bucket.file(`backgrounds/${slug}.mp4`).delete(); } catch (_) {}
    }
    await firestoreDb.collection('backgrounds').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Music Library ────────────────────────────────────────────────────

const musicUpload = multer({ dest: tempDir, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /admin/music — list all tracks from Firestore suno_tracks collection
app.get('/admin/music', async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const snap = await firestoreDb.collection('suno_tracks').orderBy('num').get();
    const tracks = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/music/upload — upload MP3, save to Storage + Firestore
app.post('/admin/music/upload', musicUpload.single('audio'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    if (!bucket)      return res.status(503).json({ error: 'Storage not available' });
    if (!req.file)    return res.status(400).json({ error: 'No file uploaded' });

    const { num, set, key, bpm, instrument, tone, description, startOffset } = req.body;
    if (!num) return res.status(400).json({ error: 'num is required' });

    const trackNum = parseInt(num);
    const trackId  = `track-${String(trackNum).padStart(3, '0')}`;
    const storagePath = `music/suno-library/${trackId}.mp3`;

    // Upload to Storage
    await bucket.upload(tmpPath, {
      destination: storagePath,
      metadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=31536000' },
    });
    await bucket.file(storagePath).makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Save to Firestore
    const docData = {
      num: trackNum,
      id: trackId,
      set: parseInt(set) || 0,
      key: key || '',
      bpm: parseInt(bpm) || 0,
      instrument: instrument || '',
      tone: tone || '',
      description: description || '',
      startOffset: parseInt(startOffset) || 20,
      url,
      status: 'הועלה לפיירבייס',
      updatedAt: new Date().toISOString(),
    };
    await firestoreDb.collection('suno_tracks').doc(trackId).set(docData, { merge: true });

    try { fs.unlinkSync(tmpPath); } catch (_) {}
    res.json({ success: true, url, trackId });
  } catch (err) {
    try { if (tmpPath) fs.unlinkSync(tmpPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/music/:id — update startOffset or other fields
app.patch('/admin/music/:id', express.json(), async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const allowed = ['startOffset', 'description', 'status'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    await firestoreDb.collection('suno_tracks').doc(req.params.id).update(update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/music/:id — delete from Storage + Firestore
app.delete('/admin/music/:id', async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });
    const id  = req.params.id;
    if (bucket) {
      try { await bucket.file(`music/suno-library/${id}.mp3`).delete(); } catch (_) {}
    }
    await firestoreDb.collection('suno_tracks').doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics — aggregate usage stats from _analytics collection
app.get('/admin/analytics', async (req, res) => {
  try {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });

    const snap = await firestoreDb.collection('_analytics').orderBy('ts', 'desc').limit(500).get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data(), ts: d.data().ts?.toDate?.()?.toISOString() || null }));

    // Aggregate counters
    const counts = {};
    events.forEach(e => { counts[e.event] = (counts[e.event] || 0) + 1; });

    // Recent 20 events
    const recent = events.slice(0, 20).map(e => ({
      event: e.event,
      storyId: e.storyId || null,
      platform: e.platform || null,
      ts: e.ts,
    }));

    res.json({ success: true, counts, recent, total: events.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Memory cleanup: every 6 hours, evict job entries older than 6 hours
const JOB_TTL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  let cleaned = 0;
  for (const id of renderingJobs.keys()) {
    const ts = parseInt(id.substring(id.lastIndexOf('_') + 1));
    if (!isNaN(ts) && ts < cutoff) { renderingJobs.delete(id); cleaned++; }
  }
  for (const id of musicJobs.keys()) {
    const ts = parseInt(id.substring(id.lastIndexOf('_') + 1));
    if (!isNaN(ts) && ts < cutoff) { musicJobs.delete(id); cleaned++; }
  }
  if (cleaned > 0) console.log(`🧹 Evicted ${cleaned} old job entries from memory`);
}, JOB_TTL_MS);

// Temp file cleanup: every 30 min, delete files not touched in 2+ hours
const TMP_TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - TMP_TTL_MS;
  [tempDir, convertedDir].forEach(dir => {
    try {
      fs.readdirSync(dir).forEach(name => {
        const p = path.join(dir, name);
        try {
          if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { recursive: true, force: true });
        } catch (e) {}
      });
    } catch (e) {}
  });
}, 30 * 60 * 1000);

// ─── Story & Account Deletion ─────────────────────────────────────────────────

/**
 * Delete all Storage files and Firestore sub-documents for a single story.
 * Shared by both /api/delete-story and /api/delete-account.
 * All sub-operations use .catch(() => {}) so a missing file never aborts the whole delete.
 */
async function _deleteStoryData(storyId) {
  // 1. Storage: root mp4 + stories/{id}/ folder + reflections/{id}/ folder
  if (bucket) {
    await bucket.file(`stories/${storyId}.mp4`).delete().catch(() => {});
    const [storyFiles] = await bucket.getFiles({ prefix: `stories/${storyId}/` }).catch(() => [[]]);
    await Promise.all(storyFiles.map(f => f.delete().catch(() => {})));
    const [reflFiles] = await bucket.getFiles({ prefix: `reflections/${storyId}/` }).catch(() => [[]]);
    await Promise.all(reflFiles.map(f => f.delete().catch(() => {})));
  }
  // 2. Firestore: reflections, invitations, applications, then the story doc itself
  const [reflSnap, invSnap, appSnap] = await Promise.all([
    firestoreDb.collection('reflections').where('storyId', '==', storyId).get(),
    firestoreDb.collection('invitations').where('storyId', '==', storyId).get(),
    firestoreDb.collection('applications').where('storyId', '==', storyId).get(),
  ]);
  await Promise.all([
    ...reflSnap.docs.map(d => d.ref.delete()),
    ...invSnap.docs.map(d => d.ref.delete()),
    ...appSnap.docs.map(d => d.ref.delete()),
    firestoreDb.collection('stories').doc(storyId).delete(),
  ]);
}

// POST /api/delete-story
// Full cascade delete for a single story: Storage files + reflections + invitations + applications + Firestore doc.
// Body: { storyId, idToken }
// Verified via Firebase ID token — only the story owner can delete.
app.post('/api/delete-story', async (req, res) => {
  const { storyId, idToken } = req.body || {};
  if (!storyId || !idToken) return res.status(400).json({ error: 'storyId and idToken required' });
  if (!adminAuth)   return res.status(503).json({ error: 'Auth service not available' });
  if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const storySnap = await firestoreDb.collection('stories').doc(storyId).get();
    if (!storySnap.exists) return res.status(404).json({ error: 'Story not found' });
    if (storySnap.data().userId !== uid) return res.status(403).json({ error: 'Forbidden: not the story owner' });

    await _deleteStoryData(storyId);
    console.log(`✅ Story ${storyId} fully deleted by ${uid}`);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Delete story error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delete-account
// Deletes all data for a user account: every story they own (Storage + reflections + invitations + applications),
// their Firestore user profile, and finally their Firebase Auth record.
// Body: { idToken }
// Does NOT touch stories created by other users.
app.post('/api/delete-account', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken)     return res.status(400).json({ error: 'idToken required' });
  if (!adminAuth)   return res.status(503).json({ error: 'Auth service not available' });
  if (!firestoreDb) return res.status(503).json({ error: 'Firestore not available' });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Delete every story created by this user
    const storiesSnap = await firestoreDb.collection('stories').where('userId', '==', uid).get();
    await Promise.all(storiesSnap.docs.map(d => _deleteStoryData(d.id)));

    // Delete Firestore user profile
    await firestoreDb.collection('users').doc(uid).delete().catch(() => {});

    // Delete Firebase Auth record — must be last (token becomes invalid after this)
    await adminAuth.deleteUser(uid);
    console.log(`✅ Account ${uid} deleted (${storiesSnap.size} stories removed)`);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── INVITATION SYSTEM ────────────────────────────────────────────────────────

const crypto = require('crypto');

async function sendConsentDeclinedNotification(storyId, participantName, reason) {
  if (!firestoreDb) return;
  try {
    const storyDoc = await firestoreDb.collection('stories').doc(storyId).get();
    if (!storyDoc.exists) return;
    const { userId, name: storyName = '' } = storyDoc.data();
    if (!userId) return;
    const userDoc = await firestoreDb.collection('users').doc(userId).get();
    const pushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
    await expoClient.sendPushNotificationsAsync([{
      to: pushToken,
      title: 'שחקן לא הסכים לתנאים',
      body: `${participantName} לא הסכים לתנאי הפרסום של '${storyName}'`,
      data: { storyId, type: 'consent_declined', storyName, participantName, reason },
    }]);
    console.log(`🔔 Consent declined notification sent for story ${storyId}, player ${participantName}`);
  } catch (err) {
    console.warn(`⚠️ sendConsentDeclinedNotification failed: ${err.message}`);
  }
}

// POST /api/invitations/create — creator creates personal invitation link
app.post('/api/invitations/create', async (req, res) => {
  if (!firestoreDb) return res.status(503).json({ error: 'DB not ready' });
  const { storyId, participantName, participantPhone } = req.body || {};
  if (!storyId || !participantName) {
    return res.status(400).json({ error: 'storyId and participantName are required' });
  }
  try {
    const token = crypto.randomUUID();
    const domain = process.env.SERVER_DOMAIN || 'reflectlymobilex.onrender.com';
    const inviteUrl = `https://${domain}/invite/${token}`;

    const docRef = await firestoreDb.collection('invitations').add({
      storyId,
      participantName: participantName.trim(),
      participantPhone: participantPhone || null,
      token,
      status: 'pending',
      platformConsent: null,
      platformConsentAt: null,
      projectConsent: null,
      projectConsentAt: null,
      publicPublishingConsent: null,
      publicPublishingConsentAt: null,
      communityConsent: null,
      communityConsentAt: null,
      consentVersion: '1.0',
      declineReason: null,
      createdAt: firestoreDb.constructor.Timestamp
        ? firestoreDb.constructor.Timestamp.now()
        : new Date(),
      openedAt: null,
      recordingStartedAt: null,
      recordingCompletedAt: null,
    });

    console.log(`✅ Invitation created: ${docRef.id} for "${participantName}" story ${storyId}`);
    res.json({ success: true, invitationId: docRef.id, token, inviteUrl });
  } catch (err) {
    console.error('Create invitation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invitations/resolve/:token — player opens link, token resolves to story + participant info
app.get('/api/invitations/resolve/:token', async (req, res) => {
  if (!firestoreDb) return res.status(503).json({ error: 'DB not ready' });
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const snap = await firestoreDb.collection('invitations').where('token', '==', token).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'invitation_not_found' });

    const invDoc = snap.docs[0];
    const inv = invDoc.data();

    if (inv.status === 'expired') return res.status(410).json({ error: 'invitation_expired' });

    // Mark as opened
    await invDoc.ref.update({ status: 'opened', openedAt: new Date() });

    // Load story data
    const storyDoc = await firestoreDb.collection('stories').doc(inv.storyId).get();
    const storyData = storyDoc.exists ? storyDoc.data() : null;

    res.json({
      success: true,
      invitationId: invDoc.id,
      storyId: inv.storyId,
      participantName: inv.participantName,
      storyData: storyData ? {
        name: storyData.name,
        creatorName: storyData.creatorName,
        instructions: storyData.instructions,
        instructionAudioUrl: storyData.instructionAudioUrl,
        videoUri: storyData.videoUri,
        language: storyData.language,
        privacySettings: storyData.privacySettings,
        storyType: storyData.storyType,
        communitySettings: storyData.communitySettings,
      } : null,
    });
  } catch (err) {
    console.error('Resolve invitation token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invitations/:id/consent — player saves consent
app.post('/api/invitations/:id/consent', async (req, res) => {
  if (!firestoreDb) return res.status(503).json({ error: 'DB not ready' });
  const { id } = req.params;
  const { platformConsent, projectConsent, publicPublishingConsent, communityConsent, consentVersion } = req.body || {};
  if (!id) return res.status(400).json({ error: 'invitationId required' });
  try {
    const now = new Date();
    await firestoreDb.collection('invitations').doc(id).update({
      status: 'recording_started',
      platformConsent: !!platformConsent,
      platformConsentAt: platformConsent ? now : null,
      platformConsentVersion: consentVersion || '1.0',
      projectConsent: !!projectConsent,
      projectConsentAt: projectConsent ? now : null,
      publicPublishingConsent: publicPublishingConsent ?? null,
      publicPublishingConsentAt: publicPublishingConsent != null ? now : null,
      communityConsent: communityConsent ?? null,
      communityConsentAt: communityConsent != null ? now : null,
      consentVersion: consentVersion || '1.0',
      recordingStartedAt: now,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Save consent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invitations/:id/decline — player declines, notify creator
app.post('/api/invitations/:id/decline', async (req, res) => {
  if (!firestoreDb) return res.status(503).json({ error: 'DB not ready' });
  const { id } = req.params;
  const { reason = 'publishing_conflict' } = req.body || {};
  try {
    const invDoc = await firestoreDb.collection('invitations').doc(id).get();
    if (!invDoc.exists) return res.status(404).json({ error: 'invitation_not_found' });
    const inv = invDoc.data();

    await invDoc.ref.update({
      status: 'declined',
      declineReason: reason,
    });

    // Update story with declined name for MyStoriesScreen banner
    await firestoreDb.collection('stories').doc(inv.storyId).update({
      declinedConsentName: inv.participantName,
      declinedConsentReason: reason,
    });

    // Push notification to creator (fire and forget)
    sendConsentDeclinedNotification(inv.storyId, inv.participantName, reason).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('Decline invitation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /invite/:token — web landing page that deep-links to app or shows web consent
app.get('/invite/:token', async (req, res) => {
  const { token } = req.params;
  const domain = process.env.SERVER_DOMAIN || 'reflectlymobilex.onrender.com';
  // Redirect to app via universal link; if not installed → web recording page
  res.redirect(`https://${domain}/record-invite?token=${token}`);
});

// GET /record-invite?token=TOKEN — resolve invitation token and render web recording page with consent
app.get('/record-invite', async (req, res) => {
  const { token } = req.query;
  if (!token || !firestoreDb) return res.status(400).send('Invalid invitation link');

  let invitation = null;
  try {
    const snap = await firestoreDb.collection('invitations')
      .where('token', '==', token).limit(1).get();
    if (!snap.empty) invitation = { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (e) {
    console.warn('record-invite: could not resolve token:', e.message);
  }
  if (!invitation || invitation.status === 'declined') {
    return res.status(404).send('Invitation not found or already declined');
  }

  const { storyId, participantName } = invitation;
  let story = null;
  try {
    const sSnap = await firestoreDb.collection('stories').doc(storyId).get();
    if (sSnap.exists) story = { id: sSnap.id, ...sSnap.data() };
  } catch (e) {
    console.warn('record-invite: could not load story:', e.message);
  }
  if (!story) return res.status(404).send('Story not found');

  // Mark invitation as opened
  firestoreDb.collection('invitations').doc(invitation.id)
    .update({ status: 'opened', openedAt: new Date() }).catch(() => {});

  const musicTrackId = story.musicAmbient?.id || (
    story.music && story.music !== 'none' && story.music !== 'ai-generated' ? story.music : null
  );
  let musicUrl = story.musicAmbient?.url || null;

  const storyData = {
    id:              story.id,
    name:            story.name            || '',
    creatorName:     story.creatorName     || '',
    clipCount:       story.clipCount       || 3,
    maxClipDuration: story.maxClipDuration || 60,
    instructions:    story.instructions   || '',
    videoUri:        story.videoUri || story.videoUrl || story.keyStoryUrl || null,
    instructionAudioUrl: story.instructionAudioUrl || null,
    musicUrl,
    musicTrackId,
    hasMusic:        !!(musicUrl || musicTrackId),
    musicName:       story.musicAmbient?.nameHe || story.musicAmbient?.name || null,
    lockedSet:       story.lockedSet || null,
    language:        story.language || 'he',
    allowSocialMedia: !!(story.privacySettings?.allowSocialMedia),
  };

  const invitationContext = {
    invitationId: invitation.id,
    participantName,
    requiresPublicConsent: !!(story.privacySettings?.allowSocialMedia),
  };

  const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(buildWebRecordHtml(storyData, firebaseConfig, invitationContext));
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video Converter API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('AI endpoints: /api/transcribe, /api/analyze-story, /api/editing-suggestions, /api/generate-title');
  console.log('Music: /api/generate-music, /api/music-status/:jobId, /api/mix-music-with-video');
  console.log('Audio enhance: /api/enhance-clip-audio (Demucs vocal separation + music mix)');
  console.log('Ambient: /api/ambient-library, /api/generate-ambient-library, /api/ambient-track/:id');
  console.log('New: /api/convert-url - Convert webm to mp4');
  console.log('Admin: /admin (backgrounds management UI)');
});
