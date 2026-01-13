# Reflectly Mobile App

## Overview
Reflectly is a mobile journaling app built with React Native/Expo that enables users to record personal video stories, invite friends to contribute reflections, and share these collaborative video narratives. The app aims to facilitate meaningful social interaction through shared video experiences, featuring advanced video processing, AI integration, and a unique web-player system for seamless participation. The business vision is to create a leading platform for interactive personal storytelling, fostering deeper connections among users.

## User Preferences
- User speaks Hebrew - prefer Hebrew communication when appropriate
- User has existing project "רפלקטלי פלייבק 2" with all API keys configured
- User wants complete social video journaling app with multi-user collaboration

## System Architecture

### Core Features
- **Video Journaling**: Users record key stories and invite friends to record reflection videos.
- **Invite System**: Each story generates a unique 6-character code for sharing.
- **Web Player**: A browser-based player allows friends to watch stories and record reflections without installing the app.
- **Advanced Video Presentation**: Supports 12 distinct video display formats including 3D Cube, 3D Carousel, Flip Pages, Stack Cards, and more, using `react-native-reanimated-carousel`.
- **AI Integration**:
    - OpenAI Whisper for transcription.
    - GPT-4o for story analysis and automatic editing suggestions.
    - AI-generated video titles.
    - ElevenLabs for AI-generated custom music options.
- **Deep Linking & Social Sharing**: Supports deep links (`reflectly://`), universal links, and smart app banners for seamless app opening from WhatsApp. Open Graph tags ensure rich WhatsApp link previews.
- **Video Conversion Service**: Server-side FFmpeg conversion handles HEVC to H.264 transcoding for iPhone compatibility. Web-player calls converter API immediately after recording and stores `convertedUrl` in Firestore. A job queue system (`ConversionQueue`) limits concurrent FFmpeg processes to prevent server overload (configurable via `MAX_CONCURRENT_CONVERSIONS` env var, default: 3).
- **Local Video Caching**: Videos are downloaded to device cache (`expo-file-system`) before playback for instant, smooth cube performance. The cube only renders after ALL videos are successfully cached locally. Failed downloads trigger an error screen with retry option. WebView HTML is also saved to file with file:// access enabled.
- **Publishing Permission System**: Dual-approval system for video publishing:
    - Creator sets `publishingEnabled` toggle in InstructionsScreen
    - If enabled, participants must approve publishing before recording
    - Approval/rejection saved to Firestore (`participantApprovals` map, `hasRejections` flag)
    - Creator gets real-time notifications when participants reject
    - Options: convert to private project or invite other participants
    - Data stored in `privacySettings.publishingEnabled` and `story.participantApprovals`

### Tech Stack
- **Framework**: Expo SDK 54, React Native 0.81.5, React 19.1.0
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI**: Custom components, Linear Gradients, Expo Vector Icons (Ionicons)
- **Camera**: `expo-camera` with `CameraView`
- **Animations**: `react-native-reanimated-carousel`
- **Styling**: React Native StyleSheet with a custom pink-purple gradient theme (#FF6B9D → #C06FBB).

### Project Structure
- **Modular Design**: Organized into `components/`, `screens/`, `state/`, `hooks/`, `theme/`, and `ui/` for maintainability.
- **Dedicated Backend Services**: A `server/` directory houses backend logic for video conversion (`video-converter-api.js`), video editing (`video-editor.ts`), format management (`format-manager.ts`), and Firebase Storage integration (`video-storage-service.ts`, `firebase-admin.ts`).
- **Web Player**: Separate `web-player/` directory contains HTML, CSS, and JavaScript for the browser-based player.

### User Flow
The application supports distinct Creator and Player flows, encompassing:
- **Creator Flow**: Splash, Home (story name), Record, Format Selection, Music Selection (including AI music), Instructions, WhatsApp Share, Processing, Edit Room, Final Video.
- **Player Flow**: Player View (watch key story), Player Record (record 3 reflection videos).
- **Navigation**: Custom navigation system using Zustand, avoiding React Navigation, with a side menu for primary app navigation.

### UI/UX Design
- **Theme**: Reflectly-style pink-purple gradient (#FF6B9D → #C06FBB) as the primary color scheme, with a light pink background (#FFEFF4).
- **Aesthetic**: Clean, warm, minimalist design focused on journaling.
- **Interaction**: Features smooth 60 FPS animations for carousels and interactive format selection.

## External Dependencies

- **Firebase**: Authentication, Firestore (database), Storage (for video assets).
- **OpenAI**: Whisper API for transcription, GPT-4o for story analysis and suggestions.
- **Replicate**: For AI video processing.
- **ElevenLabs**: For AI-generated custom music.
- **FFmpeg**: Server-side for video format conversion.
- **Expo APIs**: `expo-camera`, `expo-sharing`, `Linking` (for WhatsApp integration), `expo-contacts`.
- **React Native Libraries**: `react-native-reanimated-carousel`, `react-native-safe-area-context`.