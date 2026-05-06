/**
 * upload-music-library.js
 * Uploads tracks from music-library/tracks/ to Firebase Storage
 * and seeds Firestore suno_tracks collection with metadata from catalog-new.csv.
 *
 * Run: node server/scripts/upload-music-library.js
 * Skips tracks already uploaded (checks Storage existence).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
                || process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();
const db     = admin.firestore();

const TRACKS_DIR  = path.join(__dirname, '../../music-library/tracks');
const CATALOG_CSV = path.join(__dirname, '../../music-library/catalog-new.csv');

// ---------------------------------------------------------------------------
// Parse catalog-new.csv
// Columns: #, סט, מס' בסט, מפתח, BPM, כלי, גוון רגשי, תיאור, סטטוס, URL, startOffset
// ---------------------------------------------------------------------------
function parseCatalog() {
  if (!fs.existsSync(CATALOG_CSV)) {
    console.error(`❌ Catalog not found: ${CATALOG_CSV}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(CATALOG_CSV, 'utf8').split('\n').slice(1); // skip header
  const catalog = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const num = parseInt(parts[0]);
    if (isNaN(num)) continue;

    catalog[num] = {
      num,
      set:        parseInt(parts[1]) || 0,
      posInSet:   parseInt(parts[2]) || 0,
      key:        (parts[3] || '').trim(),
      bpm:        parseInt(parts[4]) || 0,
      instrument: (parts[5] || '').trim(),
      tone:       (parts[6] || '').trim(),
      description:(parts[7] || '').trim(),
      status:     (parts[8] || 'לא התחיל').trim(),
      url:        (parts[9] || '').trim(),
      startOffset: parseInt(parts[10]) || 45,
    };
  }

  return catalog;
}

async function fileExistsInStorage(storagePath) {
  const [exists] = await bucket.file(storagePath).exists();
  return exists;
}

async function uploadFile(localPath, storagePath) {
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType: 'audio/mpeg', cacheControl: 'public, max-age=31536000' },
  });
  await bucket.file(storagePath).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function main() {
  console.log('=== Suno Track Library Upload ===\n');

  if (!fs.existsSync(TRACKS_DIR)) {
    console.error(`❌ Tracks directory not found: ${TRACKS_DIR}`);
    process.exit(1);
  }

  const catalog = parseCatalog();
  console.log(`📋 Catalog: ${Object.keys(catalog).length} entries\n`);

  const files = fs.readdirSync(TRACKS_DIR)
    .filter(f => /^track-\d{3}\.mp3$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No tracks in directory.');
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} local tracks\n`);

  let uploaded = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const trackNum    = parseInt(file.replace('track-', '').replace('.mp3', ''));
    const trackId     = `track-${String(trackNum).padStart(3, '0')}`;
    const storagePath = `music/suno-library/${file}`;
    const localPath   = path.join(TRACKS_DIR, file);
    const meta        = catalog[trackNum];

    process.stdout.write(`[${trackId}] ${meta ? `Set ${meta.set} - ${meta.description}` : 'no catalog entry'} ... `);

    let url;
    const exists = await fileExistsInStorage(storagePath);
    if (exists) {
      url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      console.log('already in Storage ✓');
      skipped++;
    } else {
      try {
        url = await uploadFile(localPath, storagePath);
        console.log('uploaded ✅');
        uploaded++;
      } catch (err) {
        console.error(`FAILED ❌  ${err.message}`);
        failed++;
        continue;
      }
    }

    // Seed/update Firestore suno_tracks document
    const docData = {
      num:         trackNum,
      set:         meta?.set         ?? 0,
      posInSet:    meta?.posInSet     ?? 0,
      key:         meta?.key          ?? '',
      bpm:         meta?.bpm          ?? 0,
      instrument:  meta?.instrument   ?? '',
      tone:        meta?.tone         ?? '',
      description: meta?.description  ?? '',
      startOffset: meta?.startOffset  ?? 45,
      status:      'active',
      url,
      updatedAt:   new Date().toISOString(),
    };

    try {
      await db.collection('suno_tracks').doc(trackId).set(docData, { merge: true });
    } catch (err) {
      console.error(`  ⚠️  Firestore write failed: ${err.message}`);
    }
  }

  console.log(`\n✅ Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  console.log(`📦 Firestore collection: suno_tracks (${uploaded + skipped} documents)`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
