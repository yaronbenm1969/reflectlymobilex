/**
 * library-selector.js
 * GPT-4o בוחר טרק מהספריה לפי תמלול
 * שני שלבים: זיהוי נושא+גוון → בחירה מתוך מועמדים
 */

const OpenAI = require('openai');
const { getCatalog, setUrlCache, getTrackById } = require('./library-catalog');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// fallback אם אין תמלול
const DEFAULT_TRACK_ID = 95; // "רקע עדין לכל תוכן"

/**
 * טוען URLs מפיירסטור לתוך הקטלוג
 */
async function loadUrlsFromFirestore(db) {
  try {
    const doc = await db.collection('settings').doc('sunoLibrary').get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data?.tracks) {
      // המפתחות מפיירסטור הם strings, הקטלוג משתמש ב-integers
      const urls = {};
      for (const [k, v] of Object.entries(data.tracks)) {
        urls[parseInt(k)] = v;
      }
      setUrlCache(urls);
    }
  } catch (err) {
    console.error('⚠️  library-selector: לא ניתן לטעון URLs מ-Firestore:', err.message);
  }
}

/**
 * selectTrackForTranscription
 * @param {Array} segments — תמלול [{ text, start, end }]
 * @param {object} db — Firestore instance (לטעינת URLs)
 * @returns {object} { trackId, trackUrl, track, reason }
 */
async function selectTrackForTranscription(segments, db) {
  if (!segments || segments.length === 0) {
    return fallbackTrack('אין תמלול');
  }

  await loadUrlsFromFirestore(db);

  const transcriptText = segments
    .map(s => s.text || '')
    .join(' ')
    .trim()
    .slice(0, 1500); // מגביל טוקנים

  const catalog = getCatalog();

  // שולח רק את השדות הנחוצים לבחירה — חוסך טוקנים
  const catalogForGPT = catalog.map(t => ({
    id: t.id,
    topic: t.topic,
    shade: t.shade,
    intensity: t.intensity,
    nameHe: t.nameHe,
    tags: t.tags,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `אתה עורך מוזיקה לסרטוני וידאו אישיים.
קיבלת תמלול של סרטון ורשימת 100 טרקי מוזיקת רקע.
עליך לבחור את הטרק המתאים ביותר לתוכן הרגשי של הסרטון.

כל טרק מוגדר לפי:
- topic: הנושא הכללי (family/achievement/love/celebration/loss/healing/reflection/release/universal)
- shade: הגוון הרגשי המדויק (warmth/bittersweet/gentle_sad/longing/deep/pride/strength וכו׳)
- intensity: עוצמה 1-4 (1=עדין מאוד, 4=חזק/מלא)
- tags: מילות מפתח שמאפיינות את הטרק
- nameHe: שם בעברית

חוקים:
1. קרא את התמלול — זהה את הנושא הדומיננטי והגוון הרגשי
2. בחר intensity בהתאם לעוצמה הרגשית בתמלול
3. אם התמלול מרובה נושאים — בחר לפי הנושא הדומיננטי
4. אם אין התאמה ברורה — העדף universal (94-100)
5. החזר JSON בלבד

פורמט תשובה:
{
  "trackId": <מספר 1-100>,
  "topic": "<topic שזיהית>",
  "shade": "<shade שזיהית>",
  "reason": "<משפט קצר מדוע בחרת>"
}`
        },
        {
          role: 'user',
          content: `תמלול הסרטון:
"${transcriptText}"

קטלוג הטרקים:
${JSON.stringify(catalogForGPT)}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const trackId = parseInt(result.trackId);

    if (!trackId || trackId < 1 || trackId > 100) {
      console.warn('⚠️  GPT החזיר ID לא תקין:', result.trackId, '— fallback');
      return fallbackTrack('ID לא תקין מ-GPT');
    }

    const track = getTrackById(trackId);
    if (!track) {
      return fallbackTrack(`טרק ${trackId} לא קיים בקטלוג`);
    }

    if (!track.url) {
      console.warn(`⚠️  טרק ${trackId} נבחר אבל אין לו URL — fallback`);
      return fallbackTrack(`טרק ${trackId} עוד לא הועלה`);
    }

    console.log(`🎵 נבחר טרק ${trackId}: ${track.nameHe} | ${result.reason}`);
    return {
      trackId,
      trackUrl: track.url,
      track,
      reason: result.reason,
    };

  } catch (err) {
    console.error('❌ library-selector GPT error:', err.message);
    return fallbackTrack(err.message);
  }
}

function fallbackTrack(reason) {
  console.warn(`🎵 Fallback לטרק ${DEFAULT_TRACK_ID} — ${reason}`);
  const track = getTrackById(DEFAULT_TRACK_ID);
  return {
    trackId: DEFAULT_TRACK_ID,
    trackUrl: track?.url || null,
    track,
    reason: `fallback: ${reason}`,
  };
}

module.exports = { selectTrackForTranscription, loadUrlsFromFirestore };
