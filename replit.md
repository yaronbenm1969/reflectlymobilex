# Reflectly Mobile App

## Overview
Reflectly is a mobile journaling application built with React Native/Expo, designed to facilitate social interaction through collaborative video storytelling. Users can record personal video stories, invite friends to contribute reflections, and share these narratives via a unique web-player system. The project's vision is to become a leading platform for interactive personal storytelling, fostering deeper connections. Key capabilities include advanced video processing, AI integration for content analysis and music generation, and seamless sharing functionalities.

## User Preferences
- User speaks Hebrew - prefer Hebrew communication when appropriate
- User has existing project "רפלקטלי פלייבק 2" with all API keys configured
- User wants complete social video journaling app with multi-user collaboration
- **CRITICAL: DO NOT MODIFY the 3D Cube animation in CubeWebView.js** - The current animation (commit b3c61832) with multi-axis rotation, floating effects (forward/backward, up/down movement) is the approved final version. Never change the `@keyframes float`, `@keyframes spin`, or the `animate()` function.

## System Architecture

### Core Features
- **Video Journaling**: Users record key stories and invite friends to record reflection videos.
- **Invite System**: Stories are shared via unique 6-character codes.
- **Web Player**: A browser-based player allows reflection recording without app installation.
- **Advanced Video Presentation**: Supports 12 distinct video display formats (e.g., 3D Cube, Flip Pages) using `react-native-reanimated-carousel`.
- **AI Integration**:
    - OpenAI Whisper for transcription.
    - GPT-4o for story analysis, editing suggestions, and AI-generated video titles.
    - MusicGen/Demucs for AI-generated background music.
- **Deep Linking & Social Sharing**: Implements deep links, universal links, and Open Graph tags for rich WhatsApp link previews.
- **Video Conversion Service**: Server-side FFmpeg transcodes HEVC to H.264. A `ConversionQueue` limits concurrent FFmpeg processes.
- **Local Video Caching**: Videos are cached locally for smooth playback; the cube only renders after all videos are cached.
- **Publishing Permission System**: Features a dual-approval system for publishing, requiring both creator and participant consent.
- **Video Export System**: Employs client-side recording via `canvas.captureStream()` in WebView for final video generation, falling back to server-side Puppeteer rendering if client recording fails. Includes fixes for iOS compatibility and 0-byte file issues.
- **AI Music Generation System**: A two-stage system:
    - **Stage 1 (Ambient Bed)**: AI-generated music plays during participant recording to set mood and tempo.
    - **Stage 2 (Full Dynamic Score)**: A new, dynamic score is generated post-collection based on emotional analysis of the compiled video, replacing the ambient bed.
    - **Stage 3 (Regeneration)**: Option for paid regeneration of the full score.
    - Utilizes GPT-4o for emotional analysis, Replicate MusicGen for music generation, and Demucs for stem separation. FFmpeg mixes stems dynamically.
    - Incorporates motion and silence detection for nuanced scoring.

### Tech Stack
- **Framework**: Expo SDK 54, React Native 0.81.5, React 19.1.0
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI**: Custom components, Linear Gradients, Expo Vector Icons, themed with a pink-purple gradient.
- **Camera**: `expo-camera` with `CameraView`
- **Animations**: `react-native-reanimated-carousel`

### Project Structure
- **Modular Design**: Organized into `components/`, `screens/`, `state/`, `hooks/`, `theme/`, `ui/`.
- **Dedicated Backend Services**: `server/` directory for video conversion, editing, format management, and Firebase Storage integration.
- **Web Player**: Separate `web-player/` directory for browser-based functionality.

### UI/UX Design
- **Theme**: Pink-purple gradient (#FF6B9D → #C06FBB) with a light pink background (#FFEFF4).
- **Aesthetic**: Clean, warm, minimalist, journaling-focused.
- **Interaction**: Smooth 60 FPS animations.

## External Dependencies

- **Firebase**: Authentication, Firestore (database), Storage (for video assets).
- **OpenAI**: Whisper API (transcription), GPT-4o (story analysis, suggestions, AI music emotional analysis).
- **Replicate**: MusicGen (AI music generation), Demucs (instrument separation).
- **FFmpeg**: Server-side for video format conversion and music mixing.
- **Expo APIs**: `expo-camera`, `expo-sharing`, `Linking`, `expo-contacts`.
- **React Native Libraries**: `react-native-reanimated-carousel`, `react-native-safe-area-context`.