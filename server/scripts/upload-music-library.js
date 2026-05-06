/**
 * upload-music-library.js
 * מעלה טרקים מ- music-library/tracks/ לפיירבייס
 * מריץ: node server/scripts/upload-music-library.js
 * מדלג אוטומטית על טרקים שכבר הועלו
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

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
      privateKey,
    }),
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

const TRACKS_DIR = path.join(__dirname, '../../music-library/tracks');
const CATALOG_CSV = path.join(__dirname, '../../music-library/catalog.csv');

async function fileExistsInStorage(storagePath) {
  const [exists] = await bucket.file(storagePath).exists();
  return exists;
}

async function uploadFile(localPath, storagePath) {
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
    },
  });
  await bucket.file(storagePath).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

function updateCsvStatus(trackNum, url) {
  if (!fs.existsSync(CATALOG_CSV)) return;
  const lines = fs.readFileSync(CATALOG_CSV, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const first = lines[i].split(',')[0];
    if (parseInt(first) === trackNum) {
      const parts = lines[i].split(',');
      // עמודה 8 = סטטוס, עמודה 9 = URL
      parts[8] = 'הועלה לפיירבייס';
      parts[9] = url;
      lines[i] = parts.join(',');
      break;
    }
  }
  fs.writeFileSync(CATALOG_CSV, lines.join('\n'), 'utf8');
}

async function main() {
  console.log('=== העלאת ספריית מוזיקה לפיירבייס ===\n');

  if (!fs.existsSync(TRACKS_DIR)) {
    console.error(`❌ תיקיה לא קיימת: ${TRACKS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRACKS_DIR)
    .filter(f => /^track-\d{3}\.mp3$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  אין טרקים בתיקיה. הכנס track-001.mp3 וכו׳');
    process.exit(0);
  }

  console.log(`📁 נמצאו ${files.length} טרקים\n`);

  const firestoreData = {};
  let uploaded = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const trackNum = parseInt(file.replace('track-', '').replace('.mp3', ''));
    const storagePath = `music/suno-library/${file}`;
    const localPath = path.join(TRACKS_DIR, file);

    process.stdout.write(`[${String(trackNum).padStart(3, '0')}] ${file} ... `);

    const exists = await fileExistsInStorage(storagePath);
    if (exists) {
      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      firestoreData[trackNum] = url;
      skipped++;
      console.log('כבר קיים ✓');
      continue;
    }

    try {
      const url = await uploadFile(localPath, storagePath);
      firestoreData[trackNum] = url;
      updateCsvStatus(trackNum, url);
      uploaded++;
      console.log('הועלה ✅');
    } catch (err) {
      failed++;
      console.error(`נכשל ❌  ${err.message}`);
    }
  }

  if (Object.keys(firestoreData).length > 0) {
    try {
      await db.collection('settings').doc('sunoLibrary').set({
        tracks: firestoreData,
        trackCount: Object.keys(firestoreData).length,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('\n✅ Firestore עודכן: settings/sunoLibrary');
    } catch (err) {
      console.error('\n❌ Firestore נכשל:', err.message);
    }
  }

  console.log(`\n=== סיכום ===`);
  console.log(`הועלו: ${uploaded} | קיימים: ${skipped} | נכשלו: ${failed}`);
  console.log(`סה"כ בפיירבייס: ${Object.keys(firestoreData).length} טרקים`);
}

main().catch(console.error);
