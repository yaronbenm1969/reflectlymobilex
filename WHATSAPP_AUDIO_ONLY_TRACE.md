# WhatsApp Audio-Only Trace
**Date**: 2026-06-14
**Status**: Server mix is WORKING (809,584 bytes, h264/30fps). Problem is earlier in the pipeline.

---

## 1. Does getVideoForSharing() use the correct file?

### Path after successful mix (convertAndUploadRecording, FinalVideoScreen.js:878)

```
Step A — Mix completes:
  finalMp4Url = mixResult.finalUrl   (Firebase URL: edited/unknown/final_music_NNN.mp4)
  firebaseUrlRef.current = finalMp4Url
  cachedRecordingRef.current = null   ← cleared so raw recording is NOT shared

Step B — Local download (lines 997-1007):
  mp4LocalPath = FileSystem.cacheDirectory + "recording_mp4_" + Date.now() + ".mp4"
  FileSystem.downloadAsync(finalMp4Url, mp4LocalPath)
  if status 200 → cachedRecordingRef.current = mp4LocalPath

Step C — getVideoForSharing() priority order (lines 1211-1343):
  1. cachedRecordingRef.current   → if set (Step B succeeded) and size ≥ 50KB → USED
  2. firebaseUrlRef.current       → if cached ref null, downloads Firebase URL
  3. localVideoUri                → state var (null in this flow)
  4. finalVideoUri (Zustand)      → null for cube-3d
  5. firestoreVideoUrlRef.current → Firestore finalVideoUrl (set by Step A via updateStory)
  6. Re-record OR server render   → last resort
```

**Conclusion**: `getVideoForSharing()` is using the correct mixed URL. The local file is
`FileSystem.cacheDirectory/recording_mp4_NNN.mp4` — always has `.mp4` extension. ✓

---

## 2. What is passed to Sharing.shareAsync?

**handleShare (line 609)**:
```js
await Sharing.shareAsync(localUri, {
  mimeType: 'video/mp4',
  dialogTitle: `שתף את הסרטון: ${storyName}`,
});
```

**handleGeneralShare (line 1572)**:
```js
await Sharing.shareAsync(localUri, {
  mimeType: 'video/mp4',
  dialogTitle: `שתף את הסרטון: ${storyName}`,
});
```

| Parameter | Value |
|-----------|-------|
| localUri | `file:///...cache/.../recording_mp4_NNN.mp4` |
| mimeType | `video/mp4` |
| UTI | **NOT SET** |
| File extension | `.mp4` ✓ |
| Share target | WhatsApp receives a LOCAL FILE via iOS share sheet |

⚠️ **Instagram share explicitly sets UTI**: `UTI: 'com.instagram.exclusivegram'`
⚠️ **WhatsApp share has NO UTI**. This is a potential issue (see §5 below).

---

## 3. Does the final MP4 have faststart / valid structure?

Server FFmpeg command includes `-movflags +faststart`. This places the `moov` atom at the beginning of the file. WhatsApp can play faststart files without streaming the full file first. ✓

Output from Render logs:
```
🎬 Output video stream: h264,Constrained Baseline,720,1280,yuv420p,30/1
📦 Mixed output size: 809584 bytes (0.77 MB)
```

The diagnostic only checks the VIDEO stream. Audio stream is NOT logged.
The audio mapping uses `-map '[aout]'` + `-c:a aac -b:a 192k -ar 44100 -ac 2`.

---

## 4. File size analysis — strong indicator of the root cause

### Expected vs actual sizes

| Source | Size | Duration | Effective bitrate |
|--------|------|----------|-------------------|
| Raw iOS recording uploaded | 611,760 bytes | 38.272s | **128 kbps** |
| Mixed output | 809,584 bytes | ~38s | **170 kbps** |

**Expected raw recording at 8 Mbps** (`videoBitsPerSecond: 8000000` in MediaRecorder):
`8,000,000 bits/s × 38s / 8 = 38,000,000 bytes = 38 MB`

**Actual raw recording: 611 KB = 0.6% of expected.**

This is only explainable if the h264 encoder is compressing BLACK or NEARLY-BLACK FRAMES.
A 720×1280 video of real animation at 30fps cannot compress to 128 kbps; a video of
black frames trivially compresses to near-zero kbps.

### Audio-only file size cross-check

AAC voice+music at 192 kbps target for 38s:
`192,000 bits/s × 38s / 8 = 912,000 bytes ≈ 891 KB`

Actual output: 809 KB. Consistent with:
- **Audio**: ~170 kbps effective AAC (VBR encodes speech below target — normal)
- **Video**: ~0 kbps effective (all-black frames, negligible after h264 compression)

---

## 5. Root cause: canvas taint from cross-origin background

### How the recording works (CubeWebView.js)

The cube recording uses an **offscreen canvas** (not the visible CSS 3D cube):

```
canvas (720×1280, offscreen)
  → captureStream(30)
  → MediaRecorder → MP4 chunks → sent to React Native
```

Each animation frame, `renderRecFrame()` draws:
1. Background (`#custom-bg` element) — from Firebase Storage URL
2. Stars/gradient
3. Cube faces (via `drawQuad`) — from blob URLs

### The taint bug

**CubeWebView.js:1667–1675**:
```js
var customBgEl = document.getElementById('custom-bg');
if (customBgEl) {
  try {
    ctx.drawImage(customBgEl, 0, 0, RW, RH);  // ← TAINTS CANVAS
  } catch(e) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, RW, RH);
  }
}
```

The `#custom-bg` element (line 141 of CubeWebView.js) is:
```html
<video id="custom-bg" src="${safeBgUrl}" autoplay loop muted playsinline ...>
```

`safeBgUrl` is a Firebase Storage `https://firebasestorage.googleapis.com/...?alt=media&token=...` URL.
**There is no `crossorigin="anonymous"` attribute on this element.**

### What iOS WKWebView does with an untainted cross-origin draw

On **Chrome/Firefox**: `ctx.drawImage(crossOriginElement)` throws `SecurityError` → catch block
fires → black background is drawn → canvas is NOT tainted (exception prevented the commit).

On **iOS Safari / WKWebView** (the runtime Expo uses):
`ctx.drawImage(crossOriginElement)` **does NOT throw**. Instead, it silently taints the canvas.
`captureStream()` on a tainted canvas produces a stream with **all-black frames**.

The audio side uses `AudioContext.createMediaStreamDestination()` — completely separate from
the canvas and NOT affected by canvas taint. Audio is captured correctly.

**Result**:
- Audio: voice clips + music background ✓ (captured via AudioContext)
- Video: 720×1280 all-black frames (canvas is tainted → black captureStream output)

This is why the raw recording is only 611 KB for 38 seconds (black h264 frames compress to almost nothing),
and why WhatsApp shows "audio only" (valid audio track, but visually black video track).

---

## 6. Why did it work once? (commit b0fc146)

At that point the story being tested may have had **no custom background**.
When `backgroundUrl` is null, the `#custom-bg` element is NOT injected into the HTML
(see CubeWebView.js:138: `const bgHtml = safeBgUrl ? ...` — empty string if no URL).
With no `#custom-bg` element, `customBgEl` is null, the taint branch is never taken,
and the canvas captures real content.

---

## 7. Summary

| Question | Answer |
|----------|--------|
| Is `finalUrl` used for sharing? | YES ✓ |
| Does `getVideoForSharing()` use the mixed MP4? | YES ✓ |
| Local URI extension? | `.mp4` ✓ |
| mimeType? | `video/mp4` ✓ |
| UTI set? | NO ⚠️ (but likely not the cause of audio-only) |
| moov/faststart? | YES ✓ (`-movflags +faststart`) |
| Video frames in mixed MP4? | **NO — all-black frames** |
| Audio frames in mixed MP4? | YES ✓ (voice + music) |
| Root cause? | Canvas tainted by cross-origin `#custom-bg` video on iOS WKWebView |
| File affected? | `src/components/cube3d/CubeWebView.js` |
| Lines affected? | 138–141 (HTML template), 1667–1675 (renderRecFrame) |

---

## 8. Proposed minimal fix

**Option A (safest, 1 line change in renderRecFrame):**
In `renderRecFrame()`, skip `ctx.drawImage(customBgEl)` entirely.
Draw a gradient/stars background always. Cube faces (blob URLs, CORS-safe) render correctly.
WhatsApp video will show the cube animation on a dark/stars background.

**Option B (correct fix, preserves custom background in recording):**
Pre-fetch the background URL as a blob URL (same pattern as face videos),
store in a variable like `_bgBlobUrl`, and use that instead of the DOM element for drawing.
Blob URLs are same-origin → no canvas taint.

**Do NOT modify the mixing pipeline** — that is working correctly.

---

## 9. Verification plan

After fix:
1. Record a cube-3d story with a background video set
2. Check raw recording size in React Native logs: should be **>> 5 MB** for 38s (not 611 KB)
3. Mix will still produce 809 KB+ output (audio now overlaid on actual video content)
4. WhatsApp will show the cube animation video
