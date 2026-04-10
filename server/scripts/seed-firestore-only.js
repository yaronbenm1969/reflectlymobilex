require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = getFirestore();

const BACKGROUNDS = [
  { slug: 'sea',        nameHe: 'ים',          order: 1,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/48525/48525-720.mp4' },
  { slug: 'sunset-sea', nameHe: 'שקיעה',       order: 2,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/44392/44392-720.mp4' },
  { slug: 'forest',     nameHe: 'יער',          order: 3,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/50847/50847-720.mp4' },
  { slug: 'waterfall',  nameHe: 'מפל',          order: 4,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/2213/2213-720.mp4'   },
  { slug: 'city',       nameHe: 'עיר לילה',     order: 5,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/49845/49845-720.mp4' },
  { slug: 'city2',      nameHe: 'מטרופולין',    order: 6,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/49878/49878-720.mp4' },
  { slug: 'space',      nameHe: 'כוכבים',       order: 7,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/1610/1610-720.mp4'   },
  { slug: 'nebula',     nameHe: 'ערפילית',      order: 8,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/14185/14185-720.mp4' },
  { slug: 'flowers',    nameHe: 'פרחים',        order: 9,  mediaType: 'video', url: 'https://assets.mixkit.co/videos/1168/1168-720.mp4'   },
  { slug: 'sunflowers', nameHe: 'חמניות',       order: 10, mediaType: 'video', url: 'https://assets.mixkit.co/videos/4881/4881-720.mp4'   },
  { slug: 'mountain',   nameHe: 'הרים',         order: 11, mediaType: 'image', url: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=720' },
  { slug: 'desert',     nameHe: 'מדבר',         order: 12, mediaType: 'image', url: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=720' },
  { slug: 'abstract',   nameHe: 'אבסטרקט',      order: 13, mediaType: 'image', url: 'https://images.pexels.com/photos/3109807/pexels-photo-3109807.jpeg?auto=compress&cs=tinysrgb&w=720' },
  { slug: 'aurora',     nameHe: 'זוהר צפוני',   order: 14, mediaType: 'image', url: 'https://images.pexels.com/photos/1933239/pexels-photo-1933239.jpeg?auto=compress&cs=tinysrgb&w=720' },
  { slug: 'rainy',      nameHe: 'גשם',          order: 15, mediaType: 'image', url: 'https://images.pexels.com/photos/110874/pexels-photo-110874.jpeg?auto=compress&cs=tinysrgb&w=720'  },
];

(async () => {
  console.log(`\nSeeding ${BACKGROUNDS.length} backgrounds to Firestore (no file upload)...\n`);
  let ok = 0;
  for (const bg of BACKGROUNDS) {
    try {
      const snap = await db.collection('backgrounds').where('slug', '==', bg.slug).get();
      const data = { ...bg, type: bg.mediaType, active: true, createdAt: new Date() };
      if (!snap.empty) {
        await db.collection('backgrounds').doc(snap.docs[0].id).update(data);
        console.log(`  updated: ${bg.slug} (${bg.nameHe})`);
      } else {
        await db.collection('backgrounds').add(data);
        console.log(`  added:   ${bg.slug} (${bg.nameHe})`);
      }
      ok++;
    } catch (err) {
      console.error(`  FAILED: ${bg.slug} —`, err.message);
    }
  }
  console.log(`\nDone: ${ok}/${BACKGROUNDS.length} backgrounds in Firestore ✅`);
  process.exit(0);
})();
