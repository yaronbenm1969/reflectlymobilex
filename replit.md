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
- **Theme**: Purple-blue gradient (#8446b0 → #464fb0) with turquoise accent (#469bb0), light lavender background (#F5F0FA).
- **Aesthetic**: Clean, warm, minimalist, journaling-focused.
- **Interaction**: Smooth 60 FPS animations.

## External Dependencies

- **Firebase**: Authentication, Firestore (database), Storage (for video assets).
- **OpenAI**: Whisper API (transcription), GPT-4o (story analysis, suggestions, AI music emotional analysis).
- **Replicate**: MusicGen (AI music generation), Demucs (instrument separation).
- **FFmpeg**: Server-side for video format conversion and music mixing.
- **Expo APIs**: `expo-camera`, `expo-sharing`, `Linking`, `expo-contacts`.
- **React Native Libraries**: `react-native-reanimated-carousel`, `react-native-safe-area-context`.

## AI Music Generation System

### Two-Stage Architecture
1. **Stage 1 - Ambient Bed**: Pre-generated library of 10 emotional anchor tracks. Plays during filming to inspire participants with mood/BPM. One-time generation cost ~$0.30-0.50.
2. **Stage 2 - Full Dynamic Score**: AI-generated music post-production using emotion timeline, motion/silence/singing detection. Replaces ambient bed in final video. Uses same musical key as selected ambient for coherence.
3. **Stage 3 - Regeneration**: Option for paid regeneration (admin-configurable pricing).

### Music Pipeline Modules
- **Emotion Analysis** (`server/music/emotion-analysis.js`): GPT-4o analyzes Whisper transcription → emotion timeline with per-instrument levels, EQ, reverb, stereo width.
- **Music Generation** (`server/music/music-service.js`): Replicate MusicGen (stereo-large) → Demucs stem separation (drums/bass/vocals/melody). DEMUCS_MODEL configurable: htdemucs (4ch) or htdemucs_6s (6ch).
- **Dynamic Mixing** (`server/music/mixing-service.js`): FFmpeg re-mixes stems with per-channel dynamic volume from emotion timeline. Music volume adjustable (default 0.3).
- **Ambient Library** (`server/music/ambient-library.js`): 10 presets with detailed MusicGen prompts (3-phase structure each).

### Ambient Bed Presets (10 tracks)
1. Reflective Space (D, 60bpm) - מרחב פנימי
2. Gentle Warmth (G, 65bpm) - חום עדין
3. Soft Hope (C, 70bpm) - תקווה שקטה
4. Tender Vulnerability (Am, 58bpm) - עדינות רגשית
5. Quiet Strength (E, 62bpm) - כוח שקט
6. Light Movement (A, 80bpm) - תנועה עדינה
7. Floating Memory (Dm, 55bpm) - זיכרון מרחף
8. Grounded Calm (F, 56bpm) - רוגע מעוגן
9. Subtle Uplift (Bb, 72bpm) - התעלות עדינה
10. Open Horizon (D, 75bpm) - אופק פתוח

### Music API Endpoints (on video-converter-api.js, port 3001)
- `POST /api/generate-music` - Start async full score generation
- `GET /api/music-status/:jobId` - Poll generation progress
- `POST /api/mix-music-with-video` - Mix music with rendered video
- `GET /api/ambient-library` - Get all ambient presets metadata
- `POST /api/generate-ambient-library` - Generate all 10 tracks (one-time)
- `GET /api/ambient-track/:trackId` - Get specific track URL and metadata

### Pipeline Order (no conflicts with existing video processing)
```
Individual videos → convertVideo() [noise filter] → clean videos → Format render → Full Dynamic Score → Final mix
```

### Firestore Schema for Music
- `story.music` = selected preset id or 'none'
- `story.musicAmbient` = { id, name, key, bpm, url }
- `settings/ambientLibrary` = { tracks: { [presetId]: { url, key, bpm, name } }, generatedAt, trackCount }

## Current Status / Next Steps (Feb 22, 2026)
- **DONE**: MusicSelectionScreen UI with 10 Hebrew presets, ambient-library.js with MusicGen prompts, API endpoints, Firestore integration for saving selection + URL
- **DONE**: Fixed `firestoreDb` variable name in ambient endpoints (was `db`), fixed Replicate token lazy initialization
- **BLOCKED**: Replicate API token returning 401 Unauthorized. User needs to verify/refresh token at replicate.com/account/api-tokens and update the REPLICATE_API_TOKEN secret
- **NEXT after token fix**: Run `/api/generate-ambient-library` to create all 10 tracks and upload to Firebase
- **THEN**: Implement ambient playback during recording, build Stage 2 full dynamic score pipeline

### Commercial Licensing Decision
- **For development**: Using MusicGen (Meta) via Replicate - NOT commercially licensed (CC-BY-NC)
- **For production/commercial launch**: Plan to switch to Beatoven.ai API (~$0.12-0.15/min, ~₪0.40-0.55 per 1min video) - fully commercially licensed, ethically trained
- **Alternative considered**: Suno AI ($10/mo Pro for manual creation), Mubert API ($99+/mo)
- **Ambient library (10 tracks)**: Can create manually in Suno ($10 one-time) for commercial use
- **Code is modular**: music-service.js can be swapped to different provider without changing rest of pipeline