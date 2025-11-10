# מדריך התקנה - Reflectly Mobile App

## סקירה כללית

אפליקציית Reflectly Mobile היא Expo app עצמאית שמאפשרת למשתמשים:
- 🎥 להקליט סיפורים אישיים בווידאו
- 👥 להזמין חברים להוסיף קליפים של תגובות
- 🤖 ליצור וידאו סופי ערוך אוטומטית עם AI
- 🎵 לבחור רקע מוזיקלי ו-themes

---

## דרך מהירה - Expo Snack (בדיקה מהירה)

אם אתה רק רוצה לראות איך האפליקציה נראית:

1. פתח את [Expo Snack](https://snack.expo.dev/)
2. העתק את הקבצים מ-`apps/mobile` ל-Snack
3. סרוק את ה-QR code עם Expo Go

> ⚠️ שים לב: Snack לא תומך בכל התכונות (Camera, File System)

---

## דרך מומלצת - התקנה מקומית

### שלב 1: הורדת הפרויקט

**אופציה א': Clone מ-GitHub**
```bash
git clone https://github.com/your-username/reflectly.git
cd reflectly/apps/mobile
```

**אופציה ב': הורדה ישירה מ-Replit**
1. לחץ על "Download as ZIP" ב-Replit
2. חלץ את הקובץ
3. נווט ל-`workspace/apps/mobile`

---

### שלב 2: התקנת Node.js

אם Node.js לא מותקן:

**Windows:**
- הורד מ-[nodejs.org](https://nodejs.org/)
- התקן את הגרסה LTS

**Mac:**
```bash
brew install node
```

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

בדוק את ההתקנה:
```bash
node --version  # צריך להיות 18.x או גבוה יותר
npm --version
```

---

### שלב 3: התקנת החבילות

```bash
cd apps/mobile
npm install
```

זה עשוי לקחת כמה דקות בפעם הראשונה.

---

### שלב 4: התקנת Expo Go על הטלפון

**iOS:**
- פתח App Store
- חפש "Expo Go"
- התקן

**Android:**
- פתח Google Play Store  
- חפש "Expo Go"
- התקן

---

### שלב 5: הרצת האפליקציה

```bash
npm start
```

תראה משהו כזה:
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or Camera (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web
```

---

### שלב 6: סריקת QR Code

**iPhone:**
- פתח את אפליקציית Camera המובנית
- כוון למסך עם ה-QR code
- הקש על ההתראה שמופיעה
- האפליקציה תיפתח ב-Expo Go

**Android:**
- פתח את Expo Go app
- הקש על "Scan QR Code"
- סרוק את הקוד
- האפליקציה תיטען

---

## בעיות נפוצות ופתרונות

### 1. "Unable to resolve module"

**פתרון:**
```bash
rm -rf node_modules
rm package-lock.json
npm install
npm start --clear
```

---

### 2. QR Code לא עובד

**פתרון:**
- ודא שהמחשב והטלפון באותה רשת WiFi
- נסה להדליק/לכבות WiFi
- נסה להשתמש ב-Tunnel mode:
  ```bash
  npx expo start --tunnel
  ```

---

### 3. "Metro Bundler Error"

**פתרון:**
```bash
# Windows
taskkill /F /IM node.exe

# Mac/Linux
killall -9 node

# אז הרץ שוב
npm start
```

---

### 4. Camera לא עובד ב-Expo Go

**זה נורמלי!** 

Expo Go לפעמים מוגבל בהרשאות. לשימוש מלא:

```bash
# בנה development build
npx expo run:android
# או
npx expo run:ios
```

---

## שדרוג ל-Production Build

### EAS Build (מומלץ)

1. **התקן EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **התחבר:**
   ```bash
   eas login
   ```

3. **הגדר Project:**
   ```bash
   eas build:configure
   ```

4. **Build:**
   ```bash
   eas build --platform all
   ```

---

### Local Build (מתקדם)

**Android:**
```bash
npx expo run:android --variant release
```

**iOS (Mac בלבד):**
```bash
npx expo run:ios --configuration Release
```

---

## פרסום ל-Stores

### Apple App Store

1. **צור Apple Developer Account** ($99/שנה)
2. **הכן certificates:**
   ```bash
   eas credentials
   ```
3. **Build:**
   ```bash
   eas build --platform ios --profile production
   ```
4. **Submit:**
   ```bash
   eas submit --platform ios
   ```

---

### Google Play Store

1. **צור Google Play Developer Account** ($25 חד-פעמי)
2. **Build:**
   ```bash
   eas build --platform android --profile production
   ```
3. **Submit:**
   ```bash
   eas submit --platform android
   ```

---

## הגדרות נוספות

### שינוי שם האפליקציה

ערוך את `app.json`:
```json
{
  "expo": {
    "name": "השם החדש שלך",
    "slug": "your-new-slug"
  }
}
```

---

### שינוי צבעי הנושא

ערוך את `src/theme/theme.js`:
```javascript
export const colors = {
  primary: '#A060FF',    // סגול
  secondary: '#FF60A0',  // ורוד
  background: '#FFEFF4', // ורוד בהיר
  // ...
};
```

---

### הוספת Backend URL

צור `apps/mobile/src/config.js`:
```javascript
export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://your-backend.com',
  openaiKey: process.env.EXPO_PUBLIC_OPENAI_KEY,
};
```

---

## עזרה נוספת

### קהילת Expo

- 💬 [Discord](https://chat.expo.dev/)
- 📚 [Forums](https://forums.expo.dev/)
- 🐛 [GitHub Issues](https://github.com/expo/expo/issues)

### תיעוד

- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

## סיכום צעדים

1. ✅ הורד את הפרויקט
2. ✅ התקן Node.js
3. ✅ רוץ `npm install`
4. ✅ התקן Expo Go על הטלפון
5. ✅ רוץ `npm start`
6. ✅ סרוק QR code
7. ✅ תהנה מהאפליקציה!

---

**זקוק לעזרה?** פתח issue ב-GitHub או שלח אימייל support@reflectly.app

**בהצלחה! 🚀**
