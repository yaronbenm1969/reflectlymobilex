# Reflectly Mobile App

## Overview
Reflectly is a mobile journaling app built with React Native/Expo that enables users to record personal video stories, invite friends to contribute reflections, and share these collaborative video narratives. The app aims to facilitate meaningful social interaction through shared video experiences, featuring advanced video processing, AI integration, and a unique web-player system for seamless participation. The business vision is to create a leading platform for interactive personal storytelling, fostering deeper connections among users.

## User Preferences
- User speaks Hebrew - prefer Hebrew communication when appropriate
- User has existing project "רפלקטלי פלייבק 2" with all API keys configured
- User wants complete social video journaling app with multi-user collaboration
- **CRITICAL: DO NOT MODIFY the 3D Cube animation in CubeWebView.js** - The current animation (commit b3c61832) with multi-axis rotation, floating effects (forward/backward, up/down movement) is the approved final version. Never change the `@keyframes float`, `@keyframes spin`, or the `animate()` function.

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

### Video Export System
- **Current approach**: Server-side rendering with Puppeteer (headless Chromium) capturing frame-by-frame screenshots at 12fps, then compiling with FFmpeg. Uses CDP protocol for faster screenshot capture, parallel video downloads, and ultrafast FFmpeg preset.
- **Performance optimizations**: Server-side deduplication prevents duplicate renders (renderKey check). Client-side activeRenderRef guard prevents duplicate requests. Progress reported every 1 second.
- **Client polling**: 2s interval, up to 450 polls (15 min timeout), 30 consecutive errors threshold, AbortController with 15s per-request timeout.
- **Client-side recording (IMPLEMENTED, PARTIALLY WORKING)**: Uses `canvas.captureStream(30)` + `MediaRecorder` in WebView during first playback. Auto-records during playback, uploads webm to Firebase, converts to mp4 via server. Falls back to server-side render if recording too small (<50KB).
  - **FIXED**: `crossOrigin='anonymous'` on all video elements (required for canvas not to be tainted). Recording now produces valid 3.5MB webm files.
  - **FIXED (Feb 20 2026)**: iOS `PHPhotosErrorDomain error 3302` - Root cause: webm from MediaRecorder has no audio track, FFmpeg produced mp4 without audio which iOS Photos rejects. Fix: `convertVideo()` now uses `hasAudioStream()` to detect missing audio and adds silent AAC track via `anullsrc`. Also switched to H.264 Baseline profile level 3.1 for max iOS compatibility.
  - **FIXED (Feb 20 2026)**: FlipPages recording producing 0-byte files - Root cause: MIME type `video/webm;codecs=vp8,opus` contains comma, `split(',')[1]` extracted wrong part of data URL. Fix: Use `indexOf(';base64,')` to correctly extract base64 data. Applied to both CubeWebView and FlipPagesWebView.
  - **Key files**: CubeWebView.js (recording logic), FlipPagesWebView.js (recording logic), FinalVideoScreen.js (upload/convert/save flow)
  - **Flow**: WebView records → checks blob size → sends base64 chunks → native saves file → checks file size → uploads to Firebase → converts webm→mp4 → downloads mp4 → saves to gallery

## AI Music Generation System (IN PROGRESS - Feb 21 2026)

### Architecture
Full pipeline for AI-generated background music that responds to video emotional content:

1. **Emotional Analysis** (`server/music/emotion-analysis.js`): 
   - GPT-4o analyzes Whisper transcription → creates emotion timeline map with timestamps
   - Each segment: emotion, intensity, per-instrument levels (drums/bass/melody), EQ, reverb, stereo width
   - Generates single continuous MusicGen prompt describing full emotional journey (maintains musical coherence)

2. **Music Generation** (`server/music/music-service.js`):
   - Replicate MusicGen (`facebook/musicgen:stereo-large`) creates ONE continuous instrumental track
   - Single prompt = same key, harmony, rhythm throughout
   - Replicate Demucs (`ardianfe/demucs-prod`) separates into 4 stems: drums, bass, vocals (empty), other (melody)
   - `DEMUCS_MODEL` env var configurable: `htdemucs` (4 channels, default) or `htdemucs_6s` (6 channels: +guitar, +piano)

3. **Dynamic Mixing** (`server/music/mixing-service.js`):
   - FFmpeg re-mixes stems with per-channel dynamic volume based on emotion timeline
   - Per-segment: drums level, bass level, melody level (0-100)
   - EQ presets (warm/bright/deep/neutral), reverb, stereo width
   - Final mix with video: music volume adjustable (default 0.3), original audio preserved

### API Endpoints (added to video-converter-api.js)
- `POST /api/generate-music` - Start async music generation (storyId, transcriptionSegments, totalDuration, style)
- `GET /api/music-status/:jobId` - Poll generation progress
- `POST /api/mix-music-with-video` - Mix generated music with rendered video

### Pipeline Order (critical - no conflicts)
```
Individual videos → convertVideo() [noise filter: highpass/lowpass/afftdn/compressor] → clean videos
                                                                                          ↓
                                                                              Format render (cube/flip)
                                                                                          ↓
                                                                              Final video + Music mix ← AI Music
```
Music is added AFTER noise filter (which only cleans individual video clips). No interference.

### Cost per video: ~$0.12-0.13
- MusicGen: ~$0.03-0.05
- Demucs: ~$0.07
- GPT-4o analysis: ~$0.01

### Design Decision (CONFIRMED by user - Feb 22 2026)
**Two-stage music system:**

**Stage 1 - Ambient Bed (during recording):**
- Generated right after creator records their story
- Plays DURING filming for both creator review AND participant recordings
- Purpose: Set BPM, musical key, mood - inspire participants to sing, dance, move
- Characteristics: non-intrusive, open, encouraging, 3-phase structure (spacious opening → gentle development → optimistic ending)
- Plays in background while participants record via WhatsApp web-player link
- This music is TEMPORARY - will be replaced in final video

**Stage 2 - Full Dynamic Score (final video):**
- Generated AFTER all recordings are collected and video is compiled
- Completely NEW music, but uses SAME musical key as Ambient Bed (so any singing/humming stays in tune)
- Built from full analysis of finished film: transcription, emotion timeline, motion detection, silence detection, singing detection
- Dynamic: responds to every moment in the video
- Replaces the Ambient Bed entirely in the final output

**Stage 3 - Regeneration (optional, paid):**
- If creator doesn't like the Full Score → "Generate new music" button in Edit Room
- Each regeneration costs money (price configurable in admin panel)
- Uses same analysis but different creative interpretation

### Advanced Analysis Features (from spec doc):
- **Motion Detection**: Compare video frames for movement when no speech (motionEnergy > 0.35 for 3+ seconds)
- **Silence Detection**: RMS audio energy below speech threshold
- **Singing Detection**: Sustained pitch, stable vocal frequency → music ducks (reduce intensity, remove pulse, keep harmonic drone)
- These events feed into the emotional timeline for Full Score generation

### Existing UI (already built, needs updating):
- `MusicSelectionScreen.js` - Full screen with options: ai-custom, upbeat, calm, dramatic, romantic, none
- `appState.js` - `selectedMusic` / `setSelectedMusic` in Zustand
- `storiesService.js` - saves `music` field to Firestore
- `FormatSelectionScreen.js` - navigates to MusicSelection (line 98)
- Description needs update: change "ElevenLabs" → "MusicGen/Replicate"
- Need to add: AI generation trigger, progress UI, musicUrl storage, ambient bed playback in web-player

### Future Upgrade Path
- When Suno AI releases official API → add vocal/singing option
- Switch DEMUCS_MODEL to htdemucs_6s for 6-channel separation (guitar+piano separate)
- User's mood selection becomes part of MusicGen prompt

## External Dependencies

- **Firebase**: Authentication, Firestore (database), Storage (for video assets).
- **OpenAI**: Whisper API for transcription, GPT-4o for story analysis and suggestions.
- **Replicate**: MusicGen for AI music generation, Demucs for instrument separation.
- **FFmpeg**: Server-side for video format conversion and music mixing.
- **Expo APIs**: `expo-camera`, `expo-sharing`, `Linking` (for WhatsApp integration), `expo-contacts`.
- **React Native Libraries**: `react-native-reanimated-carousel`, `react-native-safe-area-context`.