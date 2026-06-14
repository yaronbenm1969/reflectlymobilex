# PROJECT MAP — Reflectly Mobile X
> Full codebase audit. Last updated: 2026-06-12.

---

## 1. High-Level Architecture

**Reflectly Mobile X** is a React Native (Expo) mobile app + Node.js backend that enables creators to record short video stories, invite participants to record reflections, apply creative visual formats (3D cube, carousel, flip-pages, spotlight), and add AI-generated music. The final result is shareable via WhatsApp.

### Ecosystem Components
| Component | Tech | Hosting |
|-----------|------|---------|
| Mobile App | Expo SDK 54, React 19, Zustand | iOS / Android |
| Backend Server | Node.js / Express + FFmpeg | Render (auto-deploy on push) |
| Database | Firebase Firestore | Firebase |
| File Storage | Firebase Cloud Storage (GCS) | Firebase |
| Web Interfaces | HTML/JS (inline templates) | Render |

### Two Web Interfaces
- `/join/:storyId` → Landing page (app/browser choice) → `/record/:storyId` → browser recording (uses `web-record-template.js`)
- `/s/:storyId` → Full web player for viewing + recording reflections (used by native deep links, uses `web-player/index.html`)

### Full User Journey
```
Creator records story clips
  → invites participants via WhatsApp link (/join/:storyId)
  → participants record reflections (native app or browser)
  → creator renders final video (format + music)
  → shares final video via WhatsApp
```

---

## 2. Mobile App Structure

### Entry Point & Navigation
- **`index.js`** → **`App.js`**
- **No React Navigation** — custom state-based screen switching via Zustand (`navigateTo`, `goBack`)
- **Deep link handling** in App.js: parses `/s/STORY_ID`, `/record/STORY_ID`, `reflectly://s/STORY_ID`

### State Management — Zustand (`src/state/appState.js`)
| State Group | Key Fields |
|-------------|-----------|
| Auth | `user`, `isAuthenticated` |
| Story | `currentStoryId`, `storyName`, `storyClipCount`, `storyMaxClipDuration` |
| Recording | `lastRecordingUri`, `keyStoryUri` |
| Format & Music | `videoFormat`, `selectedMusic`, `generatedMusicUrl`, `backgroundVideoUrl`, `clipMusicMode`, `lockedSet` |
| Player Mode | `isPlayerMode`, `playerStoryId`, `playerStoryData` |
| Reflections | `reflections[]`, `clipRenderOrder[]` |
| Processing | `processingStatus`, `processingProgress`, `finalVideoUri` |

### Screens (`src/screens/`)
| Screen | Purpose |
|--------|---------|
| AuthScreen | Email/password signup, signin, guest login |
| HomeScreen | Stories list, create new story |
| RecordScreen | Native camera recording (up to 3 min) |
| ReviewScreen | Re-record or proceed after first clip |
| MusicSelectionScreen | Choose Suno set (1–11) or generate AI music |
| FormatSelectionScreen | Pick visual format (cube-3d, carousel-3d, flip-pages, spotlight, etc.) |
| BackgroundSelectionScreen | Select background video/image |
| InstructionsScreen | Record/upload voice instruction for participants |
| WhatsAppShareScreen | Generate + share invite link |
| ProcessingScreen | Server video mixing + rendering status |
| EditRoomScreen | Trim/reorder clips before final render |
| FinalVideoScreen | Preview final video, download, share |
| PlayerViewScreen | Shows creator's intro when participant opens link |
| PlayerRecordScreen | Participant records 1–3 reflection clips |
| MyStoriesScreen | Creator's story history |
| SettingsScreen | App settings (language, camera, notifications) |
| CommunityFeedScreen | Community story browsing |
| MemberOnboardingScreen | First-time community member setup |
| AboutScreen, HelpScreen, TermsScreen, ThankYouScreen | Info / utility screens |

### Services (`src/services/`)
| File | Purpose |
|------|---------|
| `firebase.js` | Firebase SDK init (Auth, Firestore, Storage) |
| `authService.js` | Firebase Auth wrapper (signup, signin, logout, guest) |
| `storiesService.js` | Firestore stories CRUD, invite code generation |
| `storageService.js` | Firebase Storage upload/download with progress |
| `reflectionsService.js` | Save/query/subscribe to player reflections |
| `usersService.js` | User profile CRUD |
| `whatsappService.js` | Share invites via WhatsApp |
| `accessService.js` | Access code verification |
| `backgroundsService.js` | Fetch background video/image library from server |
| `notificationsService.js` | Push notifications via Expo Server SDK |

### Key Components (`src/components/`)
| Component | Purpose |
|-----------|---------|
| `cube3d/CubeWebView.js` | 3D cube WebView with video faces, auto-play, recording, music injection |
| `animations/AnimationPlayer.js` | Format selector — dispatches to CubeWebView, SpotlightWebView, etc. |
| `animations/SpotlightWebView.js` | New spotlight format player |
| `VideoFactoryWaiting.js` | Loading spinner during format rendering |
| `ui/AppButton.js`, `ui/Card.js` | Reusable UI primitives |

### Hooks
- `useNav.js` — navigation wrapper (go, back, goHome)
- `useReflectionAssets.js` — fetch reflection videos + metadata

### Theme
- `src/theme/theme.js` — colors (primary `#7c3aed` violet, gradient violet→indigo), spacing, typography (Quicksand font), border radii, shadows

---

## 3. Backend Structure

### Entry Point
**`server/video-converter-api.js`** (~2000+ lines) — Main Express app

### Setup & Middleware
- CORS (allow all origins), JSON body parsing
- Maintenance mode + access code verification (`x-app-access-code` header)
- Firebase Admin SDK initialization
- FFmpeg conversion queue (max 3 concurrent, configurable via `MAX_CONCURRENT_CONVERSIONS`)
- Multer file uploads (100 MB limit)
- Temp dirs: `/tmp/reflectly-server/uploads`, `/tmp/reflectly-server/converted`

### All API Endpoints

#### Public (no auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check |
| GET | `/health` | Detailed status (Firebase, FFmpeg, queue) |
| GET | `/join/:storyId` | Landing page (app/browser/install choice) |
| GET | `/record/:storyId` | Web recording interface (HTML) |
| GET | `/s/:storyId` | Web player (serves `web-player/index.html`) |
| GET | `/proxy-video` | Proxy video URLs with Range header support |
| GET | `/api/maintenance-status` | Returns `{ maintenance, requiresCode }` |
| POST | `/api/verify-access` | Verify access code |
| GET | `/api/render-status/:jobId` | Poll rendering job progress |
| GET | `/api/queue/status` | Queue statistics |
| GET | `/api/music-status/:jobId` | Music generation job status |
| GET | `/api/ambient-library` | List ambient library tracks |
| GET | `/api/suno-sets` | Fetch all Suno track sets metadata |
| POST | `/api/upload-player-clip` | Upload player video (multipart) |
| GET | `/api/player-upload-url` | Get signed URL for direct GCS upload |
| POST | `/api/player-clip-done` | Finalize direct upload, save reflection |

#### API (access code required if set)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/convert-and-upload` | Upload + convert HEVC→H.264 + upload to Firebase |
| POST | `/api/convert-url` | Download + validate + convert URL |
| POST | `/api/transcribe` | Transcribe video audio (OpenAI Whisper) |
| POST | `/api/transcribe-from-urls` | Batch transcribe multiple clip URLs |
| POST | `/api/select-library-track` | AI-pick Suno track from transcription |
| POST | `/api/generate-music` | Generate AI music (MusicGen via Replicate or Suno) |
| POST | `/api/generate-title` | Generate video title from transcriptions |
| POST | `/api/stories/:storyId/render` | Concatenate + transition videos |
| POST | `/api/stories/:storyId/render-format` | Format-specific visualization render |
| POST | `/api/mix-music-with-video` | Mix music audio with video |
| POST | `/api/reencode-for-whatsapp` | Re-encode video for WhatsApp compatibility |
| POST | `/api/test-mix` | Debug mixing without re-recording |
| POST | `/api/enhance-clip-audio` | Denoise + amplify single clip audio |
| POST | `/api/remix-music` | Re-generate music for existing story |

#### Admin
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/backgrounds` | List background media library |
| POST | `/admin/backgrounds/upload` | Upload background media |
| DELETE | `/admin/backgrounds/:id` | Delete background |
| GET | `/admin/music` | List music library |
| POST | `/admin/music/upload` | Upload music track |
| DELETE | `/admin/music/:id` | Delete music track |

### Key Server Modules
| File | Purpose |
|------|---------|
| `format-renderer.js` | Renders cube-3d, carousel, flip-pages, spotlight, film-strip formats via Puppeteer |
| `music/suno-track-service.js` | Suno set selection (GPT-4o), track download, cut, crossfade, loop |
| `music/music-service.js` | MusicGen wrapper (Replicate), emotion analysis, stem separation |
| `music/mixing-service.js` | Multi-stem audio mixing with emotional timeline |
| `music/emotion-analysis.js` | Emotional tone analysis from transcription |
| `music/library-catalog.js` | Suno track metadata (names, BPM, key, emotion tags) |
| `web-record-template.js` | HTML/JS template for browser recording interface |
| `ai-service.js` | OpenAI Whisper + GPT-4o API calls |
| `conversion-queue.js` | Custom concurrent job queue manager |

---

## 4. Firebase Usage

| Service | SDK | Usage |
|---------|-----|-------|
| **Auth** | Client SDK (Expo) + Admin SDK (server) | Email/password, anonymous, guest login; session persistence via AsyncStorage |
| **Firestore** | Client + Admin | Stories CRUD, reflections, user profiles, Suno track library, backgrounds library |
| **Storage (GCS)** | Client + Admin | Video/audio uploads, converted outputs, music files |

---

## 5. Firestore Collections

### `stories`
```
userId, inviteCode, name, creatorName, creatorEmail
videoUri (key story video URL)
format: "cube-3d" | "carousel-3d" | "flip-pages" | "spotlight" | "standard"
music: "suno" | "musicgen" | "none" | "suno-set-N"
instructions, instructionAudioUrl
videoTimings: { video1: 30, video2: 30, video3: 30 }
clipCount, maxClipDuration, maxParticipants
language: "he" | "en"
lockedSet: 1-11 (Suno set number)
musicAmbient: { url, id, nameHe }
sourceVideoUrl (pre-mix), finalVideoUrl (post-mix)
status: "draft" | "active" | "completed"
communitySettings: { communityMode, maxPlayers, approvalMode }
createdAt, updatedAt
```

### `reflections`
```
storyId, clipNumber: 1|2|3
videoUrl, convertedUrl
participantId ("uid" | "web_anonymous" | "web_{timestamp}")
participantName, playerName
source: "native" | "web"
hasMusicInRecording: boolean
status: "pending" | "converted" | "failed"
createdAt
```

### `users`
```
uid, email, displayName, bio
actingExperience, demoReelUrl, photoUrl
communityMember: boolean
status: "pending" | "approved"
createdAt, approvedAt
```

### `suno_tracks`
```
set: 1-11
nameHe, name, url, duration, bpm, key
posInSet, startOffset (default 45s — skip Suno intro)
tempo, emotion
createdAt
```

### `backgrounds`
```
name, url, type: "video" | "image"
category, duration (for video)
createdAt, updatedAt
```

### `invitations`
```
storyId, invitedPhone, creatorName
status: "pending"
createdAt
```

### `applications` (community mode)
```
storyId, uid, displayName
status: "pending" | "approved"
createdAt
```

---

## 6. Storage Buckets and File Flow

**Primary bucket**: `reflectly-playback.firebasestorage.app`

| Source | Path Pattern | Notes |
|--------|--------------|-------|
| Creator key story | `stories/{storyId}/key_{timestamp}.{ext}` | Native upload |
| Player reflection (native) | `stories/{storyId}/players/{uid}/video{N}_{timestamp}.{ext}` | Firebase SDK |
| Player reflection (web) | `stories/{storyId}/players/web_{timestamp}/video{N}_{timestamp}.webm` | GCS signed URL PUT |
| Instruction audio | `stories/{storyId}/instruction_audio_{timestamp}.m4a` | Native upload |
| Converted video (server) | `converted/{timestamp}.mp4` | Server intermediate |
| Final rendered video | `edited/{storyId}/final_{timestamp}.mp4` | After format render |
| Mixed video (with music) | `edited/unknown/final_music_{timestamp}.mp4` | After audio mix |
| Animated export | `stories/{storyId}/animated_export_{timestamp}.mp4` | WebView recording |
| Suno library tracks | `music/library/suno-{set}-{num}.mp3` | Pre-made library |
| AI generated music | `music/{storyId}/ai_music_{timestamp}.m4a` | MusicGen output |

### Upload Flow
1. **Native app → Firebase Storage**: `storageService.uploadVideo()` → gets download URL → saves to Firestore
2. **Web browser → GCS (direct)**: GET `/api/player-upload-url` → signed URL → browser PUT → POST `/api/player-clip-done`
3. **Server processing**: Downloads URLs → processes with FFmpeg → re-uploads to Firebase → returns final URL

---

## 7. Video Generation Pipeline

### Recording Flow
```
1. RecordScreen — native camera → local MP4/MOV file
2. ReviewScreen — play back, re-record, or proceed
3. MusicSelectionScreen — pick Suno set OR trigger MusicGen
4. FormatSelectionScreen — pick visual format
5. BackgroundSelectionScreen — pick background
6. InstructionsScreen — record voice instruction (optional)
7. WhatsAppShareScreen — share /join/{storyId} link
8. Participants record reflections (native app or browser)
9. FinalVideoScreen — request server render → preview → share
```

### Server Rendering (`POST /api/stories/:storyId/render-format`)
```
Request: { videoUrls[], format, storyName }
Response: { jobId }  ← async, poll /api/render-status/:jobId

Processing:
  1. Download clips (batched 3 at a time to avoid OOM)
  2. Convert webm → MP4 if needed
  3. renderFormatVideo() → format-renderer.js
     - cube-3d: Three.js + Puppeteer (headless Chrome)
     - carousel-3d: CSS carousel layout
     - flip-pages: page-flip transitions
     - spotlight: single-clip effects
     - film-strip: grid layout (also needs Puppeteer)
  4. Upload result to Firebase Storage
  5. Return finalUrl
```

### WebView Recording (in-app, cube-3d)
- `CubeWebView.js` renders Three.js 3D cube in React Native WebView
- `recordNextPlayback` flag → MediaRecorder captures canvas stream
- Chunks collected via `onMessage` → assembled into MP4 locally
- Uploaded directly to Firebase (iOS path, no server needed)

### Music Pipeline
```
1. Transcribe clips → OpenAI Whisper (text + timing)
2. Select Suno track → GPT-4o picks best set based on transcription
3. Download track → cut to clip duration → crossfade
4. Mix with video audio → mixRecordingAudioWithMusic()
5. Upload mixed file → Firebase Storage → finalVideoUrl
```

---

## 8. WhatsApp Sharing Pipeline

### Invite Phase
1. Creator taps Share in `WhatsAppShareScreen.js`
2. Link: `https://reflectlymobilex.onrender.com/join/{storyId}`
3. Opens WhatsApp with text message + link

### Participant Landing (`GET /join/:storyId`)
- HTML page with 3 options:
  - 🌐 Record in browser → `/record/:storyId`
  - 📱 Open app → `reflectly://s/{storyId}` (deep link)
  - 📥 Download app

### Browser Recording (`GET /record/:storyId`)
- `web-record-template.js` serves full HTML/JS recording interface
- WebRTC camera recording, direct GCS upload (bypasses Render)
- 1–3 clips, each saved as reflection in Firestore

### Native Deep Link
- App.js parses `reflectly://s/STORY_ID` or `https://.../s/STORY_ID`
- `enterPlayerMode(storyId)` → PlayerViewScreen → PlayerRecordScreen

### Final Video Share (from FinalVideoScreen)
```
handleGeneralShare():
  1. setIsDownloading(true) → show spinner
  2. getVideoForSharing():
     a. Check cachedRecordingRef (local MP4 ≥ 50KB)
     b. Download from firebaseUrlRef
     c. Try Firestore finalVideoUrl
     d. Fallback: renderConcatenatedVideo() → server render (Puppeteer)
  3. Sharing.shareAsync(localUri, { mimeType: 'video/mp4' })
     → iOS share sheet → user picks WhatsApp → video attached
```

### Known Issue (in progress)
- Mixed video often returns 7,610 bytes (empty container) due to iOS VFR (600/1 timebase) + amix incompatibility
- Fallback to Puppeteer-based render fails (Puppeteer not on Render)
- Fix in progress: re-encode VFR→CFR with libx264 before mixing

---

## 9. Authentication Flow

### App Load
1. App.js mounts → `onAuthStateChanged` listener
2. Session exists → load user profile → HomeScreen
3. No session → AuthScreen

### AuthScreen
- Email + password signup → `authService.signUp()` → Firebase Auth + Firestore profile
- Sign in → `authService.signIn()`
- Guest → `authService.signInAsGuest()` (anonymous auth, no profile)

### Access Gate (optional)
- If `EXPO_PUBLIC_ACCESS_CODE` is set → `AccessGate.js` shows code entry
- POST `/api/verify-access` → backend validates
- Valid → proceed; invalid → error + retry

### Deep Link / Player Mode
- No auth required for `/join/:storyId` landing page
- Web recording: unauthenticated browser session
- Reflections saved with `uid: 'web_anonymous'` or `uid: 'web_{timestamp}'`

### Creator Operations
- Firestore rules: `userId == auth.uid` required to write stories
- Players (different uid or anonymous) can write reflections + read story metadata

---

## 10. Environment Variables

### Frontend (`EXPO_PUBLIC_*`)
| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | GCS bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `EXPO_PUBLIC_API_URL` | Backend server URL (Render) |
| `EXPO_PUBLIC_VIDEO_CONVERTER_URL` | (Legacy alias for API_URL) |
| `EXPO_PUBLIC_WEB_PLAYER_DOMAIN` | Domain used in WhatsApp links |
| `EXPO_PUBLIC_ACCESS_CODE` | Optional access gate code |

### Backend (Render environment)
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI Whisper + GPT-4o |
| `REPLICATE_API_TOKEN` | MusicGen + Demucs voice separation |
| `FIREBASE_PROJECT_ID` | Firestore + Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_STORAGE_BUCKET` | GCS bucket name |
| `MAX_CONCURRENT_CONVERSIONS` | FFmpeg job limit (default 3) |
| `MAINTENANCE_MODE` | Set "true" to disable API |
| `ACCESS_CODE` | Optional API access code |
| `PORT` | Server port (default 3001) |

---

## 11. External Services and APIs

| Service | Key | Purpose |
|---------|-----|---------|
| **OpenAI** | `OPENAI_API_KEY` | Whisper (transcription), GPT-4o (music selection, theme analysis, title generation) |
| **Replicate** | `REPLICATE_API_TOKEN` | MusicGen (AI music generation), Demucs (voice/stem separation) |
| **Suno** | Pre-made track library (no live API) | 11 music sets stored in Firestore + GCS |
| **Firebase / GCS** | `EXPO_PUBLIC_FIREBASE_*` + service account | Auth, Firestore, Cloud Storage |
| **Expo** | Built-in | Push notifications, OTA updates, camera, filesystem |
| **Render** | Platform | Node.js server hosting (auto-deploy on git push) |

---

## 12. Top 20 Most Important Files

| # | File | Purpose |
|---|------|---------|
| 1 | `App.js` | Entry point, deep link handling, auth state, screen routing |
| 2 | `src/state/appState.js` | Zustand global state — all app state + action dispatchers |
| 3 | `server/video-converter-api.js` | Main Express backend — all 40+ API endpoints |
| 4 | `src/screens/FinalVideoScreen.js` | Final video preview, format render orchestration, music mixing, sharing |
| 5 | `src/components/cube3d/CubeWebView.js` | 3D cube WebView rendering + in-app recording |
| 6 | `src/components/animations/AnimationPlayer.js` | Format selector — dispatches to correct WebView player |
| 7 | `server/format-renderer.js` | All format rendering (cube, carousel, flip-pages, spotlight) via Puppeteer |
| 8 | `server/music/suno-track-service.js` | Suno track selection, download, cut, crossfade, loop |
| 9 | `server/music/mixing-service.js` | Audio mixing — `mixRecordingAudioWithMusic`, `mixMusicWithVideoNoAudio` |
| 10 | `server/music/music-service.js` | MusicGen wrapper, emotion analysis, stem separation |
| 11 | `server/web-record-template.js` | Full browser recording interface (HTML + WebRTC + GCS upload) |
| 12 | `src/services/storiesService.js` | Firestore stories CRUD, invite code management |
| 13 | `src/services/storageService.js` | Firebase Storage upload/download with progress |
| 14 | `src/services/reflectionsService.js` | Player reflection CRUD + real-time subscriptions |
| 15 | `src/services/firebase.js` | Firebase SDK initialization (Auth, Firestore, Storage) |
| 16 | `src/screens/PlayerRecordScreen.js` | Participant recording interface |
| 17 | `src/screens/WhatsAppShareScreen.js` | Invite link generation + WhatsApp share |
| 18 | `src/screens/RecordScreen.js` | Native camera recording |
| 19 | `server/ai-service.js` | OpenAI API calls (Whisper, GPT-4o) |
| 20 | `server/conversion-queue.js` | Concurrent FFmpeg job queue manager |

---

## 13. Technical Debt and Risk Areas

### CRITICAL: WhatsApp Video (In Progress)
- **Issue**: Final videos show audio-only or fail to share
- **Root cause**: iOS records VFR video (timebase 600/1); `amix duration=shortest` with `-c:v copy` produces empty container (7,610 bytes)
- **Two failure modes**:
  1. Empty container (7,610 bytes) → amix + VFR = 0 output frames
  2. Valid file but audio-only in WhatsApp → wrong codec/profile
- **Current approach**: Re-encode VFR→CFR with `libx264 -r 30 -profile:v baseline -pix_fmt yuv420p -bf 0`
- **Dev tool**: `POST /api/test-mix { videoUrl }` — test mixing without re-recording
- **Rule**: ONE change at a time, verify via Render logs `📦 Mix output size: NNN bytes`

### Puppeteer Not on Render
- `format-renderer.js` uses Puppeteer for cube-3d, film-strip, carousel rendering
- Puppeteer is NOT available on Render's free/standard tier
- Fallback in `FinalVideoScreen` polls render-status → gets error → spinner stuck forever (up to 15 min)
- **Impact**: cube-3d server-side fallback always fails; client-side WebView recording is the only working path
- **Fix needed**: renderConcatenatedVideo() fallback should time out gracefully, not spin forever

### No React Navigation
- Custom Zustand-based screen switching
- No built-in history stack, no transitions, manual back-button handling
- Deep link routing is fragile (6 URL patterns, manual parsing in App.js)

### Temp File Accumulation
- `server/temp/` grows to 311 MB (currently excluded from git via .gitignore but was found in repo)
- Cleanup happens after each job but crashes/timeouts can orphan files

### Community Feature Incomplete
- `CommunityFeedScreen`, `MemberOnboardingScreen` exist in UI
- No approval workflow, no notifications, no rating/commenting
- Firestore schema has `communitySettings` and `applications` collection but UI is incomplete

### Performance Issues
- Stories list loads all creator stories at once (no pagination)
- Firestore real-time listeners on reflections not always cleaned up on unmount
- Full Suno track library fetched on every story load (no caching)

### Security Concerns
- Admin endpoints (`/admin/backgrounds`, `/admin/music`) gated only by `ACCESS_CODE` — no role-based auth
- Web recording is fully unauthenticated — no rate limiting on clip uploads
- Firebase rules: public read on `stories` may expose `creatorEmail` field
- Service account keys should use Render Secrets, not `.env` in repo

### Fragility Points
- GCS signed URLs valid for 1 hour — if user pauses recording >1 hour, upload fails silently
- 6 different deep link URL formats — one parsing bug breaks all player routing
- FFmpeg has 5-minute timeout per job — slow Render disk I/O can cause legitimate timeouts
- MusicGen (Replicate) rate limiting with retry_after — no user-visible progress during waits
- `consecutiveErrors > 30` threshold in render polling is 30 × 2s = 60s before giving up

### Known Deferred Bugs
- Player clip preview modal → black screen on play (EditRoomScreen)
- Render auto-deploys on every commit — no staging environment
- `instructionAudioUrl` ambient error: `AVPlayerItem -1102 NSURLErrorDomain` on some iOS versions

### Missing Infrastructure
- No unit tests or integration tests
- No staging/preview environment (only production on Render)
- No error tracking (Sentry or equivalent)
- No analytics
- No CI/CD pipeline beyond Render auto-deploy

---

*Generated by automated codebase audit — 2026-06-12*
