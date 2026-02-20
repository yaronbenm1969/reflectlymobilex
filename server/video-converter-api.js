const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const { ConversionQueue } = require('./conversion-queue');
const { renderFormatVideo, cleanupRenderDir } = require('./format-renderer');

const app = express();

const MAX_CONCURRENT_CONVERSIONS = parseInt(process.env.MAX_CONCURRENT_CONVERSIONS) || 3;
const conversionQueue = new ConversionQueue({ maxConcurrent: MAX_CONCURRENT_CONVERSIONS });
const PORT = 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-app-access-code']
}));
app.use(express.json());

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const ACCESS_CODE = process.env.ACCESS_CODE || '';

const PUBLIC_ROUTES = ['/health', '/api/maintenance-status', '/api/verify-access', '/api/convert-from-url', '/api/convert-url', '/api/queue', '/converted', '/api/stories', '/api/render-status'];

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

app.use(accessControlMiddleware);

const tempDir = path.join(process.cwd(), 'temp', 'uploads');
const convertedDir = path.join(process.cwd(), 'temp', 'converted');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(convertedDir)) {
  fs.mkdirSync(convertedDir, { recursive: true });
}

const upload = multer({ 
  dest: tempDir,
  limits: { fileSize: 100 * 1024 * 1024 }
});

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
  
  const audioFilter = 'highpass=f=80,lowpass=f=13000,afftdn=nf=-25:nr=12:nt=w,acompressor=threshold=-20dB:ratio=3:attack=5:release=50,volume=1.1';
  console.log(`🔊 Audio noise reduction filter: ${audioFilter}`);
  
  if (!hasAudio) {
    console.log('⚠️ No audio track found - adding silent audio via raw ffmpeg for iOS compatibility');
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
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
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
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
        console.log('Conversion completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Conversion error:', err);
        reject(err);
      })
      .run();
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

  try {
    const result = await aiService.transcribeVideo(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
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

function getTransitionFilter(format) {
  switch (format) {
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
  
  if (!transition || inputPaths.length < 2) {
    console.log(`Using simple concatenation (format: ${format})`);
    return concatenateVideos(inputPaths, outputPath);
  }
  
  console.log(`Concatenating with ${transition} transitions (format: ${format})`);

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
    
    if (n === 2) {
      const offset = Math.max(0.5, durations[0] - TRANSITION_DURATION);
      filterComplex += `[v0][v1]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(2)}[vout];`;
      filterComplex += `[a0][a1]acrossfade=d=${TRANSITION_DURATION}[aout]`;
    } else {
      let lastV = 'v0';
      let lastA = 'a0';
      let cumulativeOffset = Math.max(0.5, durations[0] - TRANSITION_DURATION);
      
      for (let i = 1; i < n; i++) {
        const outV = i === n - 1 ? 'vout' : `vt${i}`;
        const outA = i === n - 1 ? 'aout' : `at${i}`;
        
        filterComplex += `[${lastV}][v${i}]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${cumulativeOffset.toFixed(2)}[${outV}];`;
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
      
      const localPaths = [];
      for (let i = 0; i < processVideos.length; i++) {
        const url = processVideos[i];
        const ext = url.toLowerCase().includes('.webm') ? 'webm' : 'mp4';
        const localPath = path.join(downloadDir, `clip_${i}.${ext}`);
        await downloadVideo(url, localPath);
        
        if (ext === 'webm') {
          const mp4Path = path.join(downloadDir, `clip_${i}.mp4`);
          await convertVideo(localPath, mp4Path);
          fs.unlinkSync(localPath);
          localPaths.push(mp4Path);
        } else {
          localPaths.push(localPath);
        }
        
        renderingJobs.get(jobId).progress = 10 + Math.round((i + 1) / processVideos.length * 40);
      }
      
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
  const { videoUrls, format = 'cube-3d', storyName = '' } = req.body;
  
  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ error: 'videoUrls array is required' });
  }
  
  const invalidUrls = videoUrls.filter(url => !isAllowedVideoUrl(url));
  if (invalidUrls.length > 0) {
    return res.status(400).json({ error: 'Invalid video URLs', message: 'Only Firebase Storage URLs are allowed' });
  }
  
  console.log(`🎬 Format render: ${videoUrls.length} videos, format: ${format}, story: ${storyName}`);
  
  const renderKey = `${videoUrls.sort().join('|')}_${format}`;
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
      
      const outputPath = await renderFormatVideo(videoUrls, format, storyName, jobId, onProgress);
      
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
    const https = require('https');
    const http = require('http');
    const protocol = data.url.startsWith('https') ? https : http;
    
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input_${timestamp}.webm`);
    const outputPath = path.join(convertedDir, `output_${timestamp}.mp4`);
    
    updateProgress(10);
    
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(inputPath);
      protocol.get(data.url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(inputPath, () => {});
        reject(err);
      });
    });
    
    console.log('📥 Downloaded to:', inputPath);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video Converter API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('AI endpoints: /api/transcribe, /api/analyze-story, /api/editing-suggestions, /api/generate-title');
  console.log('New: /api/convert-url - Convert webm to mp4');
});
