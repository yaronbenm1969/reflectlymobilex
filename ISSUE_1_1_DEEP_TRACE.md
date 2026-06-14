# ISSUE 1.1 — DEEP EXECUTION TRACE
> WhatsApp video share produces empty 7,610-byte MP4 container.
> Read-only audit. No code was modified. Date: 2026-06-12.

---

## Overview

The execution path spans two systems:

| Phase | System | Entry Point |
|-------|--------|-------------|
| 1 | Client (iOS app) | `convertAndUploadRecording()` — FinalVideoScreen.js |
| 2 | Server (Render) | `POST /api/mix-music-with-video` — video-converter-api.js |
| 3 | Server | `mixRecordingAudioWithMusic()` — mixing-service.js |
| 4 | Client | Receives `finalUrl` pointing to 7,610-byte file |

---

## PHASE 1 — Client: `convertAndUploadRecording()`

**File:** `src/screens/FinalVideoScreen.js`
**Function:** `convertAndUploadRecording(fileUri, meta = {})`
**Lines:** 878–1012 (iOS MP4 path)

### Step 1.1 — Upload raw recording to Firebase

```javascript
// Line 891
const uploadResult = await storageService.uploadVideo(
  fileUri,
  currentStoryId,
  'animated_export',
  (progress) => { ... }
);

// Line 898
let finalMp4Url = uploadResult.url;
// e.g. https://firebasestorage.googleapis.com/.../animated_export_<ts>.mp4
```

**Temp file on Firebase Storage:**
```
stories/{currentStoryId}/animated_export_{timestamp}.mp4
Size: ~671,720 bytes (the raw iOS VFR recording)
```

### Step 1.2 — Wait for music URL

```javascript
// Lines 907–926 — waits for generatedMusicUrlRef to be set
const musicUrl = generatedMusicUrlRef.current;
// e.g. https://firebasestorage.googleapis.com/.../ai_music_<ts>.m4a
// OR: null if music generation hasn't completed yet
```

### Step 1.3 — Decision: music vs no music

```javascript
// Line 932
if (musicUrl) {
  // → POST /api/mix-music-with-video
} else {
  // → POST /api/reencode-for-whatsapp
}
```

**⚠️ If `musicUrl` is null at this point — the mix is skipped entirely.**
**⚠️ If `musicUrl` exists — proceeds to the mixing path (the failure path).**

### Step 1.4 — POST to `/api/mix-music-with-video`

```javascript
// Lines 936–952
const mixCtrl = new AbortController();
const mixTimeout = setTimeout(() => mixCtrl.abort(), 4 * 60 * 1000); // 4-min timeout

const mixRes = await fetch(`${VIDEO_CONVERTER_URL}/api/mix-music-with-video`, {
  method: 'POST',
  headers: SERVER_HEADERS,
  body: JSON.stringify({
    videoUrl: finalMp4Url,   // Firebase URL of raw recording
    musicUrl,                // Firebase URL of Suno M4A music
    musicVolume: 0.06        // 6% music volume (hardcoded)
  }),
  signal: mixCtrl.signal,
});
clearTimeout(mixTimeout);

if (mixRes.ok) {
  const mixResult = await mixRes.json();
  const mixedUrl = mixResult.finalUrl || mixResult.videoUrl;
  if (mixedUrl) {
    finalMp4Url = mixedUrl;   // ← NOW POINTS TO 7,610-BYTE FILE
    console.log('✅ AI music mixed into recording');
  }
}
```

**Variables that can cause failure here:**
| Variable | Value | Risk |
|----------|-------|------|
| `finalMp4Url` | Firebase mp4 URL (valid, ~671KB) | ✅ OK |
| `musicUrl` | Suno M4A URL | ✅ OK |
| `musicVolume` | `0.06` (hardcoded) | ✅ OK |
| `replaceAudio` | NOT sent in body → defaults to `false` on server | ✅ OK |
| `clipUrls` | NOT sent → defaults to `undefined` on server | ✅ OK |

---

## PHASE 2 — Server: `POST /api/mix-music-with-video`

**File:** `server/video-converter-api.js`
**Lines:** 1955–2059

### Step 2.1 — Parse request body

```javascript
// Line 1956
const {
  videoUrl,
  musicUrl,
  musicVolume = 0.08,   // default 0.08, but client sends 0.06
  storyId,
  replaceAudio = false,  // ← false (client doesn't send this)
  clipUrls               // ← undefined (client doesn't send this)
} = req.body;
```

### Step 2.2 — Create temp directory and file paths

```javascript
// Lines 1963–1968
const jobDir = path.join(tempDir, `mix_${Date.now()}`);
fs.mkdirSync(jobDir, { recursive: true });

const videoPath = path.join(jobDir, 'video.mp4');   // downloaded video
const musicPath = path.join(jobDir, 'music.m4a');   // downloaded music
const outputPath = path.join(jobDir, 'final_with_music.mp4');  // FFmpeg output
```

**Temp files created:**
```
/tmp/reflectly-server/mix_{timestamp}/
  video.mp4             ← raw iOS recording (~671,720 bytes)
  music.m4a             ← Suno track (~864,688 bytes)
  final_with_music.mp4  ← FFmpeg output (BECOMES 7,610 bytes)
```

### Step 2.3 — Download files

```javascript
// Lines 1970–1983
await Promise.all([
  downloadFile(videoUrl, videoPath),
  downloadFile(musicUrl, musicPath),
]);
// No clipUrls → clipPaths stays empty []
```

### Step 2.4 — Validate download sizes

```javascript
// Lines 1989–1993
const videoSize = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
const musicSize = fs.existsSync(musicPath) ? fs.statSync(musicPath).size : 0;
console.log(`📦 Downloaded: video=${videoSize}b, music=${musicSize}b`);
if (videoSize < 1000) throw new Error(`Video download too small...`);
if (musicSize < 1000) throw new Error(`Music download too small...`);
```

**Observed from logs:** `video=671720b, music=864688b` — both pass ✅

### Step 2.5 — ffprobe #1: Probe video stream (diagnostic only)

```javascript
// Lines 1997–2004
execFile('ffprobe', [
  '-v', 'error',
  '-show_streams',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate',
  '-of', 'default=noprint_wrappers=1',
  videoPath
], (err, stdout) => {
  console.log(`🔍 Video stream: ${stdout?.trim() || err?.message || 'unknown'}`);
  resolve();
});
```

**Full ffprobe command:**
```bash
ffprobe -v error -show_streams -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 \
  /tmp/reflectly-server/mix_{ts}/video.mp4
```

**Observed output from logs:**
```
codec_name=h264
width=720
height=1280
pix_fmt=yuv420p
r_frame_rate=600/1        ← iOS VFR: 600Hz timebase
```

**⚠️ This is diagnostic only — result not used in any code decision.**
`r_frame_rate=600/1` is the timebase, not the true frame rate. iOS uses a 600Hz timebase.

### Step 2.6 — ffprobe #2: Check if video has audio

```javascript
// Lines 2011–2015
const hasAudio = !replaceAudio && await probeVideoHasAudio(videoPath);
console.log(`🔊 Video has audio: ${hasAudio}, replaceAudio: ${replaceAudio}`);
```

**`probeVideoHasAudio()` — Lines 1850–1860:**
```javascript
function probeVideoHasAudio(videoPath) {
  return new Promise(resolve => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ], (err, stdout) => resolve(!err && stdout.trim() === 'audio'));
  });
}
```

**Full ffprobe command:**
```bash
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_type \
  -of default=noprint_wrappers=1:nokey=1 \
  /tmp/reflectly-server/mix_{ts}/video.mp4
```

**Expected output:** `audio` (cube recording contains voice audio)
**Returns:** `true` — confirmed by log `🔊 Video has audio: true, replaceAudio: false`

### Step 2.7 — Decision: which mix function to call

```javascript
// Lines 2009–2022
if (clipPaths.length > 0) {
  // mixCubeWithVoicesAndMusic()  ← NOT taken (no clipUrls)
} else {
  if (hasAudio) {
    await mixRecordingAudioWithMusic(videoPath, musicPath, outputPath, musicVolume);
    // ↑ THIS PATH IS TAKEN
  } else {
    await mixMusicWithVideoNoAudio(videoPath, musicPath, outputPath, 0.9);
  }
}
```

**`clipPaths.length === 0` and `hasAudio === true` → calls `mixRecordingAudioWithMusic()`.**

---

## PHASE 3 — Server: `mixRecordingAudioWithMusic()`

**File:** `server/music/mixing-service.js`
**Function:** `mixRecordingAudioWithMusic(videoPath, musicPath, outputPath, musicVolume)`
**Lines:** 393–440

### Step 3.1 — ffprobe #3: Get video duration

```javascript
// Line 398
const videoDuration = await getVideoDuration(videoPath);
console.log(`🎬 Video duration: ${videoDuration}s`);
```

**`getVideoDuration()` — Lines 381–391:**
```javascript
async function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], { timeout: 10000 }, (err, stdout) => {
      const dur = parseFloat(stdout?.trim());
      resolve(isNaN(dur) ? null : dur);  // ← NULL if parse fails
    });
  });
}
```

**Full ffprobe command:**
```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 \
  /tmp/reflectly-server/mix_{ts}/video.mp4
```

**Expected output:** `35.420001` (duration in seconds)
**⚠️ Can return `null` if:**
- ffprobe times out (10s timeout)
- stdout is empty or `N/A`
- stdout cannot be parsed by `parseFloat()`
- iOS VFR container has no `duration` field in the format section

### 🔴 FAILURE POINT A — Duration becomes null

```javascript
// Line 408
...(videoDuration ? ['-t', String(videoDuration)] : [])
```

| `videoDuration` value | Result in FFmpeg args |
|----------------------|----------------------|
| `35.42` (float) | `-t 35.42` added → music limited to 35.42s |
| `null` | **Nothing added** → no `-t` flag → FFmpeg reads music indefinitely |
| `0` | **Nothing added** (falsy) → same as null |

**When `-t` is omitted:** FFmpeg processes the music stream until it ends or until the output is determined by the filter's `duration=first` flag.

### Step 3.2 — Build filter_complex

```javascript
// Lines 400–405
const filterComplex = [
  `[0:v]setpts=PTS-STARTPTS[vout]`,
  `[0:a]asetpts=PTS-STARTPTS[a0]`,
  `[1:a]aresample=44100,asetpts=PTS-STARTPTS,volume=${musicVolume}[m]`,
  `[a0][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
].join(';');
```

**Filter chain breakdown:**

| Filter | Input | Output | Purpose |
|--------|-------|--------|---------|
| `setpts=PTS-STARTPTS` | `[0:v]` video | `[vout]` | Normalize video PTS to start at 0 |
| `asetpts=PTS-STARTPTS` | `[0:a]` voice audio | `[a0]` | Normalize voice audio PTS |
| `aresample=44100,asetpts=PTS-STARTPTS,volume=0.06` | `[1:a]` music | `[m]` | Resample + normalize music PTS + set volume |
| `amix=inputs=2:duration=first:normalize=0` | `[a0]` + `[m]` | `[aout]` | Mix voice + music |

**`amix duration=first` behavior:**
- Output duration = duration of **first input** = `[a0]` (voice track from iOS recording)
- If `[a0]` has correct duration (e.g. 35.42s) → output is 35.42s ✅
- If `[a0]` has no frames / PTS problem → output duration = 0 → **empty audio** ⚠️

### 🔴 FAILURE POINT B — Voice audio PTS cannot be normalized

iOS VFR recording with `r_frame_rate=600/1`:
- Audio samples have PTS values in the range `0...35420` (600Hz timebase × 35.42s)
- `asetpts=PTS-STARTPTS` should subtract the first PTS from all, giving a 0-based stream
- **BUT**: If the first audio packet's DTS/PTS is not available (common with iOS WebView recordings), `PTS-STARTPTS` evaluates to 0-0 = 0 for all packets → all packets have same timestamp → amix sees zero-duration stream

### 🔴 FAILURE POINT C — amix with duration=first on misaligned stream

With an empty or zero-duration `[a0]`:
- `amix duration=first` terminates immediately (first input appears to have 0 duration)
- Output audio stream has 0 frames
- FFmpeg writes an MP4 with valid video track but empty audio
- File size: ~7,610 bytes (MP4 container overhead only)

### Step 3.3 — Build FFmpeg args

```javascript
// Lines 406–425
const args = [
  '-i', videoPath,                            // Input 0: video.mp4
  ...(videoDuration ? ['-t', String(videoDuration)] : []),  // -t ONLY if duration not null
  '-i', musicPath,                            // Input 1: music.m4a
  '-filter_complex', filterComplex,
  '-map', '[vout]',                           // Video from filter
  '-map', '[aout]',                           // Audio from filter
  '-c:v', 'libx264',                          // Re-encode video
  '-preset', 'veryfast',
  '-profile:v', 'baseline',                  // WhatsApp-compatible profile
  '-pix_fmt', 'yuv420p',                      // WhatsApp-compatible pixel format
  '-bf', '0',                                 // No B-frames (WhatsApp compat)
  '-r', '30',                                 // Force 30fps (VFR → CFR)
  '-c:a', 'aac',                              // Re-encode audio
  '-b:a', '192k',
  '-ar', '44100',
  '-ac', '2',
  '-movflags', '+faststart',
  '-y', outputPath
];
```

**Full FFmpeg command (when videoDuration = 35.42):**
```bash
ffmpeg \
  -i /tmp/reflectly-server/mix_{ts}/video.mp4 \
  -t 35.42 \
  -i /tmp/reflectly-server/mix_{ts}/music.m4a \
  -filter_complex "[0:v]setpts=PTS-STARTPTS[vout];[0:a]asetpts=PTS-STARTPTS[a0];[1:a]aresample=44100,asetpts=PTS-STARTPTS,volume=0.06[m];[a0][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]" \
  -map [vout] -map [aout] \
  -c:v libx264 -preset veryfast -profile:v baseline -pix_fmt yuv420p -bf 0 -r 30 \
  -c:a aac -b:a 192k -ar 44100 -ac 2 \
  -movflags +faststart \
  -y /tmp/reflectly-server/mix_{ts}/final_with_music.mp4
```

**Full FFmpeg command (when videoDuration = null — the broken path):**
```bash
ffmpeg \
  -i /tmp/reflectly-server/mix_{ts}/video.mp4 \
  -i /tmp/reflectly-server/mix_{ts}/music.m4a \
  -filter_complex "[0:v]setpts=PTS-STARTPTS[vout];[0:a]asetpts=PTS-STARTPTS[a0];[1:a]aresample=44100,asetpts=PTS-STARTPTS,volume=0.06[m];[a0][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]" \
  -map [vout] -map [aout] \
  -c:v libx264 -preset veryfast -profile:v baseline -pix_fmt yuv420p -bf 0 -r 30 \
  -c:a aac -b:a 192k -ar 44100 -ac 2 \
  -movflags +faststart \
  -y /tmp/reflectly-server/mix_{ts}/final_with_music.mp4
```

**Difference:** no `-t 35.42` on music input.

### Step 3.4 — Execute FFmpeg

```javascript
// Lines 427–438
return new Promise((resolve, reject) => {
  execFile('ffmpeg', args, { timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ mixRecordingAudioWithMusic failed:', err.message);
      console.error('FFmpeg stderr:', stderr?.substring(0, 500));
      reject(err);
    } else {
      const outSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
      console.log(`📦 Mix output size: ${outSize} bytes`);
      console.log('✅ Recording audio + music mixed (fast, lip-sync preserved):', outputPath);
      resolve(outputPath);  // ← RESOLVES EVEN IF outSize = 7610
    }
  });
});
```

### Step 3.5 — Output file size check (inside mixing function)

```javascript
// Line 433
const outSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
console.log(`📦 Mix output size: ${outSize} bytes`);
```

**⚠️ This check ONLY logs. It does NOT reject or throw if size < threshold.**

**Output file created:**
```
/tmp/reflectly-server/mix_{ts}/final_with_music.mp4
Observed size: 7,610 bytes
Expected size: ~500,000–2,000,000 bytes
```

**The function resolves successfully to `outputPath` regardless of file size.**

---

## PHASE 4 — Back to Server endpoint: Upload & Respond

**File:** `server/video-converter-api.js`
**Lines:** 2024–2058

### Step 4.1 — Output file size check (in endpoint)

```javascript
// Lines 2024–2025
const mixedSizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
console.log(`📦 Mixed output size: ${mixedSizeBytes} bytes (${(mixedSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
```

**⚠️ This check also ONLY logs. No validation, no error thrown.**

### Step 4.2 — ffprobe #4: Probe output stream (diagnostic only)

```javascript
// Lines 2027–2034
execFile('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,profile,pix_fmt,r_frame_rate,width,height',
  '-of', 'csv=p=0',
  outputPath
], { timeout: 10000 }, (err, stdout) => {
  console.log(`🎬 Output video stream: ${stdout?.trim() || err?.message || 'none'}`);
  resolve();
});
```

**Full ffprobe command:**
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,pix_fmt,r_frame_rate,width,height \
  -of csv=p=0 \
  /tmp/reflectly-server/mix_{ts}/final_with_music.mp4
```

**⚠️ This is also diagnostic only — result not used in any code decision.**
**Even if this confirms 0 frames, the upload proceeds.**

### Step 4.3 — Upload 7,610-byte file to Firebase

```javascript
// Lines 2036–2043
if (bucket) {
  const storagePath = `edited/${storyId || 'unknown'}/final_music_${Date.now()}.mp4`;
  console.log(`☁️ Uploading mixed video to Firebase: ${storagePath}`);
  finalUrl = await uploadToFirebase(outputPath, storagePath);
  console.log(`✅ Mixed video uploaded: ${finalUrl?.substring(0, 80)}`);
}
```

**File uploaded to Firebase Storage:**
```
edited/unknown/final_music_{timestamp}.mp4
Size: 7,610 bytes (empty container)
```

### Step 4.4 — Cleanup temp directory

```javascript
// Line 2051
fs.rmSync(jobDir, { recursive: true, force: true });
```

**Temp directory deleted:**
```
/tmp/reflectly-server/mix_{ts}/  ← REMOVED
  video.mp4   ← deleted
  music.m4a   ← deleted
  final_with_music.mp4  ← deleted (but already uploaded to Firebase)
```

### Step 4.5 — Return success to client

```javascript
// Line 2053
res.json({ success: true, finalUrl, videoUrl: finalUrl });
```

**Client receives:** `{ success: true, finalUrl: "https://firebasestorage.googleapis.com/.../final_music_{ts}.mp4" }`

---

## PHASE 5 — Client Receives Corrupted URL

**File:** `src/screens/FinalVideoScreen.js`

### Step 5.1 — Client stores the URL

```javascript
// Lines 945–951
if (mixRes.ok) {
  const mixResult = await mixRes.json();
  const mixedUrl = mixResult.finalUrl || mixResult.videoUrl;
  if (mixedUrl) {
    finalMp4Url = mixedUrl;   // ← points to 7,610-byte file
    console.log('✅ AI music mixed into recording');  // ← NO validation
  }
}
```

### Step 5.2 — Client caches file locally (lines 997–1007)

```javascript
// Lines 997–1007
try {
  const mp4LocalPath = FileSystem.cacheDirectory + `recording_mp4_${Date.now()}.mp4`;
  const dlResult = await FileSystem.downloadAsync(finalMp4Url, mp4LocalPath);
  if (dlResult.status === 200) {
    console.log('📹 Final mp4 cached locally (iOS path):', mp4LocalPath);
    setCachedRecordingUri(mp4LocalPath);
    cachedRecordingRef.current = mp4LocalPath;
  }
} catch (dlErr) { ... }
```

**Local file:** `{cacheDirectory}/recording_mp4_{ts}.mp4` — **7,610 bytes**

### Step 5.3 — Share pressed: `getVideoForSharing()`

```javascript
// Line 1214
const MIN_VALID_SIZE = 50000;  // 50 KB

// Line 1226: Check cached file
if (isMp4(cached) && await isValidLocal(cached)) { ... }
// → cached = 7,610 bytes < 50,000 → FAILS

// Line 1230: Download from Firebase
const localPath = await downloadVideoToLocal(fbUrl, 'share_mp4', 120000);
if (await isValidLocal(localPath)) { ... }
// → downloaded = 7,610 bytes < 50,000 → FAILS

// Line 1297: Try Firestore URL
const firestoreUrl = firestoreVideoUrlRef.current;
// → same URL → same 7,610 bytes → FAILS

// Line 1342: Falls to server render
console.log('📹 Falling back to server-side render');
return await renderConcatenatedVideo(label);
// → PUPPETEER NOT AVAILABLE → SPINNER FOREVER (Issue 1.2)
```

---

## COMPLETE MAP OF ALL COMMANDS

### All ffprobe Commands (in order)

| # | Command | File | Lines | Purpose | Output Used? |
|---|---------|------|-------|---------|-------------|
| 1 | `ffprobe -show_streams -select_streams v:0 video.mp4` | video-converter-api.js | 1997–2004 | Diagnostic — log video info | ❌ No |
| 2 | `ffprobe -select_streams a:0 -show_entries stream=codec_type video.mp4` | video-converter-api.js | 1851–1860 | Detect if audio exists | ✅ Yes → routes to `mixRecordingAudioWithMusic` |
| 3 | `ffprobe -show_entries format=duration video.mp4` | mixing-service.js | 381–391 | Get video duration for `-t` flag | ✅ Yes → **CAN RETURN NULL** |
| 4 | `ffprobe -select_streams v:0 -show_entries stream=... final_with_music.mp4` | video-converter-api.js | 2027–2034 | Diagnostic — log output info | ❌ No |

### All FFmpeg Commands

| # | Command | File | Lines | Output | Size Check? |
|---|---------|------|-------|--------|------------|
| 1 | Full mix command (see Phase 3, Step 3.4) | mixing-service.js | 427 | `final_with_music.mp4` | ⚠️ Logged only, not validated |

### All Temp Files Created

| File | Path | Size | Deleted? |
|------|------|------|---------|
| Raw recording on Firebase | `stories/{id}/animated_export_{ts}.mp4` | ~671,720 bytes | ❌ Kept (source) |
| Music on Firebase | `music/{id}/ai_music_{ts}.m4a` | ~864,688 bytes | ❌ Kept (source) |
| Job directory | `/tmp/reflectly-server/mix_{ts}/` | N/A | ✅ After upload |
| Downloaded video | `/tmp/reflectly-server/mix_{ts}/video.mp4` | ~671,720 bytes | ✅ After upload |
| Downloaded music | `/tmp/reflectly-server/mix_{ts}/music.m4a` | ~864,688 bytes | ✅ After upload |
| FFmpeg output | `/tmp/reflectly-server/mix_{ts}/final_with_music.mp4` | **7,610 bytes** | ✅ After upload |
| Mixed file on Firebase | `edited/unknown/final_music_{ts}.mp4` | **7,610 bytes** | ❌ Kept (the broken file) |
| Client local cache | `{cacheDir}/recording_mp4_{ts}.mp4` | **7,610 bytes** | ❌ Kept on device |

### All Output File Size Checks

| Location | File | Lines | Action on Small File |
|----------|------|-------|---------------------|
| Mixing function — after FFmpeg | mixing-service.js | 433 | **Log only — no validation** |
| Endpoint — after mix function returns | video-converter-api.js | 2024–2025 | **Log only — no validation** |
| Client — `isValidLocal()` | FinalVideoScreen.js | 1216–1224 | Returns false → tries next fallback |

---

## WHERE THE FILE BECOMES 7,610 BYTES

Every possible path that produces 7,610 bytes traces back to one root: **FFmpeg `amix` produces 0 audio frames**, resulting in an MP4 container with valid video but empty audio.

### Root Cause A — `videoDuration` is null

```
getVideoDuration() → ffprobe returns null/NaN
  → videoDuration = null
  → no -t flag on music input
  → amix has no bounded duration reference
  → with duration=first: output = duration of [a0]
  → if [a0] PTS is malformed → output = 0 frames
  → 7,610 bytes
```

### Root Cause B — Audio PTS normalization fails

```
iOS VFR video with 600/1 timebase
  → audio PTS values are multiples of 600
  → asetpts=PTS-STARTPTS: if first PTS not detected, all PTS collapse to 0
  → amix sees all samples at t=0 (zero duration stream)
  → duration=first: stream appears to have 0 duration
  → amix outputs 0 frames
  → 7,610 bytes
```

### Root Cause C — Both A and B simultaneously

The most likely scenario: ffprobe CAN read the duration (so `-t` is added), but audio PTS normalization still fails due to VFR, producing the empty container regardless.

---

## CRITICAL OBSERVATION: THE SIZE CHECK WAS REMOVED

**Commit `c475320`** removed the server-side size check. Previous behavior would have returned HTTP 500 if the output was too small. Current behavior silently uploads the 7,610-byte file.

| Version | Behavior when output < 10,000 bytes |
|---------|-------------------------------------|
| Before c475320 | `throw new Error(...)` → HTTP 500 → client uses fallback |
| After c475320 (current) | Logs size, uploads anyway → HTTP 200 → client receives broken URL |

The comment in the commit message: "fix: remove size check that returned HTTP 500 and broke client flow" — the intent was to prevent the client from crashing. The consequence was making the failure silent and invisible.

---

## WHAT NEEDS TO HAPPEN TO FIX THIS

The trace reveals **three independent places** where this could be caught or prevented:

1. **In `getVideoDuration()`** — if null, log a warning and use an alternative: run ffprobe with `-show_entries stream=duration` (stream-level, not format-level) as fallback
2. **In `mixRecordingAudioWithMusic()`** — validate `outSize` before resolving; if < 10,000 bytes, `reject()` with a meaningful error and include the FFmpeg `stderr` in the rejection message
3. **In the endpoint** — validate `mixedSizeBytes` before uploading; return HTTP 422 (not 500) so the client knows the mix failed but the overall request was processed correctly

---

*Deep trace completed 2026-06-12. Read-only — no code was modified.*
