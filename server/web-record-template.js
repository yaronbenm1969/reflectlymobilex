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
    videoUri,
    instructionAudioUrl,
    musicUrl,
    musicTrackId,
    hasMusic,
    musicName,
    lockedSet,
  } = story;

  const musicPanelHtml = hasMusic ? `
    <div class="music-panel" id="music-panel">
      <div class="music-panel-header">
        <span>&#127925;</span>
        <span class="music-panel-name">${escHtml(musicName || 'מוזיקה')}</span>
        <button class="music-preview-btn" id="preview-btn" onclick="toggleMusicPreview()">&#9654;</button>
      </div>
      <div class="music-mode-btns">
        <button class="music-mode-btn" id="btn-performance" onclick="setMusicMode('performance')">&#127908; שיר עם מוזיקה</button>
        <button class="music-mode-btn active" id="btn-none" onclick="setMusicMode('none')">&#128263; ללא מוזיקה</button>
      </div>
    </div>` : '';

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

    /* Music mode panel */
    .music-panel { background: #f9f3ff; border-radius: 14px; border: 1.5px solid #c8a8f0; margin-bottom: 12px; width: 100%; overflow: hidden; padding: 10px 14px; }
    .music-panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .music-panel-name { flex: 1; font-size: 13px; font-weight: 700; color: #6a1b9a; }
    .music-preview-btn { width: 30px; height: 30px; border-radius: 50%; border: none; background: #8446b010; color: #8446b0; font-size: 14px; cursor: pointer; flex-shrink: 0; }
    .music-preview-btn.playing { background: #8446b0; color: #fff; }
    .music-mode-btns { display: flex; gap: 8px; }
    .music-mode-btn { flex: 1; padding: 9px 6px; border-radius: 10px; border: 1.5px solid #c8a8f0; background: #fff; font-size: 13px; font-weight: 600; color: #6a1b9a; cursor: pointer; text-align: center; }
    .music-mode-btn.active { background: #8446b0; color: #fff; border-color: #8446b0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎬 ${escHtml(storyName)}</h1>
    <p>${creatorName ? `הוזמנת על ידי ${escHtml(creatorName)}` : 'צלם את השיקוף שלך'}</p>
  </div>

  <!-- Step 0: Creator Instructions (video / audio / text) — shown first when any content exists -->
  <div id="step-watch" class="step${(videoUri || instructionAudioUrl || instructions) ? ' active' : ''}">
    <div style="width:100%; max-width:420px; padding:16px;">
      <div style="background:linear-gradient(135deg,#f3e5ff,#e8eaff); border-radius:14px; padding:14px 16px; margin-bottom:14px; border:1.5px solid #c8a8f0;">
        <p style="font-size:13px; font-weight:700; color:#6a1b9a; margin:0 0 6px;">📋 הוראות מהיוצר</p>
        <p style="font-size:14px; color:#444; line-height:1.6; margin:0;">${escHtml(instructions || (videoUri ? 'צפה בסרטון לפני ההקלטה' : 'קרא את ההוראות לפני ההקלטה'))}</p>
      </div>
      ${videoUri ? `
      <div style="position:relative; width:100%; background:#000; border-radius:14px; overflow:hidden; margin-bottom:14px;">
        <video id="creator-video" src="${escHtml(videoUri)}" playsinline controls preload="metadata" style="width:100%; display:block; max-height:52vh; object-fit:contain;"></video>
      </div>
      ` : ''}
      ${instructionAudioUrl ? `
      <div style="background:#fff; border-radius:14px; padding:16px; margin-bottom:14px; border:1.5px solid #c8a8f0; display:flex; align-items:center; gap:12px;">
        <button id="audio-play-btn" onclick="toggleInstructionAudio()" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#8446b0,#464fb0);color:#fff;border:none;font-size:22px;cursor:pointer;flex-shrink:0;">▶</button>
        <div style="flex:1;">
          <p style="font-size:13px;font-weight:700;color:#6a1b9a;margin:0 0 2px;">הוראות קוליות</p>
          <p style="font-size:12px;color:#888;margin:0;">לחץ להשמעה</p>
        </div>
      </div>
      ` : ''}
      <button id="watch-continue-btn" class="btn-primary" onclick="watchContinue()"${(videoUri || instructionAudioUrl) ? ' disabled' : ''}>
        ${videoUri ? '▶ צפה בסרטון כדי להמשיך' : instructionAudioUrl ? '🔊 האזן להוראות כדי להמשיך' : '✓ הבנתי — המשך להקלטה'}
      </button>
      ${(videoUri || instructionAudioUrl) ? `<p id="watch-hint" style="font-size:13px;color:#888;text-align:center;margin-top:8px;">${videoUri ? 'הלחצן יופעל אחרי שתצפה בסרטון' : 'הלחצן יופעל אחרי שתאזין להוראות'}</p>` : ''}
    </div>
  </div>

  <!-- Step 1: Welcome + Name -->
  <div id="step-welcome" class="step${(videoUri || instructionAudioUrl || instructions) ? '' : ' active'}">
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
    ${musicPanelHtml}
    <div class="camera-wrap">
      <video id="preview" autoplay muted playsinline></video>
      <div class="rec-badge" id="rec-badge"><div class="rec-dot"></div> מקליט</div>
      <div class="timer-badge" id="timer-badge" style="display:none">00:00</div>
      <div class="countdown-overlay" id="countdown-overlay" style="display:none">
        <div class="countdown-num" id="countdown-num">3</div>
      </div>
    </div>
    <button class="btn-primary" id="start-btn" onclick="handleStartBtn()">⏺ התחל הקלטה</button>
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
    // Uploads go through the server endpoint (/api/upload-player-clip) —
    // no Firebase client SDK needed (server uses Admin SDK, bypasses Storage rules)

    // ── Constants ──────────────────────────────────────────────
    const STORY_ID    = '${escJs(storyId)}';
    const CLIP_COUNT  = ${clipCount};
    const MAX_SEC     = ${maxClipDuration};
    const VIDEO_URI        = ${videoUri ? `'${escJs(videoUri)}'` : 'null'};
    const INSTRUCTION_AUDIO = ${instructionAudioUrl ? `'${escJs(instructionAudioUrl)}'` : 'null'};
    const webUid      = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

    // ── Creator Instructions Watch Step ─────────────────────────
    window.watchContinue = function() { showStep('welcome'); };

    const watchBtn    = document.getElementById('watch-continue-btn');
    const watchHintEl = document.getElementById('watch-hint');
    function unlockWatchBtn(label) {
      if (watchBtn) { watchBtn.disabled = false; watchBtn.textContent = label || '✓ ראיתי — המשך להקלטה'; }
      if (watchHintEl) watchHintEl.style.display = 'none';
    }

    if (VIDEO_URI) {
      const creatorVideo = document.getElementById('creator-video');
      if (creatorVideo) {
        creatorVideo.addEventListener('ended', () => unlockWatchBtn('✓ ראיתי — המשך להקלטה'));
        creatorVideo.addEventListener('timeupdate', function() {
          if (creatorVideo.currentTime > 15) unlockWatchBtn('✓ ראיתי — המשך להקלטה');
        });
        creatorVideo.addEventListener('error', () => unlockWatchBtn('✓ המשך להקלטה'));
      }
    }

    // ── Audio instructions ───────────────────────────────────────
    let instrAudio = null;
    let instrAudioPlayed = false;
    window.toggleInstructionAudio = function() {
      const btn = document.getElementById('audio-play-btn');
      if (!INSTRUCTION_AUDIO) return;
      if (instrAudio && !instrAudio.paused) {
        instrAudio.pause();
        if (btn) btn.textContent = '▶';
        return;
      }
      if (!instrAudio) {
        instrAudio = new Audio(INSTRUCTION_AUDIO);
        instrAudio.addEventListener('ended', () => {
          if (btn) btn.textContent = '↩';
          if (!instrAudioPlayed) {
            instrAudioPlayed = true;
            unlockWatchBtn('✓ שמעתי — המשך להקלטה');
          }
        });
        instrAudio.addEventListener('timeupdate', function() {
          if (instrAudio.currentTime > 10 && !instrAudioPlayed) {
            instrAudioPlayed = true;
            unlockWatchBtn('✓ שמעתי — המשך להקלטה');
          }
        });
        instrAudio.addEventListener('error', () => unlockWatchBtn('✓ המשך להקלטה'));
      }
      instrAudio.play().catch(() => unlockWatchBtn('✓ המשך להקלטה'));
      if (btn) btn.textContent = '⏸';
    };

    // ── Music ──────────────────────────────────────────────────
    const MUSIC_URL = ${musicUrl ? `'${escJs(musicUrl)}'` : 'null'};
    let musicMode = 'none'; // 'performance' | 'none'
    let previewAudio = null;

    // ── State ──────────────────────────────────────────────────
    let participantName = '';
    let currentClipIdx  = 0;       // 0-based index of clip being recorded
    let recordedBlobs   = [];      // Array of Blobs, one per clip
    let stream          = null;
    let mediaRecorder   = null;
    let chunks          = [];
    let timerInterval   = null;
    let elapsedSec      = 0;
    let ambientAudio    = null;

    // ── Music mode ─────────────────────────────────────────────
    window.setMusicMode = function(mode) {
      musicMode = mode;
      document.getElementById('btn-performance')?.classList.toggle('active', mode === 'performance');
      document.getElementById('btn-none')?.classList.toggle('active', mode === 'none');
      if (mode !== 'performance') stopPreview();
    };

    window.toggleMusicPreview = function() {
      if (!MUSIC_URL) return;
      if (previewAudio) { stopPreview(); return; }
      previewAudio = new Audio(MUSIC_URL);
      previewAudio.volume = 0.4;
      previewAudio.loop = true;
      previewAudio.play().catch(() => {});
      const btn = document.getElementById('preview-btn');
      if (btn) { btn.textContent = '⏹'; btn.classList.add('playing'); }
    };

    function stopPreview() {
      if (previewAudio) { previewAudio.pause(); previewAudio = null; }
      const btn = document.getElementById('preview-btn');
      if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
    }

    window.playMusic = function() {
      if (!MUSIC_URL) { alert('לא נמצאה מוזיקה לסיפור זה.'); return; }
      if (ambientAudio) { ambientAudio.pause(); ambientAudio = null; }
      ambientAudio = new Audio(MUSIC_URL);
      ambientAudio.loop = true;
      ambientAudio.volume = 0.15;
      ambientAudio.play().catch(e => alert('שגיאה: ' + e.name + ': ' + e.message));
    };

    window.stopMusic = function() {
      if (ambientAudio) { ambientAudio.pause(); ambientAudio = null; }
    };

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
      stopMusic();
    }

    // ── Step 3: Countdown + Record ─────────────────────────────
    // Sync handler — preserves user gesture context for audio play in Safari
    window.handleStartBtn = function() {
      if (MUSIC_URL && musicMode === 'performance') playMusic();
      startCountdown();
    };

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
      stopMusic();
      stopPreview();
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
    function showUploadError(msg) {
      document.getElementById('upload-title').textContent = 'שגיאה בהעלאה';
      document.getElementById('upload-sub').textContent = msg;
      document.getElementById('upload-progress').style.width = '0%';
      document.getElementById('upload-pct').textContent = '';
      // Replace spinner with retry button
      const spinner = document.querySelector('#step-upload .spinner');
      if (spinner) spinner.style.display = 'none';
      const existing = document.getElementById('retry-upload-btn');
      if (!existing) {
        const btn = document.createElement('button');
        btn.id = 'retry-upload-btn';
        btn.className = 'btn-primary';
        btn.style.marginTop = '16px';
        btn.textContent = 'נסה שוב';
        btn.onclick = () => {
          spinner && (spinner.style.display = '');
          btn.remove();
          uploadAllClips();
        };
        document.querySelector('#step-upload .card').appendChild(btn);
      }
    }

    // Upload via GCS signed URL — browser uploads directly to Firebase Storage
    // (no double-hop through Render: much faster, shows real progress)
    async function uploadClipViaSignedUrl(blob, clipNumber) {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const contentType = (blob.type && blob.type !== 'video/x-msvideo') ? blob.type
        : (ext === 'mp4' ? 'video/mp4' : 'video/webm');

      // Step 1: Get a signed upload URL from the server
      const params = new URLSearchParams({ storyId: STORY_ID, clipNumber: String(clipNumber), webUid, contentType });
      const urlRes = await fetch('/api/player-upload-url?' + params);
      if (!urlRes.ok) {
        let errMsg = 'שגיאה בקבלת כתובת העלאה (' + urlRes.status + ')';
        try { errMsg = (await urlRes.json()).error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      const { signedUrl, storagePath } = await urlRes.json();

      // Step 2: PUT directly to Google Cloud Storage (shows real upload progress)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            document.getElementById('upload-progress').style.width = pct + '%';
            document.getElementById('upload-pct').textContent = pct + '%';
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error('שגיאת העלאה ' + xhr.status));
        };
        xhr.onerror = () => reject(new Error('שגיאת רשת — בדוק חיבור אינטרנט'));
        xhr.send(blob);
      });

      // Step 3: Notify server to make file public and create Firestore reflection doc
      const doneRes = await fetch('/api/player-clip-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: STORY_ID, storagePath, playerName: participantName, clipNumber, webUid }),
      });
      if (!doneRes.ok) {
        let errMsg = 'שגיאה בשמירת הקליפ (' + doneRes.status + ')';
        try { errMsg = (await doneRes.json()).error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      return await doneRes.json();
    }

    async function uploadAllClips() {
      showStep('upload');
      try {
        for (let i = 0; i < recordedBlobs.length; i++) {
          document.getElementById('upload-clip-num').textContent = i + 1;
          document.getElementById('upload-progress').style.width = '0%';
          document.getElementById('upload-pct').textContent = '0%';
          await uploadClipViaSignedUrl(recordedBlobs[i], i + 1);
        }
        stopStream();
        showStep('done');
      } catch (err) {
        console.error('Upload failed:', err);
        showUploadError('שגיאה: ' + (err.message || 'לא ידוע'));
      }
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

    // ── Init ───────────────────────────────────────────────────
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
