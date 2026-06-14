# FIX PLAN FOR DEVELOPER — Reflectly Mobile X
> Based on PROJECT_MAP.md audit. Last updated: 2026-06-12.
> Do not change code until each item is understood in full context.

---

## CATEGORY 1 — Must Fix Before Store Launch

These are blockers. The app cannot ship with these unresolved.

---

### 1.1 WhatsApp Video Share — Empty Container (7,610 bytes)

**What's broken**: When the creator presses "Share" in FinalVideoScreen, the server mixes the recorded video with music and returns a 7,610-byte empty MP4 container. The share flow fails silently — the spinner spins forever.

**Root cause**: iOS records VFR video (timebase 600/1). FFmpeg's `amix` filter with `duration=shortest` produces zero audio frames when the input PTS is not normalized. The `-c:v copy` flag cannot fix VFR — it requires full re-encoding to convert VFR → CFR.

**Files involved**:
- `server/music/mixing-service.js` — function `mixRecordingAudioWithMusic()` (line ~393)
- `src/screens/FinalVideoScreen.js` — function `getVideoForSharing()` (line ~1195)
- `server/video-converter-api.js` — endpoint `POST /api/mix-music-with-video`

**Current state**: Multiple fix attempts (commits b0fc146, 1330e0a, a1ac094, 3ed2dea). Latest attempt re-encodes with `libx264 -r 30 -profile:v baseline`. Not yet confirmed working.

**What to verify**:
1. Check Render logs after next test: look for `📦 Mix output size: NNN bytes` — must be > 100,000 bytes
2. If still 7,610 bytes: run `POST /api/test-mix { videoUrl: "<real_video_url>" }` against Render directly to isolate server issue from client issue
3. If mix size is correct but WhatsApp still shows audio-only: the codec profile needs adjustment

**Risk level**: 🔴 Critical — this is the core product output path

**Estimated hours**: 4–8h (diagnosis + fix + test on real device)

**Manual test needed**:
- Record a cube-3d story on iPhone
- Let the music pipeline complete (watch for ✅ AI music mixed)
- Press "Share" → pick WhatsApp → send to a WhatsApp contact → open on a different phone → confirm video AND audio play

---

### 1.2 Spinner Stuck Forever — Puppeteer Fallback

**What's broken**: When `getVideoForSharing()` cannot find a valid video, it falls back to `renderConcatenatedVideo()` which calls `POST /api/stories/:storyId/render-format`. The server responds 200 with a jobId. Client polls `/api/render-status/:jobId` every 2 seconds. But the server fails immediately with "puppeteer-core not available" (Puppeteer is not installed on Render). The client keeps polling for up to 15 minutes (450 polls × 2s) before finally giving up.

**User experience**: Loading spinner appears after pressing "Share" and never disappears. No error message shown. User thinks app is frozen.

**Files involved**:
- `src/screens/FinalVideoScreen.js` — `renderConcatenatedVideo()` (line ~687), `consecutiveErrors` logic (line ~747–762)
- `server/format-renderer.js` — `renderFormatVideo()` (line ~771)
- `server/video-converter-api.js` — `POST /api/stories/:storyId/render-format` handler

**Fix needed**:
1. Server: When puppeteer is not available, the `/api/render-status/:jobId` should return `{ status: "failed", error: "..." }` immediately after the job is created — not leave it as "processing" forever
2. Client: In `renderConcatenatedVideo()`, the `consecutiveErrors > 30` check treats "failed" status as a fetch error — it should detect `statusData.status === 'failed'` and surface a clear user-facing error message immediately, not spin

**Risk level**: 🔴 Critical — blocks sharing flow entirely when mixing fails

**Estimated hours**: 2–3h

**Manual test needed**:
- Force a mixing failure (temporarily break mixing-service.js locally)
- Press "Share" → confirm error message appears within 5 seconds instead of infinite spinner

---

### 1.3 Firebase Security Rules — creatorEmail Exposed

**What's broken**: The `stories` Firestore collection has public read access (needed so participants can load the story). But the `stories` document contains `creatorEmail` — a private field that any user can read if they know the `storyId`.

**Files involved**:
- Firebase Console → Firestore → Rules (not a file in this repo)
- `src/services/storiesService.js` — `createStory()` writes `creatorEmail` to document

**Fix needed**: Either remove `creatorEmail` from the public document (store it in a private subcollection or in the `users` collection), or add a Firestore rule that masks it from non-owner reads.

**Risk level**: 🔴 Critical for store launch — App Store and Google Play require privacy compliance

**Estimated hours**: 2h

**Manual test needed**:
- Use the Firebase REST API with an anonymous token to fetch a story document
- Confirm `creatorEmail` is not visible

---

### 1.4 Service Account Key in .env File

**What's broken**: `FIREBASE_PRIVATE_KEY` and other service account credentials are stored in `.env` in the repo. If the repo is ever made public or if `.gitignore` is misconfigured, credentials are exposed.

**Files involved**:
- `.env` (root)
- `server/.env` (if exists)

**Fix needed**: Move all Firebase Admin credentials (`FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, etc.) to Render's environment variable manager (not in any file). Ensure `.env` is in `.gitignore` and not committed.

**Risk level**: 🔴 Critical — credential leak = data breach

**Estimated hours**: 1h (Render dashboard + verify .gitignore)

**Manual test needed**:
- Run `git log --all --follow -- .env` to confirm .env was never committed
- Confirm Render deploys correctly after removing local .env dependency from server startup

---

### 1.5 No Error Tracking

**What's broken**: There is no crash reporting or error monitoring. When something fails in production (mixing, upload, rendering), the only visibility is Render logs — which require manual checking and have no alerting.

**Files involved**:
- None currently — needs to be added
- Best entry points: `App.js` (global error boundary), `server/video-converter-api.js` (global Express error handler)

**Fix needed**: Install Sentry (free tier covers this app's scale). Add `@sentry/react-native` to the app and `@sentry/node` to the server.

**Risk level**: 🟠 High — without this, bugs in production are invisible

**Estimated hours**: 3h (setup + DSN config + test)

**Manual test needed**:
- Force a crash in the app → confirm it appears in Sentry dashboard

---

## CATEGORY 2 — Should Fix Before Beta Users

These are not launch blockers but will cause frustration or support overhead with real users.

---

### 2.1 Admin Endpoints Have No Role-Based Auth

**What's broken**: `/admin/backgrounds`, `/admin/music/upload`, `/admin/backgrounds/upload` are protected only by the same `ACCESS_CODE` used by all API clients. Any user who knows the access code can upload/delete from the media library.

**Files involved**:
- `server/video-converter-api.js` — all `/admin/*` route handlers

**Fix needed**: Add a separate `ADMIN_SECRET` environment variable that is different from `ACCESS_CODE`. Check `x-admin-secret` header on all `/admin/*` routes.

**Risk level**: 🟠 High — unauthorized content manipulation

**Estimated hours**: 2h

**Manual test needed**:
- Attempt to hit `/admin/backgrounds/upload` with only the regular `ACCESS_CODE` → should get 403
- Confirm admin routes work with new `ADMIN_SECRET`

---

### 2.2 Web Recording Has No Rate Limiting

**What's broken**: The browser recording endpoint (`GET /api/player-upload-url`, `POST /api/player-clip-done`) requires no authentication and has no rate limiting. Anyone can generate infinite signed GCS upload URLs and flood Firebase Storage.

**Files involved**:
- `server/video-converter-api.js` — `/api/player-upload-url` handler, `/api/player-clip-done` handler

**Fix needed**: Add `express-rate-limit` to these endpoints (e.g., max 10 signed URL requests per IP per hour). Optionally verify that the `storyId` in the request exists in Firestore before issuing a signed URL.

**Risk level**: 🟠 High — storage abuse, billing risk

**Estimated hours**: 2h

**Manual test needed**:
- Send 11 rapid requests to `/api/player-upload-url` from the same IP → confirm 429 on the 11th

---

### 2.3 Spinner Has No Timeout / Error Message for User

**What's broken**: Multiple places in `FinalVideoScreen.js` show an `isDownloading` spinner with no timeout and no user-visible error message when things fail. Users see a spinning circle forever with no explanation.

**Files involved**:
- `src/screens/FinalVideoScreen.js` — `getVideoForSharing()`, `renderConcatenatedVideo()`, `handleGeneralShare()`
- `src/components/VideoFactoryWaiting.js` — loading overlay

**Fix needed**:
1. Add a maximum timeout to `getVideoForSharing()` — if it hasn't returned within 3 minutes, show a clear error: "Video not ready yet — try again in a moment"
2. Ensure `handleGeneralShare()` catch block always shows an Alert (currently it may be skipped)
3. Add a "Try Again" button on the end screen when sharing fails

**Risk level**: 🟠 High — user experience issue that will generate support requests

**Estimated hours**: 3h

**Manual test needed**:
- Kill the Render server, then press "Share" in FinalVideoScreen
- Confirm an error message appears within a reasonable time (< 3 min)

---

### 2.4 GCS Signed URLs Expire After 1 Hour — Silent Failure

**What's broken**: When a web participant starts recording but pauses for over 1 hour, the GCS signed URL expires. The upload silently fails (405 Method Not Allowed from GCS). No error is shown to the participant.

**Files involved**:
- `server/video-converter-api.js` — `/api/player-upload-url` handler
- `server/web-record-template.js` — client-side upload logic

**Fix needed**: In `web-record-template.js`, when an upload returns a non-200/201 response from GCS, request a new signed URL and retry once. Show a user-facing error if the retry also fails.

**Risk level**: 🟠 High — participants lose recordings silently

**Estimated hours**: 3h

**Manual test needed**:
- Mock an expired URL response (return 405) from the upload → confirm retry logic kicks in

---

### 2.5 Temp Files Orphaned After Crash

**What's broken**: `server/temp/` (311 MB found in audit) accumulates temp video files when FFmpeg jobs crash, timeout, or are killed mid-processing. Cleanup only runs in the `finally` block, which may not execute on process kill.

**Files involved**:
- `server/video-converter-api.js` — job cleanup in render endpoints
- `server/conversion-queue.js` — job lifecycle

**Fix needed**: Add a startup cleanup routine that deletes all files in `/tmp/reflectly-server/` older than 2 hours on server boot. This covers orphaned files from previous Render deployments.

**Risk level**: 🟠 Medium-High — disk space exhaustion can crash Render instance

**Estimated hours**: 1h

**Manual test needed**:
- Manually create old files in `/tmp/reflectly-server/` and restart the server
- Confirm they are deleted on startup

---

### 2.6 Firestore Listeners Not Always Cleaned Up

**What's broken**: `reflectionsService.js` creates real-time Firestore listeners (`onSnapshot`). If screens unmount without calling the unsubscribe function, listeners accumulate and can cause memory leaks and unnecessary Firestore reads (billing impact).

**Files involved**:
- `src/services/reflectionsService.js` — `subscribeToReflections()`
- `src/screens/EditRoomScreen.js`, `src/screens/FinalVideoScreen.js` — screens that subscribe

**Fix needed**: Audit all `onSnapshot` calls and confirm unsubscribe is called in `useEffect` cleanup function (`return () => unsubscribe()`).

**Risk level**: 🟡 Medium — memory leak + Firebase billing

**Estimated hours**: 2h

**Manual test needed**:
- Navigate to EditRoomScreen and back multiple times
- Check Firebase console → Firestore → Usage → reads should not grow unboundedly

---

### 2.7 Stories List Has No Pagination

**What's broken**: `MyStoriesScreen` loads ALL of the creator's stories at once from Firestore. With 50+ stories this will cause slow load times and high Firestore read costs.

**Files involved**:
- `src/services/storiesService.js` — `getUserStories()` query
- `src/screens/MyStoriesScreen.js` — stories display

**Fix needed**: Add Firestore `limit(20)` + `startAfter()` cursor-based pagination. Show a "Load more" button or implement infinite scroll.

**Risk level**: 🟡 Medium

**Estimated hours**: 3h

**Manual test needed**:
- Create 25+ stories and verify the first load shows only 20 with a "load more" option

---

### 2.8 EditRoomScreen — Clip Preview Black Screen

**What's broken**: When the creator opens the EditRoomScreen and taps a clip to preview, the video player shows a black screen.

**Files involved**:
- `src/screens/EditRoomScreen.js` — clip preview modal / video player component

**Risk level**: 🟡 Medium — feature unusable

**Estimated hours**: 2–4h (depends on root cause — likely video URL format issue)

**Manual test needed**:
- Open EditRoomScreen with at least one participant clip
- Tap clip to preview → video should play

---

## CATEGORY 3 — Can Wait

These are real issues but not blocking for launch or early beta.

---

### 3.1 No Staging Environment

**What's broken**: Every `git push` to `main` auto-deploys to production on Render. There is no way to test server changes without affecting real users.

**Files involved**:
- Render dashboard configuration (not a code file)

**Fix needed**: Create a second Render service pointing to a `staging` branch. Add a `STAGING_ACCESS_CODE` to gate staging traffic. Use the staging URL in local `.env` for development.

**Risk level**: 🟡 Medium — risk of breaking production on every commit

**Estimated hours**: 2h

**Manual test needed**: N/A — process change

---

### 3.2 No Analytics

**What's broken**: There is no tracking of user actions, funnel drop-off, feature usage, or errors. Without this, it's impossible to know which features are used and which cause confusion.

**Files involved**:
- None — needs to be added
- Best entry: `src/state/appState.js` (track screen transitions), `src/screens/FinalVideoScreen.js` (track share events)

**Fix needed**: Add Expo Analytics or Mixpanel/PostHog (free tier). Track: story created, music selected, format selected, share pressed, share succeeded.

**Risk level**: 🟡 Medium

**Estimated hours**: 4h

---

### 3.3 Community Feature Incomplete

**What's broken**: `CommunityFeedScreen` and `MemberOnboardingScreen` exist in the UI but the feature is incomplete. The `applications` Firestore collection exists but no approval workflow, notifications, or moderation UI are implemented.

**Files involved**:
- `src/screens/CommunityFeedScreen.js`
- `src/screens/MemberOnboardingScreen.js`
- Firestore `applications` collection

**Fix needed**: Either finish the community feature (approval workflow + notifications) or hide it from the UI entirely until ready. Half-finished features visible to users cause confusion.

**Risk level**: 🟡 Medium — UX confusion

**Estimated hours**: 16–24h to complete; or 1h to hide from UI

---

### 3.4 Suno Track Library Loaded on Every Story View

**What's broken**: The full `suno_tracks` collection is fetched from Firestore every time a story is viewed, even if the user already has the data from a previous session. This causes unnecessary Firestore reads.

**Files involved**:
- `server/music/suno-track-service.js` — track fetching
- `src/screens/MusicSelectionScreen.js` — Suno set display

**Fix needed**: Cache the Suno library in memory on the server (Map with TTL of 1 hour). On the client, use Zustand to persist the fetched sets between screens.

**Risk level**: 🟢 Low-Medium

**Estimated hours**: 2h

---

### 3.5 Deep Link URL Parsing Is Fragile

**What's broken**: App.js manually parses 6 different URL formats to route deep links. A single format change would break routing for all users arriving from WhatsApp.

**Files involved**:
- `App.js` — deep link handling block (~lines 72–148)

**Fix needed**: Consolidate URL parsing into a single `parseDeepLink(url)` utility function with unit tests. Consider using `expo-linking` URL parsing helpers.

**Risk level**: 🟢 Low (works now, but fragile)

**Estimated hours**: 3h

---

### 3.6 Legacy Environment Variable (`EXPO_PUBLIC_VIDEO_CONVERTER_URL`)

**What's broken**: `EXPO_PUBLIC_VIDEO_CONVERTER_URL` is marked as a legacy alias for `EXPO_PUBLIC_API_URL` but both are still referenced in code. Two variables pointing to the same server creates confusion.

**Files involved**:
- `.env`
- Multiple source files referencing both variable names

**Fix needed**: Audit all references, migrate everything to `EXPO_PUBLIC_API_URL`, remove the legacy variable.

**Risk level**: 🟢 Low

**Estimated hours**: 1h

---

### 3.7 MusicGen Progress Not Shown to User

**What's broken**: When MusicGen (Replicate) is generating music, the user sees no progress — just a generic spinner. Replicate jobs can take 30–90 seconds. Users may think the app is frozen.

**Files involved**:
- `src/screens/ProcessingScreen.js`
- `server/music/music-service.js` — Replicate polling loop
- `server/video-converter-api.js` — `/api/generate-music` endpoint

**Fix needed**: The server already has a music job status endpoint (`/api/music-status/:jobId`). The client should poll it and display a progress message like "Generating music... (15s remaining)".

**Risk level**: 🟢 Low

**Estimated hours**: 3h

---

## CATEGORY 4 — Do Not Touch Unless Necessary

These are areas where changes carry high risk relative to benefit. Leave them alone unless a specific bug forces intervention.

---

### 4.1 Custom Zustand Navigation System

**What it is**: The entire app uses a custom screen-switching system built on Zustand (`navigateTo`, `goBack`) instead of React Navigation.

**Why not to touch**: This system works. Migrating to React Navigation would require rewriting every screen, every navigation call, and every deep link handler. The risk of regression is extremely high. The payoff is small since the app is not a complex navigation tree.

**Touch only if**: You need nested navigators, shared element transitions, or tab navigation that this system cannot support.

**Files involved**: `App.js`, `src/state/appState.js`, `src/hooks/useNav.js`, every screen file

---

### 4.2 CubeWebView Recording Internals

**What it is**: The WebView-based 3D cube recording uses a complex two-triangle drawQuad system, title face canvas generation, iOS play() unlock hack, and MediaRecorder chunk assembly.

**Why not to touch**: This is the most delicate code in the app. Previous changes to it caused ghost corners in recordings, title face rendering failures, and iOS playback unlock bugs. Multiple sessions were spent fixing these issues.

**Touch only if**: There is a confirmed bug in the recording output (visible artifact, audio sync issue, crash).

**Files involved**: `src/components/cube3d/CubeWebView.js`

---

### 4.3 FFmpeg Filter Graph in Mixing Functions

**What it is**: `mixMusicWithVideoNoAudio()` and `mixRecordingAudioWithMusic()` in `mixing-service.js` use carefully tuned FFmpeg filter chains (`asetpts`, `aresample`, `amix`, `-r 30`, `-profile:v baseline`).

**Why not to touch**: Every change to the FFmpeg filter chain has caused regressions — either 7,610-byte empty containers, WhatsApp audio-only playback, or infinite loops. The current state represents 15+ commits of trial and error. Only change if the current fix (commit 3ed2dea) is confirmed broken.

**Touch only if**: Render logs show `📦 Mix output size:` < 10,000 bytes after testing the current fix.

**Files involved**: `server/music/mixing-service.js`

---

### 4.4 Web Record Template

**What it is**: `server/web-record-template.js` is a 800+ line inline HTML/JS string that serves the participant browser recording interface. It includes WebRTC setup, GCS direct upload, instruction audio playback, and clip management — all embedded in JavaScript template literals.

**Why not to touch**: This file works. It handles a complex flow (camera permissions, recording, upload, multi-clip management) in a single-file inline template. Changes are hard to test without real iOS Safari + WhatsApp context.

**Touch only if**: A confirmed bug in web recording is reported (upload failure, camera not starting, clip not saving to Firestore).

**Files involved**: `server/web-record-template.js`

---

### 4.5 Firebase Rules

**What they are**: Firestore security rules define who can read/write each collection.

**Why not to touch carelessly**: A wrong rule can lock out all users (too restrictive) or expose private data (too permissive). Current rules work for the existing flow.

**Exception**: Fix item 1.3 (creatorEmail exposure) does require a targeted rules change — but make it surgical and test with the Firestore Rules Playground before deploying.

**Touch only if**: Item 1.3 (creatorEmail), or a new feature requires new collection access patterns.

---

### 4.6 Render Auto-Deploy Configuration

**What it is**: Render is configured to auto-deploy on every push to `main`.

**Why not to touch**: Changing this could break the deployment pipeline. The current setup is simple and reliable.

**Instead**: Add a `staging` branch (Category 3, item 3.1) so that `main` pushes are tested before they go live, rather than disabling auto-deploy.

---

*This plan was generated from PROJECT_MAP.md automated audit — 2026-06-12.*
*Priority order: fix 1.1 and 1.2 together (they are the same flow), then 1.3 and 1.4 (security, before any public access), then 1.5 (Sentry), then Category 2 items in order.*
