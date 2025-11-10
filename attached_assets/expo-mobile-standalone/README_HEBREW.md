# 📱 Reflectly Mobile - Expo Standalone

## 🚀 איך להעתיק את הפרויקט הזה ל-Replit חדש

### שלב 1: צור Repl חדש
1. פתח [replit.com](https://replit.com)
2. לחץ על **Create Repl**
3. בחר **Import from GitHub** או **Blank Repl**
4. תן שם לפרויקט: `reflectly-mobile`

### שלב 2: העתק את כל הקבצים
העתק את כל התוכן מהתיקייה `expo-mobile-standalone/` לתוך ה-Repl החדש:

```
expo-mobile-standalone/
├── .replit              ← הגדרות Replit
├── replit.nix          ← סביבת ריצה
├── package.json        ← תלויות
├── app.json           ← הגדרות Expo
├── App.js             ← אפליקציה ראשית
├── metro.config.js    ← הגדרות Metro
└── src/               ← קוד המקור
    ├── screens/       ← מסכים
    ├── components/    ← רכיבים
    ├── store/         ← State management
    └── theme/         ← עיצוב
```

### שלב 3: התקן והרץ
ב-Repl החדש:
1. לחץ על כפתור **Run** ▶️
2. Replit יתקין אוטומטית את כל התלויות
3. Expo יתחיל ויציג **QR Code** ב-Console

### שלב 4: סרוק QR Code
1. הורד את **Expo Go** על הטלפון:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. פתח Expo Go
3. סרוק את ה-QR Code שמופיע ב-Console
4. האפליקציה תיטען על הטלפון! 🎉

---

## 🎨 התאמה אישית

### שינוי צבעים
ערוך את `src/theme/theme.js`:
```javascript
export const theme = {
  colors: {
    primary: '#A060FF',    // סגול
    secondary: '#FF60A0',  // ורוד
    background: '#FFEFF3', // רקע
  }
}
```

### הוספת מסכים חדשים
1. צור קובץ חדש ב-`src/screens/`
2. הוסף אותו ל-navigation ב-`App.js`

---

## 🐛 פתרון בעיות

**QR Code לא מופיע?**
- בדוק ש-npm install הסתיים בהצלחה
- נסה לעצור ולהריץ מחדש את ה-Repl

**"Cannot connect to Metro"?**
```bash
# ב-Shell של Replit:
npm start -- --reset-cache
```

**שינויים לא מופיעים על הטלפון?**
- שמור את הקובץ (Ctrl+S / Cmd+S)
- Expo יעדכן אוטומטית (Hot Reload)
- אם לא עובד, נער את הטלפון (shake) → Reload

---

## 📚 משאבים נוספים

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Replit Expo Template](https://replit.com/@replit/Expo)

---

## ✅ מה כלול באפליקציה

- ✅ **9 מסכים מלאים**: Home, Record, Review, Music, MyStories, Settings, About, Help, Terms
- ✅ **מצלמה מקורית**: Expo Camera עם החלפת מצלמות
- ✅ **ניהול מצב**: Zustand לשמירת נתונים
- ✅ **עיצוב RTL**: תמיכה מלאה בעברית מימין לשמאל
- ✅ **אייקונים**: Lucide React Native
- ✅ **React Query**: לניהול בקשות API

---

**בהצלחה! 🚀**

צריך עזרה? פתח Issue או שאל בתגובות.
