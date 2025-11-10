# Reflectly Mobile App - Expo Setup Guide

> **שים לב:** אפליקציית Mobile היא standalone Expo project שדורש התקנה ידנית מחוץ ל-Replit.

## דרישות מקדימות

- Node.js 18+ מותקן על המחשב שלך
- Expo Go app מותקן על הטלפון שלך ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Git מותקן (אופציונלי)

---

## שלב 1: Clone הפרויקט

```bash
# שכפל את הפרויקט מ-Replit או מ-GitHub
git clone <repository-url>
cd workspace/apps/mobile
```

או פשוט הורד את התיקייה `apps/mobile` ישירות מ-Replit.

---

## שלב 2: התקנת Dependencies

```bash
cd apps/mobile
npm install
```

זה יתקין את כל החבילות הנדרשות:
- ✅ Expo SDK 52
- ✅ React Native 0.76.1  
- ✅ Expo Camera, AV, File System
- ✅ Zustand (state management)
- ✅ React Query
- ✅ Lucide Icons

---

## שלב 3: הרצת Development Server

```bash
npm start
```

או באמצעות Expo CLI:

```bash
npx expo start
```

### אפשרויות הרצה:

- **Expo Go (מומלץ לבדיקות):**
  - סרוק את ה-QR code שמופיע בטרמינל עם Expo Go app
  - האפליקציה תיפתח אוטומטית על המכשיר שלך

- **Simulator/Emulator:**
  ```bash
  npm run ios      # iOS Simulator (Mac only)
  npm run android  # Android Emulator
  ```

- **Web (preview mode):**
  ```bash
  npm run web
  ```

---

## שלב 4: Standalone Project ✅

> **חדשות טובות:** זהו Expo app עצמאי לגמרי! לא נדרשות תלויות monorepo.

כל ה-theme, components, ו-utilities כלולים ישירות ב-`apps/mobile/src/`:
- ✅ הגדרות theme ב-`src/theme/`
- ✅ UI components ב-`src/ui/`  
- ✅ כל המסכים וה-components מוכנים לשימוש

אתה פשוט יכול להריץ `npm install` ולהתחיל לקודד!

---

## מבנה התיקייה

```
apps/mobile/
├── App.js                 # Entry point
├── app.json              # Expo configuration
├── metro.config.js       # Metro bundler config
├── package.json          # Dependencies
├── assets/               # Images, icons, fonts
│   └── icon.png
└── src/
    ├── components/       # UI components
    ├── screens/          # Screen components  
    ├── state/            # Zustand stores
    ├── hooks/            # Custom hooks
    ├── theme/            # Theme configuration
    └── ui/               # UI primitives
```

---

## Build לייצור (EAS Build)

### התקנת EAS CLI

```bash
npm install -g eas-cli
```

### התחברות ל-Expo

```bash
eas login
```

### הגדרת Project

```bash
eas build:configure
```

### Build ל-iOS

```bash
eas build --platform ios
```

### Build ל-Android

```bash
eas build --platform android
```

---

## Troubleshooting

### שגיאת "Cannot find module"

```bash
# נקה cache
npx expo start --clear

# או
rm -rf node_modules
npm install
```

### Metro Bundler לא עובד

```bash
# הרג את כל תהליכי Metro
killall -9 node
npx expo start --clear
```

### בעיות עם Tamagui

Tamagui לא מותקן כרגע. אם תרצה להשתמש בו:

```bash
npm install @tamagui/core @tamagui/stacks @tamagui/text @tamagui/button
```

---

## פרסום ל-App Store / Google Play

### דרישות:
- ✅ Apple Developer Account ($99/year)
- ✅ Google Play Developer Account ($25 one-time)

### תהליך:

1. **Build Production:**
   ```bash
   eas build --platform all --profile production
   ```

2. **Submit ל-Stores:**
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

3. **עקוב אחר הסטטוס:**
   - https://expo.dev/accounts/[your-account]/projects/reflectly

---

## שאלות נפוצות

**Q: האם אני צריך Expo account?**  
A: כן, כדי להשתמש ב-EAS Build. ההרשמה חינמית.

**Q: האם אפשר להריץ בלי Expo Go?**  
A: כן, בנה development build או השתמש ב-simulator.

**Q: איך אני מחבר ל-backend?**  
A: עדכן את `BACKEND_URL` ב-`src/config.js` לכתובת ה-API שלך.

---

## קישורים שימושיים

- 📚 [Expo Documentation](https://docs.expo.dev/)
- 🎨 [React Native Documentation](https://reactnative.dev/)
- 🚀 [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- 💬 [Expo Discord Community](https://chat.expo.dev/)

---

**נוצר על ידי Reflectly Team** 🎥✨
