/**
 * Seed script: downloads free background videos & images,
 * compresses with FFmpeg, uploads to Firebase Storage + Firestore.
 *
 * Usage (PowerShell, from project root):
 *   $env:PATH += ";C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Links"
 *   cd server
 *   node -e "require('dotenv').config({ path: '../.env' }); require('./scripts/upload-backgrounds')"
 */

const https  = require('https');
const http   = require('http');
const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getStorage }   = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');

// ── Firebase Admin init ────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET,
  });
}
const bucket = getStorage().bucket();
const db     = getFirestore();

const TEMP_DIR = path.join(process.cwd(), 'temp', 'bg-seed');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Background list ────────────────────────────────────────────────────────
// Videos — Mixkit free stock (assets.mixkit.co), no attribution required
// Images — Pexels free stock (images.pexels.com), no attribution required
const BACKGROUNDS = [
  // ── Videos ──────────────────────────────────────────────────
  {
    slug: 'sea',        nameHe: 'ים',        order: 1,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/48525/48525-720.mp4',
  },
  {
    slug: 'sunset-sea', nameHe: 'שקיעה',     order: 2,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/44392/44392-720.mp4',
  },
  {
    slug: 'forest',     nameHe: 'יער',       order: 3,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/50847/50847-720.mp4',
  },
  {
    slug: 'waterfall',  nameHe: 'מפל',       order: 4,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/2213/2213-720.mp4',
  },
  {
    slug: 'city',       nameHe: 'עיר לילה',  order: 5,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/49845/49845-720.mp4',
  },
  {
    slug: 'city2',      nameHe: 'מטרופולין', order: 6,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/49878/49878-720.mp4',
  },
  {
    slug: 'space',      nameHe: 'כוכבים',    order: 7,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/1610/1610-720.mp4',
  },
  {
    slug: 'nebula',     nameHe: 'ערפילית',   order: 8,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/14185/14185-720.mp4',
  },
  {
    slug: 'flowers',    nameHe: 'פרחים',     order: 9,  mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/1168/1168-720.mp4',
  },
  {
    slug: 'sunflowers', nameHe: 'חמניות',    order: 10, mediaType: 'video',
    srcUrl: 'https://assets.mixkit.co/videos/4881/4881-720.mp4',
  },

  // ── Images ──────────────────────────────────────────────────
  {
    slug: 'mountain',   nameHe: 'הרים',      order: 11, mediaType: 'image',
    srcUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=720',
  },
  {
    slug: 'desert',     nameHe: 'מדבר',      order: 12, mediaType: 'image',
    srcUrl: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=720',
  },
  {
    slug: 'abstract',   nameHe: 'אבסטרקט',   order: 13, mediaType: 'image',
    srcUrl: 'https://images.pexels.com/photos/3109807/pexels-photo-3109807.jpeg?auto=compress&cs=tinysrgb&w=720',
  },
  {
    slug: 'aurora',     nameHe: 'זוהר צפוני', order: 14, mediaType: 'image',
    srcUrl: 'https://images.pexels.com/photos/1933239/pexels-photo-1933239.jpeg?auto=compress&cs=tinysrgb&w=720',
  },
  {
    slug: 'rainy',      nameHe: 'גשם',        order: 15, mediaType: 'image',
    srcUrl: 'https://images.pexels.com/photos/빗/rain.jpeg?auto=compress&cs=tinysrgb&w=720',
    // fallback:
    srcUrlFallback: 'https://images.pexels.com/photos/110874/pexels-photo-110874.jpeg?auto=compress&cs=tinysrgb&w=720',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file  = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode} — ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function ffmpeg(args) {
  return new Promise((resolve, reject) =>
    execFile('ffmpeg', args, { timeout: 180000 }, (err, , stderr) => {
      if (err) { console.error('  ffmpeg stderr:', stderr?.slice(0, 300)); reject(err); }
      else resolve();
    })
  );
}

async function processOne(bg) {
  const url = bg.srcUrl;
  const isImage = bg.mediaType === 'image';
  const rawExt   = isImage ? '.jpg' : '.mp4';
  const rawPath  = path.join(TEMP_DIR, `${bg.slug}_raw${rawExt}`);
  const outPath  = path.join(TEMP_DIR, `${bg.slug}${rawExt}`);
  const destPath = `backgrounds/${bg.slug}${rawExt}`;
  const mime     = isImage ? 'image/jpeg' : 'video/mp4';

  console.log(`  ⬇️  downloading...`);
  try {
    await download(url, rawPath);
  } catch (err) {
    if (bg.srcUrlFallback) {
      console.log(`  ⚠️  primary failed, trying fallback URL`);
      await download(bg.srcUrlFallback, rawPath);
    } else throw err;
  }

  console.log(`  🔧 compressing...`);
  if (isImage) {
    await ffmpeg(['-i', rawPath, '-vf', 'scale=720:-2', '-q:v', '3', '-y', outPath]);
  } else {
    await ffmpeg([
      '-i', rawPath, '-t', '15', '-vf', 'scale=720:-2,fps=25',
      '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
      '-an', '-movflags', '+faststart', '-y', outPath,
    ]);
  }
  fs.unlink(rawPath, () => {});

  console.log(`  ☁️  uploading to Storage...`);
  await bucket.upload(outPath, { destination: destPath, metadata: { contentType: mime }, public: true });
  fs.unlink(outPath, () => {});

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;

  // Upsert Firestore
  const snap = await db.collection('backgrounds').where('slug', '==', bg.slug).get();
  if (!snap.empty) {
    await db.collection('backgrounds').doc(snap.docs[0].id).update({
      url: publicUrl, nameHe: bg.nameHe, order: bg.order,
      mediaType: bg.mediaType, type: bg.mediaType, active: true,
    });
    console.log(`  ✅ updated in Firestore`);
  } else {
    await db.collection('backgrounds').add({
      slug: bg.slug, nameHe: bg.nameHe, url: publicUrl,
      mediaType: bg.mediaType, type: bg.mediaType,
      order: bg.order, active: true, createdAt: new Date(),
    });
    console.log(`  ✅ added to Firestore`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  const total = BACKGROUNDS.length;
  const videos = BACKGROUNDS.filter(b => b.mediaType === 'video').length;
  const images = BACKGROUNDS.filter(b => b.mediaType === 'image').length;
  console.log(`\n🚀 Seeding ${total} backgrounds (${videos} videos + ${images} images)\n`);

  let ok = 0, fail = 0;
  for (const bg of BACKGROUNDS) {
    console.log(`\n[${bg.slug}] (${bg.mediaType})`);
    try {
      await processOne(bg);
      ok++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${err.message}`);
      fail++;
    }
  }
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Done — ${ok} succeeded, ${fail} failed`);
  process.exit(0);
})();
