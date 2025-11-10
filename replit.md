# Reflectly Mobile App

## Overview
Reflectly is a React Native/Expo mobile journaling app that allows users to record personal stories and invite friends to share reflections. The app features video recording, story management, and social sharing capabilities.

## Recent Changes (November 10, 2025)
- **Upgraded to Expo SDK 54** with React 19.1.0 and React Native 0.81.5
- **Fixed critical bug**: Removed deprecated SafeAreaView, added react-native-safe-area-context
- **Fixed Touch Bleed-Through**: Added 300ms interaction guard to ReviewScreen and MusicSelectionScreen
- **Added FormatSelectionScreen**: New screen for video format and AI background styling
- **Added ElevenLabs integration**: AI-generated custom music option in MusicSelectionScreen
- **Updated color theme**: Pink-purple gradient (#FF6B9D → #C06FBB) matching Reflectly aesthetic
- **Configured Expo tunnel**: Using ngrok for mobile device testing from Replit cloud
- App running on tunnel via Expo Go with comprehensive logging

## Project Architecture

### Tech Stack
- **Framework**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI**: Custom components with Linear Gradients
- **Icons**: Expo Vector Icons (Ionicons)
- **Camera**: expo-camera with CameraView
- **Safe Area**: react-native-safe-area-context
- **Styling**: React Native StyleSheet with custom theme
- **AI Integration**: ElevenLabs for custom music generation (planned)

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
    │   ├── FormatSelectionScreen.js  # NEW: Video format & AI styling
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

### Complete User Flow
1. **Home Screen** → Landing page with "Start a New Story" button
2. **Record Screen** → Video recording with:
   - Optional 3-second countdown
   - Front/back camera toggle
   - 3-minute max recording time
   - Recording timer display
3. **Review Screen** → Video preview with options:
   - Record Again
   - Add Music
   - Done
4. **Music Selection** → Choose background music:
   - 🎼 AI-generated custom music (ElevenLabs)
   - Pre-made tracks (Upbeat, Calm, Dramatic, Romantic)
   - No music option
5. **Format Selection** → Video styling (NEW):
   - **Formats**: 3D Cube, 3D Carousel, Flip Pages, Standard
   - **Background AI**: Original, AI Wallpaper, Video Background, Split-Screen
6. **Processing** → AI editing (backend - not implemented)
7. **Share** → WhatsApp sharing (not implemented)

### Implemented Screens
1. **Home Screen**: Landing page with navigation
2. **Record Screen**: Full video recording with camera controls
3. **Review Screen**: Review recorded video with action buttons
4. **Music Selection**: Background music selection including AI option
5. **Format Selection**: Video format and AI background styling
6. **My Stories**: Story gallery (UI only, no backend)
7. **Settings**: App configuration
8. **Camera Settings**: Recording preferences
9. **About, Help, Terms**: Information screens

### Navigation System
- Custom navigation using Zustand state management
- No React Navigation dependency
- Screen switching via `useAppState` and `useNav` hooks
- Side menu for main navigation

### Theme (Reflectly-Style)
- **Primary Gradient**: #FF6B9D (Pink) → #C06FBB (Purple)
- **Background**: #FFEFF4 (Light pink)
- **Success**: #4CAF50
- **Text**: #333333
- **Subtext**: #666666
- **Design**: Clean, warm, minimalist, journaling-focused

## Development

### Running the App
The app is configured to run with Expo tunnel for mobile testing:
```bash
npx expo start --tunnel
```

Access on mobile via:
- Scan QR code with Expo Go (Android/iOS)
- Web preview available at localhost:8081

### Current Status
- **Demo Mode**: Running without backend
- **Tunnel**: Configured with ngrok for Replit cloud mobile access
- **Mobile**: Fully testable with Expo Go via QR code
- **Platform**: Optimized for mobile (iOS/Android)
- **Recording**: Working on actual mobile devices
- **Navigation**: Fixed touch bleed-through issues

### Known Considerations
- **Backend**: No backend yet - all features are UI/UX only
- **AI Features**: ElevenLabs music generation not connected (needs API)
- **Video Processing**: AI editing pipeline not implemented
- **WhatsApp Sharing**: Not implemented (needs backend)
- **Expo Haptics**: Not available on web (expected behavior)
- **Camera**: Requires native mobile device (Expo Go)
- **Version Warnings**: @types/react, babel-preset-expo, typescript have minor version mismatches (non-critical)

## User Preferences
- None documented yet

## Future Enhancements (Backend Required)
1. **Video Storage**: Cloud storage for recorded videos
2. **AI Music Generation**: ElevenLabs API integration for custom soundtracks
3. **AI Video Editing**: 
   - 3D format rendering (cube, carousel, flip pages)
   - AI background replacement
   - Split-screen multi-person compilation
4. **WhatsApp Integration**: Share stories and invite friends
5. **Friend Reflections**: Backend to collect and merge friend videos
6. **User Authentication**: Login and profile management
7. **Story Management**: Save, edit, delete stories
8. **Video Player**: Full playback with controls in ReviewScreen
9. **Processing Queue**: Background video rendering with progress tracking
10. **Social Features**: Comments, reactions, sharing
