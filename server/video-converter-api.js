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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video Converter API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
