#!/usr/bin/env node
/**
 * Upload HomeScreen background video to Firebase Storage
 * Usage: node scripts/upload-home-bg.js <path-to-video>
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const videoPath = process.argv[2];
const destName = process.argv[3]; // e.g. home-background or director-background
if (!videoPath || !destName) {
  console.error('Usage: node scripts/upload-home-bg.js <path-to-video> <dest-name>');
  console.error('Example: node scripts/upload-home-bg.js video.mp4 home-background');
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error('File not found:', videoPath);
  process.exit(1);
}

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
  client_id: process.env.FIREBASE_CLIENT_ID || '',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
});

const storage = getStorage();
const bucket = storage.bucket();

const destPath = `assets/${destName}.mp4`;

console.log(`Uploading ${videoPath} → gs://${bucket.name}/${destPath}`);

bucket.upload(videoPath, {
  destination: destPath,
  metadata: {
    contentType: 'video/mp4',
    cacheControl: 'public, max-age=31536000',
  },
}).then(async ([file]) => {
  // Make the file publicly readable
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
  console.log('\n✅ Upload complete!');
  console.log('Public URL:', publicUrl);
  console.log('\nAdd this to your .env as:');
  console.log(`HOME_BG_VIDEO_URL=${publicUrl}`);
  process.exit(0);
}).catch(err => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
