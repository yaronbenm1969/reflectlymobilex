# Reflectly Mobile App

## Overview
Reflectly is a React Native/Expo mobile journaling app that allows users to record personal stories and invite friends to share reflections. The app features video recording, story management, and social sharing capabilities.

## Recent Changes (November 9, 2025)
- Successfully set up Expo app for web preview in Replit
- Installed all required dependencies (expo-linear-gradient, expo-asset, expo-font, etc.)
- Created missing asset placeholders (icon.png, splash.png, etc.)
- Fixed entry point by creating index.js with registerRootComponent
- App is now running successfully on port 5000

## Project Architecture

### Tech Stack
- **Framework**: Expo SDK 52 / React Native 0.76.1
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI**: Custom components with Linear Gradients
- **Icons**: Expo Vector Icons (Ionicons)
- **Styling**: React Native StyleSheet with custom theme

### Project Structure
```
/
├── App.js              # Main app component with screen routing
├── index.js            # Entry point with registerRootComponent
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── babel.config.js     # Babel configuration
├── metro.config.js     # Metro bundler config
├── assets/             # App assets (icons, images)
└── src/
    ├── components/     # Reusable UI components
    │   └── SideMenu.js
    ├── screens/        # App screens
    │   ├── HomeScreen.js
    │   ├── RecordScreen.js
    │   ├── ReviewScreen.js
    │   ├── MyStoriesScreen.js
    │   ├── SettingsScreen.js
    │   ├── MusicSelectionScreen.js
    │   ├── CameraSettingsScreen.js
    │   ├── AboutScreen.js
    │   ├── HelpScreen.js
    │   └── TermsScreen.js
    ├── state/          # Zustand state management
    │   └── appState.js
    ├── hooks/          # Custom React hooks
    │   └── useNav.js
    ├── theme/          # Theme configuration
    │   └── theme.js
    └── ui/             # UI primitives
        ├── AppButton.js
        └── Card.js
```

### Key Features
1. **Home Screen**: Landing page with navigation to record stories
2. **Record Screen**: Video recording interface with camera controls
3. **Review Screen**: Review and edit recorded stories
4. **My Stories**: View all user stories
5. **Settings**: App configuration and preferences
6. **Music Selection**: Choose background music for stories
7. **Camera Settings**: Configure camera preferences

### Navigation System
- Custom navigation using Zustand state management
- No React Navigation dependency
- Screen switching via `useAppState` and `useNav` hooks
- Side menu for main navigation

### Theme
- Primary Color: #7B61FF (Purple)
- Secondary Color: #5C45E0
- Background: #FFF8FF (Light pink)
- Gradient: Purple to Blue
- Clean, modern, minimalist design

## Development

### Running the App
The app is configured to run with:
```bash
npx expo start --web --port 5000
```

### Current Status
- **Demo Mode**: Running without backend
- **Web Preview**: Available on port 5000
- **Mobile**: Can be tested with Expo Go app via QR code
- **Platform**: Optimized for mobile, web preview available

### Known Considerations
- Some Expo packages (expo-av, expo-file-system, etc.) could be updated to match Expo SDK 52 versions
- Expo Haptics not available on web (expected behavior)
- Camera features require native mobile environment
- Running in demo mode without backend integration

## User Preferences
- None documented yet

## Future Enhancements
- Backend integration for story storage
- Video processing and AI editing
- WhatsApp sharing integration
- User authentication
- Cloud storage for videos
- Social features and friend invitations
