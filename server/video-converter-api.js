const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

async function convertVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Converting: ${inputPath} -> ${outputPath}`);
    
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
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
  res.json({ 
    status: 'ok', 
    firebase: bucket ? 'connected' : 'not configured',
    ffmpeg: 'available'
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

  try {
    let finalPath = inputPath;
    let wasConverted = false;

    if (needsConversion(mimeType, originalName)) {
      console.log('Video needs conversion (HEVC/MOV -> H.264/MP4)');
      const outputPath = path.join(convertedDir, `${storyId}_${Date.now()}.mp4`);
      await convertVideo(inputPath, outputPath);
      finalPath = outputPath;
      wasConverted = true;
      fs.unlinkSync(inputPath);
    }

    let storagePath;
    if (type === 'reflection' && recipientId) {
      storagePath = `reflections/${storyId}/${recipientId}_clip${clipNumber || 1}.mp4`;
    } else {
      storagePath = `stories/${storyId}.mp4`;
    }

    let publicUrl;
    if (bucket) {
      publicUrl = await uploadToFirebase(finalPath, storagePath);
      console.log(`Uploaded to Firebase: ${publicUrl}`);
    } else {
      publicUrl = `/local-videos/${path.basename(finalPath)}`;
      console.log('Saved locally (Firebase not configured)');
    }

    if (wasConverted || bucket) {
      fs.unlinkSync(finalPath);
    }

    res.json({
      success: true,
      url: publicUrl,
      converted: wasConverted,
      storagePath
    });

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
  
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error('Failed to download video');
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const inputPath = path.join(tempDir, `download_${Date.now()}.mov`);
    const outputPath = path.join(convertedDir, `converted_${storyId || Date.now()}.mp4`);
    
    fs.writeFileSync(inputPath, buffer);
    console.log(`Downloaded video: ${buffer.length} bytes`);
    
    await convertVideo(inputPath, outputPath);
    
    fs.unlinkSync(inputPath);
    
    if (bucket) {
      const storagePath = `converted/${storyId || Date.now()}.mp4`;
      const publicUrl = await uploadToFirebase(outputPath, storagePath);
      fs.unlinkSync(outputPath);
      
      convertedCache.set(cacheKey, publicUrl);
      console.log('Converted and uploaded:', publicUrl);
      res.json({ success: true, url: publicUrl, converted: true });
    } else {
      const publicUrl = `/converted/${path.basename(outputPath)}`;
      convertedCache.set(cacheKey, publicUrl);
      console.log('Converted locally:', publicUrl);
      res.json({ success: true, url: publicUrl, converted: true });
    }
    
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
  'reflectly-mobile-x--yaronbenm1.replit.app'
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

app.post('/api/stories/:storyId/render', async (req, res) => {
  const { storyId } = req.params;
  const { videoUrls, format = 'standard', musicUrl } = req.body;
  
  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ error: 'videoUrls array is required' });
  }
  
  const invalidUrls = videoUrls.filter(url => !isAllowedVideoUrl(url));
  if (invalidUrls.length > 0) {
    console.warn('Blocked invalid video URLs:', invalidUrls);
    return res.status(400).json({ 
      error: 'Invalid video URLs detected', 
      message: 'Only Firebase Storage URLs are allowed'
    });
  }
  
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
      for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
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
        
        renderingJobs.get(jobId).progress = 10 + Math.round((i + 1) / videoUrls.length * 40);
      }
      
      renderingJobs.get(jobId).progress = 50;
      
      const outputPath = path.join(convertedDir, `final_${jobId}.mp4`);
      await concatenateVideos(localPaths, outputPath);
      
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

app.get('/api/render-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = renderingJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video Converter API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('AI endpoints: /api/transcribe, /api/analyze-story, /api/editing-suggestions, /api/generate-title');
});
