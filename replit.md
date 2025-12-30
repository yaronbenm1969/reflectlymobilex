# Reflectly Mobile App

## Overview
Reflectly is a React Native/Expo mobile journaling app that allows users to record personal stories and invite friends to share reflections. The app features video recording, story management, and social sharing capabilities.

## Recent Changes (December 30, 2025)
- **Upgraded to Expo SDK 54** with React 19.1.0 and React Native 0.81.5
- **Fixed critical bug**: Removed deprecated SafeAreaView, added react-native-safe-area-context
- **Fixed Touch Bleed-Through**: Added 300ms interaction guard to ReviewScreen and MusicSelectionScreen
- **Added FormatSelectionScreen**: New screen for video format and AI background styling
- **Added SplashScreen**: 3-second animated splash screen with logo
- **Added ElevenLabs integration**: AI-generated custom music option in MusicSelectionScreen
- **Updated color theme**: Pink-purple gradient (#FF6B9D → #C06FBB) matching Reflectly aesthetic
- **Configured Expo tunnel**: Using ngrok for mobile device testing from Replit cloud
- **Firebase fully integrated**: Auth, Firestore, Storage with session persistence
- **Auth state listener**: Restores user session on app restart (App.js useEffect)
- **EditRoomScreen**: Double-tap confirmation for editing/publishing at any stage
- **ThankYouScreen**: New screen for players with app download links
- App running on tunnel via Expo Go with comprehensive logging
- **Copied all screens** from original app in attached_assets/expo-mobile-standalone/

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

### FULL User Flow (Requested by User)
1. **Splash Screen** (3 seconds) → Auto-navigate to Home
2. **Home Screen** → Input story name (saved to state for all screens)
3. **Record Screen** → Record key story video
4. **Format Selection** → Choose presentation format:
   - 3D Cube
   - 3D Carousel
   - Flip Pages
   - Standard
5. **Music Selection** → Choose background music:
   - 🎼 AI-generated custom music (ElevenLabs)
   - Pre-made tracks (Upbeat, Calm, Dramatic, Romantic)
   - No music option
6. **Instructions Screen** → Creator writes instructions for players:
   - Generic instructions for all players
   - Specific timing for each of 3 reflection videos
   - Privacy settings (social media vs private viewing)
7. **WhatsApp Share Screen** → Send invitation via WhatsApp:
   - Select contacts from device
   - Auto-generate message: "Hi, this is my story [attached], please click link to view and respond"
   - Send story link to selected contacts
8. **Player View Screen** → Player watches key story video
9. **Player Record Screen** → Player records 3 reflection videos:
   - 3 styled recording buttons
   - Generic + specific instructions visible
   - Timer for each video
   - Privacy consent checkbox
10. **Processing Screen** → AI editing in progress:
    - Combines all player videos
    - Applies selected format (3D cube/carousel/flip)
    - Adds selected music
    - Uses AI background styling
11. **Edit Room Screen** → Creator controls editing:
    - Preview all collected videos
    - Control when and how to edit
    - Adjust final output
12. **Final Video Screen** → View and share completed video:
    - Play edited video with soundtrack
    - Share or download based on player privacy settings

### Implemented Screens (Current Status - ALL COMPLETE!)
✅ **Creator Flow:**
1. **SplashScreen**: 3-second animated logo screen
2. **HomeScreen**: Story name input + navigation
3. **RecordScreen**: Full video recording with camera controls
4. **ReviewScreen**: Review recorded video with action buttons
5. **FormatSelectionScreen**: Video format (3D cube, carousel, flip pages, standard)
6. **MusicSelectionScreen**: Background music selection including AI option
7. **InstructionsScreen**: Creator instructions for players (3 video timings, privacy)
8. **WhatsAppShareScreen**: Native WhatsApp sharing (FREE, no Twilio!)
9. **ProcessingScreen**: AI editing progress animation
10. **EditRoomScreen**: Creator's editing control panel
11. **FinalVideoScreen**: View, share, and download final video

✅ **Player Flow (for friends who receive invitations):**
12. **PlayerViewScreen**: Player watches key story video
13. **PlayerRecordScreen**: Player records 3 reflection videos with timers

✅ **Utility Screens:**
14. **MyStoriesScreen**: Story gallery (UI only, no backend)
15. **SettingsScreen**: App configuration
16. **CameraSettingsScreen**: Recording preferences
17. **AboutScreen, HelpScreen, TermsScreen**: Information screens

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

### API Keys & Secrets Status
**User has API keys in another Replit project: "ReflectlyPlayback-2"**

Required Secrets (ADDED ✅):
- ✅ `OPENAI_API_KEY` - For AI video processing and transcription
- ✅ `REPLICATE_API_TOKEN` - For AI video processing
- ✅ `Music123` - Music related key

**NOT needed:**
- ❌ Twilio keys - WhatsApp sharing will use native device sharing (expo-sharing + Linking API) - FREE!
- ❌ PostgreSQL keys - This is a mobile app, database is in backend project
- ❌ Object Storage keys - Will be handled by backend

**WhatsApp Sharing Solution:**
- Use `expo-sharing` or `Linking.openURL('whatsapp://send?text=...')` to open WhatsApp directly
- Use `expo-contacts` to select contacts from device
- No paid API required!

### Known Considerations
- **Backend**: No backend yet - all features are UI/UX only
- **AI Features**: ElevenLabs music generation not connected (waiting for API key)
- **Video Processing**: AI editing pipeline not implemented
- **WhatsApp Sharing**: Not implemented (waiting for Twilio keys)
- **Expo Haptics**: Not available on web (expected behavior)
- **Camera**: Requires native mobile device (Expo Go)
- **Version Warnings**: @types/react, babel-preset-expo, typescript have minor version mismatches (non-critical)

## User Preferences
- User speaks Hebrew - prefer Hebrew communication when appropriate
- User has existing project "רפלקטלי פלייבק 2" with all API keys configured
- User wants complete social video journaling app with multi-user collaboration

## Next Steps (When User Returns)
1. **Verify Secrets Added**: User will add API keys from "רפלקטלי פלייבק 2" project
2. **Update appState.js**: Add storyName, playerInstructions, videoTimings, participants, privacySettings
3. **Build Missing Screens**:
   - StoryNameScreen (or integrate into HomeScreen)
   - InstructionsScreen
   - WhatsAppShareScreen
   - PlayerViewScreen
   - PlayerRecordScreen
   - ProcessingScreen
   - EditRoomScreen
   - FinalVideoScreen
4. **Update Navigation Flow**: Splash → StoryName → Record → Format → Music → Instructions → WhatsApp → Processing → EditRoom → FinalVideo
5. **Integrate APIs**:
   - ElevenLabs for custom music generation
   - Twilio for WhatsApp sharing
   - OpenAI for video transcription and AI editing
6. **Build Backend**: API endpoints for video storage, processing queue, and multi-user collaboration

## Original Source Files
- **Location**: `attached_assets/expo-mobile-standalone/`
- **Contains**: All base screens, components, theme, and project structure
- **Note**: Original app is demo-only with no backend or API keys
