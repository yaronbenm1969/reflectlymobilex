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
const { Expo } = require('expo-server-sdk');
const expoClient = new Expo();
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const { ConversionQueue } = require('./conversion-queue');
const { renderFormatVideo, cleanupRenderDir } = require('./format-renderer');
const { buildWebRecordHtml } = require('./web-record-template');

const app = express();

const MAX_CONCURRENT_CONVERSIONS = parseInt(process.env.MAX_CONCURRENT_CONVERSIONS) || 3;
const conversionQueue = new ConversionQueue({ maxConcurrent: MAX_CONCURRENT_CONVERSIONS });
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-app-access-code']
}));
app.use(express.json());

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const ACCESS_CODE = process.env.ACCESS_CODE || '';

const tempDir = path.join(os.tmpdir(), 'reflectly-server', 'uploads');
const convertedDir = path.join(os.tmpdir(), 'reflectly-server', 'converted');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });
const upload = multer({ dest: tempDir, limits: { fileSize: 100 * 1024 * 1024 } });

const PUBLIC_ROUTES = ['/health', '/api/maintenance-status', '/api/verify-access', '/api/convert-from-url', '/api/convert-url', '/api/queue', '/converted', '/api/stories', '/api/render-status', '/api/generate-music', '/api/music-status', '/join', '/record', '/api/upload-player-clip', '/api/player-upload-url', '/api/player-clip-done', '/api/ambient-track', '/api/suno-sets', '/api/test-mix'];

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

// Deep-link redirect page — handles both users with the app and without
// WhatsApp makes HTTPS links clickable; custom scheme (reflectly://) links appear as plain text
app.get('/join/:storyId', (req, res) => {
  const { storyId } = req.params;
  const appLink = `reflectly://s/${storyId}`;
  // TODO: replace with real store URLs once published
  const APP_STORE_URL = 'https://apps.apple.com/app/reflectly/id0000000000';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reflectly.app';

  res.set('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הצטרף לסיפור ב-Reflectly</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0FA; color: #333; text-align: center; padding: 24px; }
    .logo { font-size: 48px; margin-bottom: 8px; }
    h1 { color: #FF6B9D; font-size: 26px; margin: 0 0 8px; }
    .sub { color: #888; font-size: 14px; margin-bottom: 32px; }
    .card { background: white; border-radius: 16px; padding: 24px; width: 100%; max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 16px; }
    .card h2 { font-size: 18px; margin: 0 0 8px; }
    .card p { font-size: 14px; color: #666; margin: 0 0 16px; line-height: 1.5; }
    a.btn { display: block; padding: 14px 20px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: bold; margin-bottom: 10px; }
    .btn-primary { background: #FF6B9D; color: white; }
    .btn-ios { background: #000; color: white; }
    .btn-android { background: #3DDC84; color: #000; }
    .btn-secondary { background: #f0e6ff; color: #8B5CF6; }
    .btn-web { background: #ecfdf5; color: #065f46; border: 2px solid #6ee7b7; }
    .divider { font-size: 13px; color: #aaa; margin: 4px 0 10px; }
    #phase-open { display: block; }
    #phase-install { display: none; }
    .spinner { width: 36px; height: 36px; border: 3px solid #eee; border-top-color: #FF6B9D; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 12px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="logo">🎬</div>
  <h1>Reflectly</h1>
  <p class="sub">הוזמנת לצלם שיקוף!</p>

  <!-- Phase 1: choose how to record -->
  <div id="phase-open" class="card">
    <h2>איך תרצה לצלם?</h2>
    <p>בחר את האפשרות המתאימה לך:</p>
    <a class="btn btn-web" href="/record/${storyId}">🌐 צלם ישירות בדפדפן</a>
    <div class="divider">— או אם יש לך את האפליקציה —</div>
    <a class="btn btn-primary" href="${appLink}" id="open-btn">פתח את Reflectly</a>
    <div class="divider">— אין לך עדיין? —</div>
    <a class="btn btn-secondary" href="#" onclick="showInstall(); return false;">הורד את האפליקציה</a>
  </div>

  <!-- Phase 2: install instructions -->
  <div id="phase-install" class="card">
    <h2>הורד את Reflectly</h2>
    <p>לאחר ההתקנה, חזור להודעה בווטסאפ ולחץ שוב על הלינק:</p>
    <a class="btn btn-ios" href="${APP_STORE_URL}" target="_blank">📱 iPhone — App Store</a>
    <a class="btn btn-android" href="${PLAY_STORE_URL}" target="_blank">🤖 אנדרואיד — Google Play</a>
    <div class="divider">— כבר התקנת? —</div>
    <a class="btn btn-primary" href="${appLink}">פתח את האפליקציה</a>
    <div class="divider">— או בלי אפליקציה —</div>
    <a class="btn btn-web" href="/record/${storyId}">🌐 צלם ישירות בדפדפן</a>
  </div>

  <script>
    function showInstall() {
      document.getElementById('phase-open').style.display = 'none';
      document.getElementById('phase-install').style.display = 'block';
    }
  </script>
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
  if (!req.file) return res.status(400).json({ error: 'No video file' });
  const { storyId, playerName, clipNumber = '1', webUid } = req.body;
  if (!storyId) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'storyId required' }); }

  try {
    const ext = req.file.originalname?.endsWith('.mp4') ? 'mp4' : 'webm';
    const storagePath = `stories/${storyId}/players/${webUid || ('web_' + Date.now())}/video${clipNumber}_${Date.now()}.${ext}`;

    let downloadUrl;
    if (bucket) {
      await bucket.upload(req.file.path, {
        destination: storagePath,
        metadata: { contentType: ext === 'mp4' ? 'video/mp4' : 'video/webm' },
      });
      await bucket.file(storagePath).makePublic();
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    } else {
      return res.status(503).json({ error: 'Storage not configured' });
    }

    fs.unlinkSync(req.file.path);

    // Save reflection document to Firestore
    if (firestoreDb && playerName) {
      await firestoreDb.collection('reflections').add({
        storyId,
        videoUrl:        downloadUrl,
        playerName:      playerName,
        participantName: playerName,
        uid:             webUid || 'web_anonymous',
        clipNumber:      parseInt(clipNumber, 10),
        source:          'web',
        createdAt:       new Date(),
      });
    }

    console.log(`✅ Player clip uploaded: ${storagePath}`);
    res.json({ success: true, url: downloadUrl });
  } catch (err) {
    console.error('❌ upload-player-clip failed:', err.message);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
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

  try {
    if (bucket) {
      await bucket.file(storagePath).makePublic();
    }
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    if (firestoreDb && playerName) {
      await firestoreDb.collection('reflections').add({
        storyId,
        videoUrl:        downloadUrl,
        playerName:      playerName,
        participantName: playerName,
        uid:             webUid || 'web_anonymous',
        clipNumber:      parseInt(clipNumber, 10) || 1,
        source:          'web',
        createdAt:       new Date(),
      });
    }

    console.log(`✅ Player clip done (direct upload): ${storagePath}`);
    res.json({ success: true, url: downloadUrl });
  } catch (err) {
    console.error('❌ player-clip-done failed:', err.message);
    res.status(500).json({ error: err.message });
  }
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
    if (!response.ok) {
      throw new Error('Failed to download video');
    }
    
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Downloaded: ${outputPath} (${buffer.length} bytes)`);
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
  const { videoUrl, musicUrl, musicVolume = 0.08, storyId, replaceAudio = false, clipUrls, backgroundVideoUrl = null } = req.body;

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

    // Download cube video + music; also download participant clips if provided
    const clipPaths = [];
    const downloads = [
      downloadFile(videoUrl, videoPath),
      downloadFile(musicUrl, musicPath),
    ];
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

    // === BACKGROUND COMPOSITE (optional) ===
    console.log(`🖼️ Background composite: ${backgroundVideoUrl ? 'yes' : 'no'}`);
    let mixInputPath = videoPath;
    if (backgroundVideoUrl) {
      const bgPath = path.join(jobDir, 'bg.mp4');
      const compositedPath = path.join(jobDir, 'composited.mp4');
      try {
        await downloadFile(backgroundVideoUrl, bgPath);
        console.log(`🖼️ Background downloaded: ${fs.statSync(bgPath).size} bytes`);
        await new Promise((resolve, reject) => {
          execFile('ffmpeg', [
            '-stream_loop', '-1', '-i', bgPath,
            '-i', videoPath,
            '-filter_complex', '[1:v]colorkey=0x000000:0.1:0.05[cubekey];[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[bg];[bg][cubekey]overlay=0:0[v]',
            '-map', '[v]',
            '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'copy',
            '-shortest',
            '-y', compositedPath,
          ], { timeout: 120000 }, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log(`🖼️ Composite succeeded (${fs.statSync(compositedPath).size} bytes)`);
        mixInputPath = compositedPath;
      } catch (bgErr) {
        console.warn(`⚠️ Background composite failed, using raw cube video: ${bgErr.message}`);
      }
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

async function downloadFile(url, outputPath) {
  const protocol = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(outputPath); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      reject(err);
    });
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
