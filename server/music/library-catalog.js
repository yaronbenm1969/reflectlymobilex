/**
 * library-catalog.js
 * קטלוג 100 הטרקים הסטטי — source of truth
 * URLs מתמלאים אחרי הרצת upload-music-library.js
 */

const TOPICS = {
  family:       'משפחה',
  achievement:  'הישג',
  love:         'אהבה',
  celebration:  'חגיגה',
  loss:         'אובדן',
  healing:      'ריפוי',
  reflection:   'הרהור',
  release:      'שחרור',
  universal:    'אוניברסלי',
};

const SHADES = {
  warmth:       'חמימות',
  bittersweet:  'ביטרסוויט',
  gentle_sad:   'עצב רך',
  longing:      'ערגה',
  deep:         'עמוק/עז',
  pride:        'גאווה חמה',
  strength:     'כוח עדין',
  light_joy:    'קלילה',
  intense_joy:  'שמחה עזה',
  warm_fest:    'חגיגי+חמים',
  energetic:    'אנרגטי',
  deep_sad:     'עצב עמוק',
  grief:        'אבל',
  healing:      'ריפוי',
  contemplation:'הרהור',
  release:      'שחרור',
  ambient:      'אמביינט',
  special:      'מיוחד',
};

// טבלת תאימות מפתחות — לבחירת טרקים שיתחברו היטב
const KEY_GROUPS = {
  warm:   ['C', 'G', 'F'],
  sad:    ['Am', 'Dm', 'Em'],
  bright: ['D', 'A', 'G', 'E'],
  deep:   ['F', 'C', 'Bb'],
};

const CATALOG = [
  // ─── משפחה 1–20 ───────────────────────────────────────────────
  { id: 1,  topic: 'family', shade: 'warmth',      intensity: 1, nameHe: 'שקט, ערב בבית',        key: 'G',  bpm: 62,  tags: ['משפחה','בית','שקט','ערב','חמימות'] },
  { id: 2,  topic: 'family', shade: 'warmth',      intensity: 2, nameHe: 'חום, ביחד',             key: 'G',  bpm: 65,  tags: ['משפחה','ביחד','חום','קרבה'] },
  { id: 3,  topic: 'family', shade: 'warmth',      intensity: 3, nameHe: 'עוטף, מלא',             key: 'C',  bpm: 68,  tags: ['משפחה','עוטף','שלמות','אהבה חמה'] },
  { id: 4,  topic: 'family', shade: 'warmth',      intensity: 4, nameHe: 'חגיגת משפחה',           key: 'G',  bpm: 78,  tags: ['משפחה','חגיגה','שמחה','ביחד'] },
  { id: 5,  topic: 'family', shade: 'bittersweet', intensity: 1, nameHe: 'זיכרון עדין',           key: 'Am', bpm: 60,  tags: ['זיכרון','נוסטלגיה','עדין','ביטרסוויט'] },
  { id: 6,  topic: 'family', shade: 'bittersweet', intensity: 2, nameHe: 'גדלנו, שינוי',          key: 'Am', bpm: 63,  tags: ['גדילה','שינוי','ביטרסוויט','זמן עובר'] },
  { id: 7,  topic: 'family', shade: 'bittersweet', intensity: 3, nameHe: 'פרידה עם אהבה',         key: 'Am', bpm: 58,  tags: ['פרידה','אהבה','ביטרסוויט','עצב עם חיוך'] },
  { id: 8,  topic: 'family', shade: 'bittersweet', intensity: 4, nameHe: 'ילדות שעברה',           key: 'Dm', bpm: 55,  tags: ['ילדות','נוסטלגיה','עבר','עצב מתוק'] },
  { id: 9,  topic: 'family', shade: 'gentle_sad',  intensity: 1, nameHe: 'לחיצת יד, דממה',        key: 'Am', bpm: 55,  tags: ['שקט','דממה','נוכחות','תמיכה שקטה'] },
  { id: 10, topic: 'family', shade: 'gentle_sad',  intensity: 2, nameHe: 'חסר, ריחוק',            key: 'Dm', bpm: 58,  tags: ['חסר','ריחוק','געגוע קל','מרחק'] },
  { id: 11, topic: 'family', shade: 'gentle_sad',  intensity: 3, nameHe: 'בכי עדין',              key: 'Am', bpm: 52,  tags: ['בכי','עצב','עדין','ריגוש','דמעות'] },
  { id: 12, topic: 'family', shade: 'gentle_sad',  intensity: 4, nameHe: 'כאב שקט',               key: 'Dm', bpm: 50,  tags: ['כאב','שקט','עצב עמוק אך שקט'] },
  { id: 13, topic: 'family', shade: 'longing',     intensity: 1, nameHe: 'מרחוק, געגוע',          key: 'Em', bpm: 58,  tags: ['געגוע','מרחוק','רחוק','חסר'] },
  { id: 14, topic: 'family', shade: 'longing',     intensity: 2, nameHe: 'זיכרון מרחף',           key: 'Am', bpm: 55,  tags: ['זיכרון','מרחף','עבר','ערגה'] },
  { id: 15, topic: 'family', shade: 'longing',     intensity: 3, nameHe: 'לא חוזר',               key: 'Em', bpm: 52,  tags: ['לא חוזר','עבר','נוסטלגיה עמוקה'] },
  { id: 16, topic: 'family', shade: 'longing',     intensity: 4, nameHe: 'אהבה שלא נאמרה',        key: 'Dm', bpm: 50,  tags: ['אהבה','לא נאמר','חרטה','ערגה'] },
  { id: 17, topic: 'family', shade: 'deep',        intensity: 1, nameHe: 'כובד, אחריות',          key: 'C',  bpm: 60,  tags: ['אחריות','כובד','בגרות','רצינות'] },
  { id: 18, topic: 'family', shade: 'deep',        intensity: 2, nameHe: 'משקל, שורשים',          key: 'F',  bpm: 58,  tags: ['שורשים','משקל','מורשת','עמוק'] },
  { id: 19, topic: 'family', shade: 'deep',        intensity: 3, nameHe: 'רגע מכונן',             key: 'C',  bpm: 65,  tags: ['רגע מכונן','משמעות','עוצמה','גדול'] },
  { id: 20, topic: 'family', shade: 'deep',        intensity: 4, nameHe: 'עוצמה רגשית מלאה',      key: 'F',  bpm: 70,  tags: ['עוצמה','מלא','שיא רגשי','מיתרים'] },

  // ─── הישג 21–40 ───────────────────────────────────────────────
  { id: 21, topic: 'achievement', shade: 'pride',    intensity: 1, nameHe: 'רגע שקט של הצלחה',  key: 'C',  bpm: 65,  tags: ['הצלחה','שקט','סיפוק','גאווה עדינה'] },
  { id: 22, topic: 'achievement', shade: 'pride',    intensity: 2, nameHe: 'סיפוק, עשיתי את זה', key: 'G',  bpm: 68,  tags: ['סיפוק','הצלחה','עשיתי','גאווה'] },
  { id: 23, topic: 'achievement', shade: 'pride',    intensity: 3, nameHe: 'ראש מורם, בוטח',     key: 'D',  bpm: 72,  tags: ['ביטחון','גאווה','ראש מורם','חזק'] },
  { id: 24, topic: 'achievement', shade: 'pride',    intensity: 4, nameHe: 'רגע מכונן עם מיתרים',key: 'D',  bpm: 75,  tags: ['מיתרים','שיא','גאווה','רגע גדול'] },
  { id: 25, topic: 'achievement', shade: 'bittersweet', intensity: 1, nameHe: 'הדרך הייתה קשה', key: 'Am', bpm: 62,  tags: ['קשה','מסע','מאמץ','ביטרסוויט'] },
  { id: 26, topic: 'achievement', shade: 'bittersweet', intensity: 2, nameHe: 'הגעתי אבל השארתי משהו', key: 'Am', bpm: 60, tags: ['הגעתי','השארתי','מחיר','ביטרסוויט'] },
  { id: 27, topic: 'achievement', shade: 'bittersweet', intensity: 3, nameHe: 'הצלחה עם מחיר',  key: 'Dm', bpm: 58,  tags: ['מחיר','הצלחה','ויתור','עצב מתוק'] },
  { id: 28, topic: 'achievement', shade: 'bittersweet', intensity: 4, nameHe: 'פרק נסגר',        key: 'Dm', bpm: 55,  tags: ['סיום','פרק','סגירה','ביטרסוויט'] },
  { id: 29, topic: 'achievement', shade: 'strength',  intensity: 1, nameHe: 'צעד אחר צעד',       key: 'G',  bpm: 70,  tags: ['התקדמות','סבלנות','צעד','דרך'] },
  { id: 30, topic: 'achievement', shade: 'strength',  intensity: 2, nameHe: 'נחישות שקטה',       key: 'C',  bpm: 72,  tags: ['נחישות','שקט','מוקד','כוח פנימי'] },
  { id: 31, topic: 'achievement', shade: 'strength',  intensity: 3, nameHe: 'עלייה, התקדמות',    key: 'G',  bpm: 75,  tags: ['עלייה','התקדמות','קדימה','אנרגיה'] },
  { id: 32, topic: 'achievement', shade: 'strength',  intensity: 4, nameHe: 'פריצת דרך',         key: 'D',  bpm: 80,  tags: ['פריצה','דרך','הצלחה','מומנטום'] },
  { id: 33, topic: 'achievement', shade: 'longing',   intensity: 1, nameHe: 'מאיפה התחלתי',      key: 'Em', bpm: 60,  tags: ['התחלה','שורשים','מסע','מאיפה'] },
  { id: 34, topic: 'achievement', shade: 'longing',   intensity: 2, nameHe: 'מי שהייתי לפני',    key: 'Am', bpm: 58,  tags: ['עבר','זהות','שינוי','ערגה'] },
  { id: 35, topic: 'achievement', shade: 'longing',   intensity: 3, nameHe: 'שורשים מול עתיד',   key: 'Em', bpm: 55,  tags: ['שורשים','עתיד','מתח','ערגה'] },
  { id: 36, topic: 'achievement', shade: 'longing',   intensity: 4, nameHe: 'הדרך שעברתי',       key: 'Am', bpm: 52,  tags: ['דרך','עבר','מסע','נוסטלגיה'] },
  { id: 37, topic: 'achievement', shade: 'deep',      intensity: 1, nameHe: 'כובד הרגע',         key: 'F',  bpm: 63,  tags: ['כובד','רגע','משמעות','עמוק'] },
  { id: 38, topic: 'achievement', shade: 'deep',      intensity: 2, nameHe: 'שיא של מסע',        key: 'C',  bpm: 68,  tags: ['שיא','מסע','עוצמה','גדול'] },
  { id: 39, topic: 'achievement', shade: 'deep',      intensity: 3, nameHe: 'פסגה, תחושת שלמות', key: 'D',  bpm: 72,  tags: ['פסגה','שלמות','שיא','מלא'] },
  { id: 40, topic: 'achievement', shade: 'deep',      intensity: 4, nameHe: 'אורקסטרלי, גדול',   key: 'D',  bpm: 78,  tags: ['אורקסטרה','גדול','מלא','שיא'] },

  // ─── אהבה וחברות 41–60 ────────────────────────────────────────
  { id: 41, topic: 'love', shade: 'warmth',      intensity: 1, nameHe: 'קרבה שקטה',          key: 'G',  bpm: 60,  tags: ['קרבה','שקט','אינטימי','חמימות'] },
  { id: 42, topic: 'love', shade: 'warmth',      intensity: 2, nameHe: 'חברות אמיתית',       key: 'C',  bpm: 65,  tags: ['חברות','אמיתי','קשר','חם'] },
  { id: 43, topic: 'love', shade: 'warmth',      intensity: 3, nameHe: 'אהבה שמחה, בטוחה',  key: 'G',  bpm: 70,  tags: ['אהבה','שמחה','בטוח','חמימות'] },
  { id: 44, topic: 'love', shade: 'warmth',      intensity: 4, nameHe: 'מלא, עוטף, שלם',    key: 'F',  bpm: 68,  tags: ['מלא','עוטף','שלמות','אהבה'] },
  { id: 45, topic: 'love', shade: 'bittersweet', intensity: 1, nameHe: 'אהבה עם מרחק',       key: 'Am', bpm: 60,  tags: ['מרחק','אהבה','ביטרסוויט','געגוע'] },
  { id: 46, topic: 'love', shade: 'bittersweet', intensity: 2, nameHe: 'יחסים מורכבים',      key: 'Am', bpm: 58,  tags: ['מורכב','יחסים','ביטרסוויט','עמוק'] },
  { id: 47, topic: 'love', shade: 'bittersweet', intensity: 3, nameHe: 'אהבה שנגמרה בטוב',  key: 'Dm', bpm: 55,  tags: ['גמר','אהבה','בטוב','ביטרסוויט'] },
  { id: 48, topic: 'love', shade: 'bittersweet', intensity: 4, nameHe: 'נפרדנו אבל אוהב',   key: 'Dm', bpm: 52,  tags: ['פרידה','אהבה','כאב מתוק','ביטרסוויט'] },
  { id: 49, topic: 'love', shade: 'gentle_sad',  intensity: 1, nameHe: 'חסר, ריחוק',         key: 'Am', bpm: 58,  tags: ['חסר','ריחוק','געגוע','עצב עדין'] },
  { id: 50, topic: 'love', shade: 'gentle_sad',  intensity: 2, nameHe: 'לבד אחרי יחד',       key: 'Dm', bpm: 55,  tags: ['לבד','אחרי','ריחוק','עצב'] },
  { id: 51, topic: 'love', shade: 'gentle_sad',  intensity: 3, nameHe: 'אובדן חבר קרוב',     key: 'Am', bpm: 52,  tags: ['אובדן','חבר','כאב','עצב'] },
  { id: 52, topic: 'love', shade: 'gentle_sad',  intensity: 4, nameHe: 'ניתוק כואב',         key: 'Dm', bpm: 50,  tags: ['ניתוק','כאב','עצב עמוק','שבר'] },
  { id: 53, topic: 'love', shade: 'longing',     intensity: 1, nameHe: 'מישהו שחסר',         key: 'Em', bpm: 60,  tags: ['חסר','ערגה','געגוע','אדם'] },
  { id: 54, topic: 'love', shade: 'longing',     intensity: 2, nameHe: 'געגוע לאדם',         key: 'Am', bpm: 58,  tags: ['געגוע','אדם','ערגה','חסר'] },
  { id: 55, topic: 'love', shade: 'longing',     intensity: 3, nameHe: 'אהבה מרחוק',         key: 'Em', bpm: 55,  tags: ['מרחוק','אהבה','ערגה','רחוק'] },
  { id: 56, topic: 'love', shade: 'longing',     intensity: 4, nameHe: 'אי אפשר לחזור',      key: 'Dm', bpm: 52,  tags: ['לא חוזר','ערגה','עבר','אובדן'] },
  { id: 57, topic: 'love', shade: 'deep',        intensity: 1, nameHe: 'קשר עמוק, שורשי',   key: 'F',  bpm: 62,  tags: ['קשר','עמוק','שורשי','חזק'] },
  { id: 58, topic: 'love', shade: 'deep',        intensity: 2, nameHe: 'אהבה כבדה, משמעותית',key: 'C', bpm: 65,  tags: ['אהבה','כבד','משמעות','עמוק'] },
  { id: 59, topic: 'love', shade: 'deep',        intensity: 3, nameHe: 'עוצמת הקשר',         key: 'F',  bpm: 68,  tags: ['עוצמה','קשר','כוח','עמוק'] },
  { id: 60, topic: 'love', shade: 'deep',        intensity: 4, nameHe: 'אהבה שמוטטת ובונה',  key: 'Am', bpm: 58,  tags: ['מוטט','בונה','עוצמה','אהבה גדולה'] },

  // ─── חגיגה 61–75 ──────────────────────────────────────────────
  { id: 61, topic: 'celebration', shade: 'light_joy',  intensity: 1, nameHe: 'חיוך, קלות',          key: 'G',  bpm: 80,  tags: ['חיוך','קל','שמח','אווירה'] },
  { id: 62, topic: 'celebration', shade: 'light_joy',  intensity: 2, nameHe: 'כיף, אווירה',          key: 'G',  bpm: 85,  tags: ['כיף','אווירה','שמחה','קלילות'] },
  { id: 63, topic: 'celebration', shade: 'light_joy',  intensity: 3, nameHe: 'ריקוד, עליצות',        key: 'D',  bpm: 90,  tags: ['ריקוד','עליצות','תנועה','שמחה'] },
  { id: 64, topic: 'celebration', shade: 'intense_joy',intensity: 1, nameHe: 'שמחה מתפרצת',          key: 'D',  bpm: 88,  tags: ['שמחה','מתפרצת','עז','אנרגיה'] },
  { id: 65, topic: 'celebration', shade: 'intense_joy',intensity: 2, nameHe: 'הצלחה משותפת',         key: 'G',  bpm: 92,  tags: ['הצלחה','ביחד','קבוצה','שמחה'] },
  { id: 66, topic: 'celebration', shade: 'intense_joy',intensity: 3, nameHe: 'אירוע, כולם ביחד',     key: 'D',  bpm: 96,  tags: ['אירוע','כולם','ביחד','גדול'] },
  { id: 67, topic: 'celebration', shade: 'warm_fest',  intensity: 1, nameHe: 'שמחה עם דמעות',        key: 'C',  bpm: 78,  tags: ['שמחה','דמעות','ריגוש','חם'] },
  { id: 68, topic: 'celebration', shade: 'warm_fest',  intensity: 2, nameHe: 'רגע שיא של אירוע',     key: 'G',  bpm: 82,  tags: ['שיא','אירוע','מרגש','חם'] },
  { id: 69, topic: 'celebration', shade: 'warm_fest',  intensity: 3, nameHe: 'חתונה, בר מצווה',      key: 'C',  bpm: 85,  tags: ['חתונה','בר מצווה','אירוע גדול','מרגש'] },
  { id: 70, topic: 'celebration', shade: 'bittersweet',intensity: 1, nameHe: 'סוף פרק, חגיגה עם עצב',key: 'Am', bpm: 72,  tags: ['סיום','חגיגה','עצב','ביטרסוויט'] },
  { id: 71, topic: 'celebration', shade: 'bittersweet',intensity: 2, nameHe: 'בוגרים, פרידה מאושרת', key: 'C',  bpm: 75,  tags: ['בוגרים','פרידה','שמחה','עצב'] },
  { id: 72, topic: 'celebration', shade: 'bittersweet',intensity: 3, nameHe: 'אחרון בסדרה',          key: 'Am', bpm: 70,  tags: ['אחרון','סדרה','סיום','ביטרסוויט'] },
  { id: 73, topic: 'celebration', shade: 'energetic',  intensity: 1, nameHe: 'מרץ, תנועה',           key: 'A',  bpm: 100, tags: ['מרץ','תנועה','אנרגיה','ספורט'] },
  { id: 74, topic: 'celebration', shade: 'energetic',  intensity: 2, nameHe: 'עוצמה, beat',          key: 'E',  bpm: 110, tags: ['עוצמה','beat','אנרגיה','חזק'] },
  { id: 75, topic: 'celebration', shade: 'energetic',  intensity: 3, nameHe: 'פתיחה, הופעה, כניסה',  key: 'D',  bpm: 118, tags: ['פתיחה','הופעה','כניסה','גדול'] },

  // ─── אובדן 76–83 ──────────────────────────────────────────────
  { id: 76, topic: 'loss', shade: 'deep_sad', intensity: 1, nameHe: 'דממה אחרי אובדן',      key: 'Am', bpm: 48,  tags: ['דממה','אובדן','שקט','כבד'] },
  { id: 77, topic: 'loss', shade: 'deep_sad', intensity: 2, nameHe: 'כאב שקט',               key: 'Dm', bpm: 50,  tags: ['כאב','שקט','עצב','פנימי'] },
  { id: 78, topic: 'loss', shade: 'deep_sad', intensity: 3, nameHe: 'בכי פנימי',             key: 'Am', bpm: 45,  tags: ['בכי','פנימי','עצב','עמוק'] },
  { id: 79, topic: 'loss', shade: 'deep_sad', intensity: 4, nameHe: 'שבר, קריסה',            key: 'Dm', bpm: 42,  tags: ['שבר','קריסה','עצב שיא','כבד מאוד'] },
  { id: 80, topic: 'loss', shade: 'grief',    intensity: 1, nameHe: 'לאחר אובדן',            key: 'Am', bpm: 48,  tags: ['אחרי','אובדן','ריק','כבד'] },
  { id: 81, topic: 'loss', shade: 'grief',    intensity: 2, nameHe: 'אובדן אדם אהוב',        key: 'Dm', bpm: 45,  tags: ['אובדן','אדם אהוב','אבל','כאב'] },
  { id: 82, topic: 'loss', shade: 'grief',    intensity: 3, nameHe: 'עצב שלא עובר',          key: 'Am', bpm: 42,  tags: ['עצב','לא עובר','עמוק','קבוע'] },
  { id: 83, topic: 'loss', shade: 'grief',    intensity: 4, nameHe: 'ריק, כבד, עוצר נשימה', key: 'Dm', bpm: 40,  tags: ['ריק','כבד','עוצר נשימה','עוצמה שקטה'] },

  // ─── ריפוי 84–87 ──────────────────────────────────────────────
  { id: 84, topic: 'healing', shade: 'healing', intensity: 1, nameHe: 'ניצוץ ראשון של תקווה', key: 'C',  bpm: 55,  tags: ['תקווה','ניצוץ','ראשון','אור'] },
  { id: 85, topic: 'healing', shade: 'healing', intensity: 2, nameHe: 'מתחיל לנשום',          key: 'G',  bpm: 58,  tags: ['נשימה','התחלה','התאוששות','קל יותר'] },
  { id: 86, topic: 'healing', shade: 'healing', intensity: 3, nameHe: 'קם, ממשיך',            key: 'C',  bpm: 62,  tags: ['קם','ממשיך','קדימה','כוח'] },
  { id: 87, topic: 'healing', shade: 'healing', intensity: 4, nameHe: 'שלמות אחרי שבר',      key: 'G',  bpm: 65,  tags: ['שלמות','אחרי','שבר','חזק יותר'] },

  // ─── הרהור 88–90 ──────────────────────────────────────────────
  { id: 88, topic: 'reflection', shade: 'contemplation', intensity: 1, nameHe: 'מחשבות שקטות',   key: 'Em', bpm: 52,  tags: ['מחשבות','שקט','פנימי','לבד'] },
  { id: 89, topic: 'reflection', shade: 'contemplation', intensity: 2, nameHe: 'התבוננות פנימה', key: 'Am', bpm: 55,  tags: ['התבוננות','פנימה','מודעות','שקט'] },
  { id: 90, topic: 'reflection', shade: 'contemplation', intensity: 3, nameHe: 'שאלות גדולות',   key: 'Em', bpm: 58,  tags: ['שאלות','גדול','משמעות','עומק'] },

  // ─── שחרור 91–93 ──────────────────────────────────────────────
  { id: 91, topic: 'release', shade: 'release', intensity: 1, nameHe: 'להרפות',              key: 'C',  bpm: 58,  tags: ['לשחרר','לוותר','להרפות','קלות'] },
  { id: 92, topic: 'release', shade: 'release', intensity: 2, nameHe: 'לשחרר מה שהיה',       key: 'G',  bpm: 62,  tags: ['שחרור','עבר','קדימה','חופשי'] },
  { id: 93, topic: 'release', shade: 'release', intensity: 3, nameHe: 'חופש אחרי כבדות',     key: 'C',  bpm: 68,  tags: ['חופש','אחרי','קלות','הקלה'] },

  // ─── אוניברסלי 94–100 ─────────────────────────────────────────
  { id: 94,  topic: 'universal', shade: 'ambient', intensity: 1, nameHe: 'נייטרלי, עדין',         key: 'C',  bpm: 55,  tags: ['נייטרלי','עדין','רקע','כללי'] },
  { id: 95,  topic: 'universal', shade: 'ambient', intensity: 2, nameHe: 'רקע עדין לכל תוכן',    key: 'G',  bpm: 58,  tags: ['רקע','עדין','כללי','אמביינט'] },
  { id: 96,  topic: 'universal', shade: 'ambient', intensity: 3, nameHe: 'מלא אבל לא מכריע',     key: 'F',  bpm: 62,  tags: ['מלא','לא מכריע','מאוזן','כללי'] },
  { id: 97,  topic: 'universal', shade: 'ambient', intensity: 4, nameHe: 'עוצמה כללית',           key: 'C',  bpm: 65,  tags: ['עוצמה','כללי','מלא','אמביינט'] },
  { id: 98,  topic: 'universal', shade: 'special', intensity: 1, nameHe: 'שקט כמעט מוחלט',       key: 'Am', bpm: 45,  tags: ['שקט','מינימל','כמעט ריק','עדין'] },
  { id: 99,  topic: 'universal', shade: 'special', intensity: 2, nameHe: 'אווירה, מינימל',        key: 'Em', bpm: 48,  tags: ['אווירה','מינימל','עדין','רקע'] },
  { id: 100, topic: 'universal', shade: 'special', intensity: 3, nameHe: 'ציפייה, פתיחה',         key: 'G',  bpm: 60,  tags: ['ציפייה','פתיחה','התחלה','אופטימי'] },
];

// url מתמלא מפיירסטור בזמן ריצה
let _urlCache = {};

function getCatalog() {
  return CATALOG.map(track => ({
    ...track,
    url: _urlCache[track.id] || null,
  }));
}

function getTrackById(id) {
  const track = CATALOG.find(t => t.id === id);
  if (!track) return null;
  return { ...track, url: _urlCache[id] || null };
}

function setUrlCache(urls) {
  _urlCache = urls || {};
}

function getTracksByTopic(topic) {
  return CATALOG.filter(t => t.topic === topic);
}

function getTracksByShade(shade) {
  return CATALOG.filter(t => t.shade === shade);
}

module.exports = {
  CATALOG,
  TOPICS,
  SHADES,
  KEY_GROUPS,
  getCatalog,
  getTrackById,
  setUrlCache,
  getTracksByTopic,
  getTracksByShade,
};
