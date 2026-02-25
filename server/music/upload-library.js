const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

const SPLIT_DIR = path.join(process.cwd(), 'temp', 'music', 'library', 'split');

const TRACKS = {
  'reflective-space': { name: 'Reflective Space', nameHe: 'מרחב פנימי', key: 'D', bpm: 60 },
  'gentle-warmth': { name: 'Gentle Warmth', nameHe: 'חום עדין', key: 'G', bpm: 65 },
  'soft-hope': { name: 'Soft Hope', nameHe: 'תקווה שקטה', key: 'C', bpm: 70 },
  'tender-vulnerability': { name: 'Tender Vulnerability', nameHe: 'עדינות רגשית', key: 'Am', bpm: 58 },
  'quiet-strength': { name: 'Quiet Strength', nameHe: 'כוח שקט', key: 'E', bpm: 62 },
  'light-movement': { name: 'Light Movement', nameHe: 'תנועה עדינה', key: 'A', bpm: 80 },
  'floating-memory': { name: 'Floating Memory', nameHe: 'זיכרון מרחף', key: 'Dm', bpm: 55 },
  'subtle-uplift': { name: 'Subtle Uplift', nameHe: 'התעלות עדינה', key: 'Bb', bpm: 72 },
  'open-horizon': { name: 'Open Horizon', nameHe: 'אופק פתוח', key: 'D', bpm: 75 },
  'electric-pulse': { name: 'Electric Pulse', nameHe: 'פעימה חשמלית', key: 'Fm', bpm: 122 },
  'world-celebration': { name: 'World Celebration', nameHe: 'חגיגה עולמית', key: 'G', bpm: 110 },
};

async function uploadFile(localPath, storagePath) {
  const file = bucket.file(storagePath);
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
    },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function main() {
  console.log('=== Uploading ambient library to Firebase ===\n');

  const libraryData = {
    tracks: {},
    generatedAt: new Date().toISOString(),
    trackCount: 0,
  };

  for (const [id, meta] of Object.entries(TRACKS)) {
    console.log(`Uploading: ${meta.name} (${id})...`);

    const phases = {};
    const phaseNames = ['phase1', 'phase2', 'phase3'];

    for (const phase of phaseNames) {
      const fileName = `${id}_${phase}.mp3`;
      const localPath = path.join(SPLIT_DIR, fileName);

      if (!fs.existsSync(localPath)) {
        console.error(`  Missing: ${fileName}`);
        continue;
      }

      const storagePath = `music/library/${id}/${phase}.mp3`;
      try {
        const url = await uploadFile(localPath, storagePath);
        phases[phase] = { url, storagePath };
        console.log(`  ${phase} -> uploaded`);
      } catch (err) {
        console.error(`  ${phase} FAILED: ${err.message}`);
      }
    }

    libraryData.tracks[id] = {
      name: meta.name,
      nameHe: meta.nameHe,
      key: meta.key,
      bpm: meta.bpm,
      phases,
    };
    libraryData.trackCount++;
  }

  try {
    await db.collection('settings').doc('ambientLibrary').set(libraryData);
    console.log('\nFirestore updated: settings/ambientLibrary');
  } catch (err) {
    console.error('\nFirestore update failed:', err.message);
  }

  console.log(`\n=== Done! ${libraryData.trackCount} tracks uploaded (${libraryData.trackCount * 3} files) ===`);
}

main().catch(console.error);
