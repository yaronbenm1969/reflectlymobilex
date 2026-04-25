/**
 * Web Recording Page Template
 * Allows participants to record video clips directly in the browser — no app required.
 * Uses Firebase JS SDK (CDN) to upload directly to Firebase Storage.
 */

function buildWebRecordHtml(story, firebaseConfig) {
  const {
    id: storyId,
    name: storyName,
    creatorName,
    clipCount,
    maxClipDuration,
    instructions,
  } = story;

  const APP_STORE_URL = 'https://apps.apple.com/app/reflectly/id0000000000'; // TODO: update after publish
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reflectly.app';

  const firebaseConfigJSON = JSON.stringify(firebaseConfig);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>צלם שיקוף — ${escHtml(storyName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --pink: #FF6B9D;
      --purple: #8B5CF6;
      --bg: #F5F0FA;
      --card: #ffffff;
      --text: #1a1a2e;
      --sub: #6b7280;
      --radius: 16px;
    }
    html, body { height: 100%; background: var(--bg); font-family: Arial, sans-serif; color: var(--text); }
    body { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100%; padding: 0; }

    /* Header */
    .header { width: 100%; background: linear-gradient(135deg, var(--pink), var(--purple)); padding: 20px 24px 16px; text-align: center; color: white; }
    .header h1 { font-size: 20px; font-weight: bold; }
    .header p { font-size: 13px; opacity: 0.85; margin-top: 4px; }

    /* Steps */
    .step { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 420px; padding: 24px 20px; }
    .step.active { display: flex; }

    .card { background: var(--card); border-radius: var(--radius); padding: 24px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 16px; }
    .card h2 { font-size: 19px; color: var(--text); margin-bottom: 8px; }
    .card p { font-size: 14px; color: var(--sub); line-height: 1.6; margin-bottom: 16px; }

    input[type="text"] {
      width: 100%; border: 2px solid #e5e7eb; border-radius: 10px;
      padding: 14px 16px; font-size: 16px; outline: none; background: #fafafa;
      transition: border-color 0.2s; margin-bottom: 16px; text-align: right;
    }
    input[type="text"]:focus { border-color: var(--pink); }

    button, a.btn {
      display: block; width: 100%; padding: 15px; border-radius: 12px;
      font-size: 16px; font-weight: bold; border: none; cursor: pointer;
      text-align: center; text-decoration: none; margin-bottom: 10px; transition: opacity 0.2s;
    }
    button:active, a.btn:active { opacity: 0.8; }
    .btn-primary { background: var(--pink); color: white; }
    .btn-secondary { background: #f0e6ff; color: var(--purple); }
    .btn-outline { background: white; color: var(--sub); border: 2px solid #e5e7eb; }
    .btn-ios { background: #000; color: white; }
    .btn-android { background: #3DDC84; color: #000; }
    button:disabled { opacity: 0.4; cursor: default; }

    /* Camera */
    .camera-wrap { position: relative; width: 100%; background: #000; border-radius: var(--radius); overflow: hidden; aspect-ratio: 9/16; margin-bottom: 16px; max-height: 55vh; }
    #preview, #review-video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .rec-badge { position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; border-radius: 20px; padding: 4px 12px; font-size: 13px; font-weight: bold; display: none; align-items: center; gap: 6px; }
    .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: white; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    .timer-badge { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: white; border-radius: 20px; padding: 4px 14px; font-size: 14px; font-weight: bold; }
    .countdown-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .countdown-num { color: white; font-size: 80px; font-weight: bold; animation: countpop 0.8s ease; }
    @keyframes countpop { 0%{transform:scale(1.4)} 100%{transform:scale(1)} }

    /* Clip indicator */
    .clip-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
    .clip-dot { width: 10px; height: 10px; border-radius: 50%; background: #e5e7eb; }
    .clip-dot.done { background: var(--pink); }
    .clip-dot.current { background: var(--pink); box-shadow: 0 0 0 3px rgba(255,107,157,0.3); }

    /* Progress */
    .progress-wrap { width: 100%; background: #e5e7eb; border-radius: 99px; height: 8px; overflow: hidden; margin: 12px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--pink), var(--purple)); border-radius: 99px; transition: width 0.3s; width: 0%; }

    /* Spinner */
    .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: var(--pink); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 24px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .emoji-big { font-size: 64px; text-align: center; margin: 16px 0; }
    .clip-label { font-size: 14px; color: var(--sub); text-align: center; margin-bottom: 8px; }
    .instructions-box { background: #fef9c3; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 14px; color: #78350f; line-height: 1.6; text-align: right; }
    .error-msg { color: #ef4444; font-size: 13px; text-align: center; margin: 8px 0; min-height: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎬 ${escHtml(storyName)}</h1>
    <p>${creatorName ? `הוזמנת על ידי ${escHtml(creatorName)}` : 'צלם את השיקוף שלך'}</p>
  </div>

  <!-- Step 1: Welcome + Name -->
  <div id="step-welcome" class="step active">
    <div class="card">
      <h2>ברוך הבא!</h2>
      <p>תצלם ${clipCount} קליפ${clipCount > 1 ? 'ים קצרים' : ' קצר'} ישירות מהדפדפן — ללא צורך בהתקנת אפליקציה.</p>
      ${instructions ? `<div class="instructions-box">📋 ${escHtml(instructions)}</div>` : ''}
      <input type="text" id="name-input" placeholder="השם שלך" maxlength="40" />
      <div class="error-msg" id="name-error"></div>
      <button class="btn-primary" onclick="handleNameContinue()">המשך ▸</button>
    </div>
  </div>

  <!-- Step 2: Camera permission -->
  <div id="step-camera" class="step">
    <div class="card" style="text-align:center">
      <div class="emoji-big">📷</div>
      <h2>אפשר גישה למצלמה</h2>
      <p>הדפדפן יבקש רשות לגשת למצלמה ולמיקרופון. לחץ "אפשר" כשתתבקש.</p>
      <div class="error-msg" id="cam-error"></div>
      <button class="btn-primary" id="cam-btn" onclick="initCamera()">פתח מצלמה</button>
    </div>
  </div>

  <!-- Step 3: Record -->
  <div id="step-record" class="step">
    <div class="clip-dots" id="clip-dots"></div>
    <p class="clip-label" id="clip-label">קליפ 1 מתוך ${clipCount}</p>
    <div class="camera-wrap">
      <video id="preview" autoplay muted playsinline></video>
      <div class="rec-badge" id="rec-badge"><div class="rec-dot"></div> מקליט</div>
      <div class="timer-badge" id="timer-badge" style="display:none">00:00</div>
      <div class="countdown-overlay" id="countdown-overlay" style="display:none">
        <div class="countdown-num" id="countdown-num">3</div>
      </div>
    </div>
    <button class="btn-primary" id="start-btn" onclick="startCountdown()">⏺ התחל הקלטה</button>
    <button class="btn-outline" id="stop-btn" style="display:none" onclick="stopRecording()">⏹ סיים הקלטה</button>
    <div class="error-msg" id="rec-error"></div>
  </div>

  <!-- Step 4: Review clip -->
  <div id="step-review" class="step">
    <p class="clip-label" id="review-label">תצוגה מקדימה</p>
    <div class="camera-wrap">
      <video id="review-video" controls playsinline></video>
    </div>
    <button class="btn-primary" onclick="confirmClip()">שמור קליפ זה ✓</button>
    <button class="btn-outline" onclick="reRecord()">צלם שוב ↩</button>
  </div>

  <!-- Step 5: Uploading -->
  <div id="step-upload" class="step">
    <div class="card" style="text-align:center">
      <div class="spinner"></div>
      <h2 id="upload-title">מעלה...</h2>
      <p id="upload-sub">קליפ <span id="upload-clip-num">1</span> מתוך ${clipCount}</p>
      <div class="progress-wrap"><div class="progress-fill" id="upload-progress"></div></div>
      <p id="upload-pct" style="font-size:13px;color:var(--sub);margin-top:4px">0%</p>
    </div>
  </div>

  <!-- Step 6: Done -->
  <div id="step-done" class="step">
    <div class="card" style="text-align:center">
      <div class="emoji-big">🎉</div>
      <h2>תודה!</h2>
      <p>השיקוף שלך הועלה בהצלחה.<br>הוא יופיע בסרטון הסופי של ${escHtml(creatorName || 'היוצר')}.</p>
    </div>
    <div class="card">
      <h2 style="margin-bottom:8px">רוצה לראות את התוצאה?</h2>
      <p>הורד את Reflectly וצפה בסרטון המוגמר:</p>
      <a class="btn btn-ios" href="${APP_STORE_URL}" target="_blank">📱 iPhone — App Store</a>
      <a class="btn btn-android" href="${PLAY_STORE_URL}" target="_blank">🤖 אנדרואיד — Google Play</a>
    </div>
  </div>

  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
    import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
    import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
    import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    // ── Firebase init ──────────────────────────────────────────
    const firebaseConfig = ${firebaseConfigJSON};
    const fbApp = initializeApp(firebaseConfig);
    const fbStorage = getStorage(fbApp);
    const fbDb = getFirestore(fbApp);
    const fbAuth = getAuth(fbApp);

    // ── Constants ──────────────────────────────────────────────
    const STORY_ID    = '${escJs(storyId)}';
    const CLIP_COUNT  = ${clipCount};
    const MAX_SEC     = ${maxClipDuration};
    const webUid      = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

    // ── State ──────────────────────────────────────────────────
    let participantName = '';
    let currentClipIdx  = 0;       // 0-based index of clip being recorded
    let recordedBlobs   = [];      // Array of Blobs, one per clip
    let stream          = null;
    let mediaRecorder   = null;
    let chunks          = [];
    let timerInterval   = null;
    let elapsedSec      = 0;

    // ── Step navigation ────────────────────────────────────────
    function showStep(id) {
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      document.getElementById('step-' + id).classList.add('active');
      window.scrollTo(0, 0);
    }

    // ── Step 1: Name ───────────────────────────────────────────
    window.handleNameContinue = function() {
      const val = document.getElementById('name-input').value.trim();
      if (!val) {
        document.getElementById('name-error').textContent = 'נא להזין שם';
        return;
      }
      participantName = val;
      document.getElementById('name-error').textContent = '';
      buildClipDots();
      showStep('camera');
    };

    // ── Step 2: Camera permission ──────────────────────────────
    window.initCamera = async function() {
      const btn = document.getElementById('cam-btn');
      btn.disabled = true;
      btn.textContent = 'פותח מצלמה...';
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        document.getElementById('preview').srcObject = stream;
        showStep('record');
        updateClipUI();
      } catch (e) {
        document.getElementById('cam-error').textContent = 'לא ניתן לגשת למצלמה: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'נסה שוב';
      }
    };

    // ── Clip dots ──────────────────────────────────────────────
    function buildClipDots() {
      const wrap = document.getElementById('clip-dots');
      wrap.innerHTML = '';
      for (let i = 0; i < CLIP_COUNT; i++) {
        const d = document.createElement('div');
        d.className = 'clip-dot';
        d.id = 'dot-' + i;
        wrap.appendChild(d);
      }
    }

    function updateClipUI() {
      document.getElementById('clip-label').textContent =
        'קליפ ' + (currentClipIdx + 1) + ' מתוך ' + CLIP_COUNT;
      for (let i = 0; i < CLIP_COUNT; i++) {
        const d = document.getElementById('dot-' + i);
        d.className = 'clip-dot' + (i < currentClipIdx ? ' done' : i === currentClipIdx ? ' current' : '');
      }
    }

    // ── Step 3: Countdown + Record ─────────────────────────────
    window.startCountdown = async function() {
      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('rec-error').textContent = '';
      const overlay = document.getElementById('countdown-overlay');
      const num     = document.getElementById('countdown-num');
      overlay.style.display = 'flex';
      for (let i = 3; i >= 1; i--) {
        num.textContent = i;
        await sleep(800);
      }
      overlay.style.display = 'none';
      startRecording();
    };

    function startRecording() {
      chunks = [];
      elapsedSec = 0;

      const mimeType = getSupportedMime();
      try {
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch(e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = onRecordingStopped;
      mediaRecorder.start(250);

      document.getElementById('rec-badge').style.display = 'flex';
      document.getElementById('timer-badge').style.display = 'block';
      document.getElementById('stop-btn').style.display = 'block';

      timerInterval = setInterval(() => {
        elapsedSec++;
        document.getElementById('timer-badge').textContent = formatTime(elapsedSec);
        if (elapsedSec >= MAX_SEC) stopRecording();
      }, 1000);
    }

    window.stopRecording = function() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    };

    function onRecordingStopped() {
      clearInterval(timerInterval);
      document.getElementById('rec-badge').style.display = 'none';
      document.getElementById('timer-badge').style.display = 'none';
      document.getElementById('stop-btn').style.display = 'none';

      const mimeType = mediaRecorder.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: mimeType });
      recordedBlobs[currentClipIdx] = blob;

      // Show review
      const url = URL.createObjectURL(blob);
      const vid  = document.getElementById('review-video');
      vid.src    = url;
      document.getElementById('review-label').textContent =
        'תצוגה מקדימה — קליפ ' + (currentClipIdx + 1);
      showStep('review');
    }

    window.confirmClip = function() {
      currentClipIdx++;
      if (currentClipIdx < CLIP_COUNT) {
        updateClipUI();
        showStep('record');
        // Reset record buttons
        document.getElementById('start-btn').style.display = 'block';
      } else {
        uploadAllClips();
      }
    };

    window.reRecord = function() {
      showStep('record');
      document.getElementById('start-btn').style.display = 'block';
    };

    // ── Step 5: Upload ─────────────────────────────────────────
    async function uploadAllClips() {
      showStep('upload');
      // Authenticate anonymously so Firebase Storage rules allow the upload
      try {
        if (!fbAuth.currentUser) await signInAnonymously(fbAuth);
      } catch (authErr) {
        console.warn('Anonymous auth failed:', authErr.message);
        // Continue anyway — rules might allow unauthenticated writes
      }
      for (let i = 0; i < recordedBlobs.length; i++) {
        document.getElementById('upload-clip-num').textContent = i + 1;
        document.getElementById('upload-progress').style.width = '0%';
        document.getElementById('upload-pct').textContent = '0%';

        const blob     = recordedBlobs[i];
        const ext      = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = 'stories/' + STORY_ID + '/players/' + webUid + '/video' + (i + 1) + '_' + Date.now() + '.' + ext;
        const storRef  = ref(fbStorage, filename);
        const task     = uploadBytesResumable(storRef, blob);

        await new Promise((resolve, reject) => {
          task.on('state_changed',
            snap => {
              const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
              document.getElementById('upload-progress').style.width = pct + '%';
              document.getElementById('upload-pct').textContent = pct + '%';
            },
            reject,
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              // Save reflection document (matches app format)
              await addDoc(collection(fbDb, 'reflections'), {
                storyId:         STORY_ID,
                videoUrl:        url,
                playerName:      participantName,
                participantName: participantName,
                uid:             webUid,
                clipNumber:      i + 1,
                source:          'web',
                createdAt:       serverTimestamp(),
              });
              resolve();
            }
          );
        });
      }
      stopStream();
      showStep('done');
    }

    // ── Helpers ────────────────────────────────────────────────
    function stopStream() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    }

    function getSupportedMime() {
      const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
      return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    }

    function formatTime(sec) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  </script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(str) {
  return String(str || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
}

module.exports = { buildWebRecordHtml };
