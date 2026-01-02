import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      type: "service_account" as const,
      project_id: process.env.FIREBASE_PROJECT_ID || '',
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || '',
      universe_domain: "googleapis.com"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'reflectly-playback.firebasestorage.app'
    });

    console.log('Firebase Storage ACTIVATED - Videos will be stored in cloud');
    console.log('Storage bucket:', process.env.FIREBASE_STORAGE_BUCKET);
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    console.log('Continuing without Firebase Storage...');
  }
}

let storage: any = null;
let bucket: any = null;

try {
  if (admin.apps.length > 0) {
    storage = getStorage();
    bucket = storage.bucket();
    console.log('Firebase Storage initialized');
  }
} catch (error) {
  console.log('Local Storage MODE - Videos saved to server disk');
  console.log('Firebase setup incomplete, continuing with local storage');
}

export { storage, bucket };

export function getPublicUrl(filePath: string): string {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'reflectly-playback.firebasestorage.app';
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
