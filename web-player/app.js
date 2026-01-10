import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';
import { firebaseConfig } from './config.js';

function isInAppBrowser() {
    // Skip in-app detection for Replit preview/development
    if (window.location.hostname.includes('replit.dev') || 
        window.location.hostname.includes('replit.app') ||
        new URLSearchParams(window.location.search).has('allowWebview')) {
        return false;
    }
    
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/WhatsApp/i.test(ua)) return true;
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return true;
    if (/Instagram/i.test(ua)) return true;
    if (/wv|WebView/i.test(ua)) return true;
    if (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua)) return true;
    return false;
}

function showWebViewRedirect() {
    const loadingScreen = document.getElementById('loading-screen');
    const redirectScreen = document.getElementById('webview-redirect-screen');
    
    if (loadingScreen) loadingScreen.classList.remove('active');
    if (redirectScreen) {
        redirectScreen.style.display = 'flex';
        redirectScreen.classList.add('active');
    }
    
    const openBtn = document.getElementById('open-in-browser-btn');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            window.location.href = window.location.href;
        });
    }
    
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                copyBtn.textContent = '✅ הלינק הועתק!';
                setTimeout(() => { copyBtn.textContent = '📋 העתק לינק'; }, 2000);
            } catch (e) {
                const input = document.createElement('input');
                input.value = window.location.href;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                copyBtn.textContent = '✅ הלינק הועתק!';
                setTimeout(() => { copyBtn.textContent = '📋 העתק לינק'; }, 2000);
            }
        });
    }
}

let app, db, storage;
let currentStory = null;
let participantId = null;
let participantName = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let cameraStream = null;
let recordingStartTime = null;
let timerInterval = null;
let currentRecordingClip = null;
let maxRecordTime = 30;
let autoStopTimeout = null;

const clipRecordings = {
    1: null,
    2: null,
    3: null
};

const clipTimes = {
    1: 30,
    2: 30,
    3: 30
};

const screens = {
    loading: document.getElementById('loading-screen'),
    maintenance: document.getElementById('maintenance-screen'),
    accessGate: document.getElementById('access-gate-screen'),
    code: document.getElementById('code-screen'),
    watch: document.getElementById('watch-screen'),
    record3clips: document.getElementById('record-3clips-screen'),
    recordSingle: document.getElementById('record-single-screen'),
    reviewSingle: document.getElementById('review-single-screen'),
    success: document.getElementById('success-screen'),
    webviewRedirect: document.getElementById('webview-redirect-screen')
};

const ACCESS_CODE_KEY = 'reflectly_access_code';

function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

async function checkAccessStatus() {
    try {
        const response = await fetch('/api/maintenance-status');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to check access status:', error);
        return { maintenance: false, requiresCode: false };
    }
}

async function verifyAccessCode(code) {
    try {
        const response = await fetch('/api/verify-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to verify access code:', error);
        return { valid: false };
    }
}

function setupAccessGate() {
    const checkAgainBtn = document.getElementById('check-again-btn');
    if (checkAgainBtn) {
        checkAgainBtn.addEventListener('click', () => {
            showScreen('loading');
            initAccessCheck();
        });
    }

    const unlockBtn = document.getElementById('unlock-btn');
    const accessCodeInput = document.getElementById('access-code-input');
    const accessError = document.getElementById('access-error');

    if (unlockBtn && accessCodeInput) {
        unlockBtn.addEventListener('click', async () => {
            const code = accessCodeInput.value.trim();
            if (!code) {
                if (accessError) {
                    accessError.textContent = 'הזן קוד גישה';
                    accessError.style.display = 'block';
                }
                return;
            }

            unlockBtn.disabled = true;
            unlockBtn.textContent = '⏳ בודק...';

            const result = await verifyAccessCode(code);

            if (result.valid) {
                localStorage.setItem(ACCESS_CODE_KEY, code);
                continueToApp();
            } else {
                if (accessError) {
                    accessError.textContent = 'קוד גישה שגוי';
                    accessError.style.display = 'block';
                }
                accessCodeInput.value = '';
            }

            unlockBtn.disabled = false;
            unlockBtn.textContent = '🔓 פתח';
        });

        accessCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                unlockBtn.click();
            }
        });
    }
}

async function initAccessCheck() {
    const status = await checkAccessStatus();

    if (status.maintenance) {
        showScreen('maintenance');
        return false;
    }

    if (status.requiresCode) {
        const storedCode = localStorage.getItem(ACCESS_CODE_KEY);
        if (storedCode) {
            const verifyResult = await verifyAccessCode(storedCode);
            if (verifyResult.valid) {
                return true;
            } else {
                localStorage.removeItem(ACCESS_CODE_KEY);
            }
        }
        showScreen('accessGate');
        return false;
    }

    return true;
}

function continueToApp() {
    initApp();
}

async function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log('Firebase initialized');
        return true;
    } catch (error) {
        console.error('Firebase init error:', error);
        return false;
    }
}

function getStoryParamsFromURL() {
    console.log('🔍 Full URL:', window.location.href);
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === 's') {
        let pathStoryId = decodeURIComponent(pathParts[1]);
        // Handle case where ? was URL-encoded as %3F and included in path
        if (pathStoryId.includes('?')) {
            pathStoryId = pathStoryId.split('?')[0];
        }
        console.log('✅ Found storyId in path /s/:', pathStoryId);
        return { type: 'storyId', value: pathStoryId.trim() };
    }
    
    const hash = window.location.hash.substring(1);
    if (hash) {
        const hashParams = new URLSearchParams(hash);
        const hashStoryId = hashParams.get('storyId') || hashParams.get('story') || hashParams.get('s');
        if (hashStoryId) {
            return { type: 'storyId', value: hashStoryId.trim() };
        }
        if (hash.length >= 10 && !hash.includes('=')) {
            return { type: 'storyId', value: hash.trim() };
        }
    }
    
    const params = new URLSearchParams(window.location.search);
    const storyId = params.get('storyId') || params.get('story') || params.get('s');
    if (storyId) {
        return { type: 'storyId', value: storyId.trim() };
    }
    
    const codeFromQuery = params.get('code') || params.get('c');
    if (codeFromQuery) {
        return { type: 'code', value: decodeURIComponent(codeFromQuery).trim() };
    }
    
    if (pathParts.length > 0) {
        const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]);
        // Skip static files (contain .) and demo pages
        if (lastPart.includes('.') || lastPart.startsWith('cube') || lastPart.startsWith('qube') || lastPart === 'demo' || lastPart === 'fresh') {
            console.log('📁 Detected static file or demo page, skipping invite code lookup');
            return null;
        }
        if (!lastPart.includes('?') && !lastPart.includes('=') && lastPart.length >= 2 && lastPart.length <= 30) {
            return { type: 'code', value: lastPart.trim() };
        }
    }
    
    return null;
}

async function findStoryByCode(code) {
    console.log('🔍 findStoryByCode called with:', code);
    try {
        console.log('📂 Trying direct document lookup...');
        const storyRef = doc(db, 'stories', code);
        const storySnap = await getDoc(storyRef);
        
        if (storySnap.exists()) {
            console.log('✅ Found story by document ID');
            return { id: storySnap.id, ...storySnap.data() };
        }
        console.log('❌ Not found by document ID, trying inviteCode query...');
        
        const q = query(collection(db, 'stories'), where('inviteCode', '==', code.trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            console.log('✅ Found story by inviteCode');
            return { id: docSnap.id, ...docSnap.data() };
        }
        
        console.log('❌ Story not found with code:', code);
        return null;
    } catch (error) {
        console.error('❌ Error finding story:', error);
        return null;
    }
}

async function loadStory(code) {
    const story = await findStoryByCode(code);
    
    if (!story) {
        document.getElementById('code-error').textContent = 'קוד לא נמצא. בדוק ונסה שוב.';
        return false;
    }
    
    currentStory = story;
    
    participantId = localStorage.getItem(`participant_${story.id}`) || 
                   `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(`participant_${story.id}`, participantId);
    
    console.log('📖 Story loaded:', story);
    console.log('👤 Participant ID:', participantId);
    console.log('📖 Story details - name:', story.name, 'instructions:', story.instructions, 'creatorName:', story.creatorName);
    
    document.getElementById('story-title').textContent = story.name || story.inviteCode || 'הסיפור';
    
    const creatorNameEl = document.getElementById('creator-name');
    if (creatorNameEl) {
        creatorNameEl.textContent = `מאת: ${story.creatorName || story.creatorEmail || 'חבר'}`;
    }
    
    const instructionsText = story.instructions || story.genericInstructions || '';
    document.getElementById('creator-instructions').textContent = 
        instructionsText || 'צפה בסרטון והקלט את השיקוף שלך';
    
    const videoTimings = story.videoTimings || {};
    clipTimes[1] = videoTimings.video1 || 30;
    clipTimes[2] = videoTimings.video2 || 30;
    clipTimes[3] = videoTimings.video3 || 30;
    
    document.getElementById('clip1-time').textContent = `${clipTimes[1]} שניות`;
    document.getElementById('clip2-time').textContent = `${clipTimes[2]} שניות`;
    document.getElementById('clip3-time').textContent = `${clipTimes[3]} שניות`;
    
    if (story.instructions) {
        document.getElementById('instructions-text-display').textContent = story.instructions;
    }
    
    const videoEl = document.getElementById('story-video');
    const placeholder = document.getElementById('video-placeholder');
    
    const videoUrl = story.videoUri || story.videoUrl;
    console.log('📹 Video URL:', videoUrl);
    
    if (videoUrl) {
        const lowerUrl = videoUrl.toLowerCase();
        const needsConversion = lowerUrl.includes('.mov') || 
                                lowerUrl.includes('.hevc') ||
                                lowerUrl.includes('.m4v');
        
        if (needsConversion) {
            console.log('🔄 Video needs conversion...');
            placeholder.innerHTML = '<div class="placeholder-icon">🔄</div><p>ממיר סרטון לפורמט תואם...</p>';
            
            try {
                console.log('📤 Calling conversion API...');
                const convertResponse = await fetch('/api/convert-from-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl, storyId: story.id }),
                    signal: AbortSignal.timeout(120000)
                });
                
                console.log('📥 Conversion API response status:', convertResponse.status);
                
                if (convertResponse.ok) {
                    const result = await convertResponse.json();
                    console.log('✅ Conversion result:', result);
                    if (result.url) {
                        console.log('🎬 Setting video src to converted URL:', result.url);
                        videoEl.src = '/proxy-video?url=' + encodeURIComponent(result.url);
                    } else {
                        console.log('⚠️ No URL in result, using original');
                        videoEl.src = '/proxy-video?url=' + encodeURIComponent(videoUrl);
                    }
                } else {
                    console.log('❌ Conversion API error, using original URL');
                    videoEl.src = '/proxy-video?url=' + encodeURIComponent(videoUrl);
                }
            } catch (error) {
                console.error('❌ Conversion error:', error);
                videoEl.src = '/proxy-video?url=' + encodeURIComponent(videoUrl);
            }
        } else {
            videoEl.src = '/proxy-video?url=' + encodeURIComponent(videoUrl);
        }
        
        const finalVideoUrl = videoEl.src;
        
        videoEl.oncanplay = () => {
            console.log('✅ Video can play!');
            placeholder.classList.add('hidden');
        };
        
        videoEl.onerror = (e) => {
            console.error('❌ Video load error:', e);
            placeholder.innerHTML = `
                <div class="placeholder-icon">🎬</div>
                <p>לחץ להפעלת הסרטון</p>
                <button onclick="window.open('${finalVideoUrl}', '_blank')" style="
                    display: inline-block;
                    margin-top: 15px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #FF6B9D, #C06FBB);
                    color: white;
                    border: none;
                    border-radius: 25px;
                    font-size: 16px;
                    cursor: pointer;
                ">▶️ הפעל סרטון</button>
            `;
        };
        
        videoEl.load();
    } else {
        placeholder.innerHTML = '<div class="placeholder-icon">📹</div><p>אין סרטון זמין</p>';
    }
    
    showScreen('watch');
    return true;
}

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        
        const cameraPreview = document.getElementById('camera-preview');
        cameraPreview.srcObject = cameraStream;
        document.getElementById('camera-placeholder').classList.add('hidden');
        
        return true;
    } catch (error) {
        console.error('Camera error:', error);
        document.getElementById('camera-placeholder').innerHTML = 
            '<div class="placeholder-icon">⚠️</div><p>לא ניתן לגשת למצלמה</p>';
        return false;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function startRecordingClip(clipNumber) {
    currentRecordingClip = clipNumber;
    maxRecordTime = clipTimes[clipNumber];
    recordedChunks = [];
    
    document.getElementById('max-time-display').textContent = maxRecordTime;
    document.getElementById('single-record-title').textContent = `הקלטת שיקוף ${clipNumber}`;
    
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
    }
    
    mediaRecorder = new MediaRecorder(cameraStream, options);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(recordedBlob);
        document.getElementById('review-single-video').src = videoUrl;
        showScreen('reviewSingle');
    };
    
    mediaRecorder.start(1000);
    recordingStartTime = Date.now();
    
    document.getElementById('recording-indicator').classList.add('active');
    document.getElementById('single-record-btn').classList.add('recording');
    document.getElementById('single-record-status').textContent = 'לחץ לעצירה';
    
    timerInterval = setInterval(updateTimer, 1000);
    
    autoStopTimeout = setTimeout(() => {
        console.log('⏱️ Auto-stopping recording after', maxRecordTime, 'seconds');
        stopRecordingClip();
    }, maxRecordTime * 1000);
}

function stopRecordingClip() {
    if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
        autoStopTimeout = null;
    }
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        document.getElementById('recording-indicator').classList.remove('active');
        document.getElementById('single-record-btn').classList.remove('recording');
        document.getElementById('single-record-status').textContent = 'לחץ להקלטה';
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('rec-timer').textContent = `${minutes}:${seconds}`;
    
    if (elapsed >= maxRecordTime) {
        document.getElementById('rec-timer').style.color = '#F44336';
    }
}

function saveCurrentClip() {
    if (!recordedBlob || !currentRecordingClip) return;
    
    clipRecordings[currentRecordingClip] = recordedBlob;
    
    const card = document.getElementById(`clip${currentRecordingClip}-card`);
    const status = document.getElementById(`clip${currentRecordingClip}-status`);
    const btn = document.getElementById(`clip${currentRecordingClip}-btn`);
    const dot = document.getElementById(`dot${currentRecordingClip}`);
    
    card.classList.add('recorded');
    status.innerHTML = '<span class="status-icon">✅</span><span class="status-text">הוקלט בהצלחה</span>';
    btn.innerHTML = '<span>🔄</span><span>הקלט מחדש</span>';
    dot.classList.add('filled');
    
    updateClipsProgress();
    
    stopCamera();
    showScreen('record3clips');
}

function updateClipsProgress() {
    const recordedCount = Object.values(clipRecordings).filter(r => r !== null).length;
    document.getElementById('clips-progress-text').textContent = `הקלטת ${recordedCount} מתוך 3 שיקופים`;
    
    const submitBtn = document.getElementById('submit-all-btn');
    submitBtn.disabled = recordedCount === 0;
    
    if (recordedCount === 3) {
        submitBtn.textContent = '🎉 שלח את כל השיקופים';
        submitBtn.classList.add('complete');
    }
}

async function submitAllClips() {
    const submitBtn = document.getElementById('submit-all-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח...';
    
    try {
        for (let i = 1; i <= 3; i++) {
            if (clipRecordings[i]) {
                const fileName = `reflections/${currentStory.id}/${Date.now()}_clip${i}.webm`;
                const storageRef = ref(storage, fileName);
                
                await uploadBytes(storageRef, clipRecordings[i]);
                const downloadUrl = await getDownloadURL(storageRef);
                
                await addDoc(collection(db, 'reflections'), {
                    storyId: currentStory.id,
                    clipNumber: i,
                    videoUrl: downloadUrl,
                    participantId: participantId,
                    participantName: participantName || `משתתף ${participantId.slice(-4)}`,
                    createdAt: serverTimestamp(),
                    status: 'pending'
                });
                
                console.log(`✅ Clip ${i} uploaded`);
            }
        }
        
        showScreen('success');
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('שגיאה בשליחה. נסה שוב.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'שלח את כל השיקופים';
    }
}

function setupVideoControls() {
    const video = document.getElementById('story-video');
    const videoWrapper = document.getElementById('video-wrapper');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const timeDisplay = document.getElementById('time-display');
    
    let isFullscreen = false;
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function updateProgress() {
        if (video.duration) {
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = percent + '%';
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        }
    }
    
    const placeholder = document.getElementById('video-placeholder');
    video.addEventListener('playing', () => {
        placeholder.classList.add('hidden');
    });
    
    playPauseBtn.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playPauseBtn.textContent = '⏸️';
        } else {
            video.pause();
            playPauseBtn.textContent = '▶️';
        }
    });
    
    video.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playPauseBtn.textContent = '⏸️';
        } else {
            video.pause();
            playPauseBtn.textContent = '▶️';
        }
    });
    
    stopBtn.addEventListener('click', () => {
        video.pause();
        video.currentTime = 0;
        playPauseBtn.textContent = '▶️';
    });
    
    fullscreenBtn.addEventListener('click', () => {
        if (!isFullscreen) {
            videoWrapper.classList.add('fullscreen');
            fullscreenBtn.textContent = '✕';
            isFullscreen = true;
        } else {
            videoWrapper.classList.remove('fullscreen');
            fullscreenBtn.textContent = '⛶';
            isFullscreen = false;
        }
    });
    
    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
    });
    
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', () => { playPauseBtn.textContent = '▶️'; });
    video.addEventListener('play', () => { playPauseBtn.textContent = '⏸️'; });
    video.addEventListener('pause', () => { playPauseBtn.textContent = '▶️'; });
}

function setupEventListeners() {
    const codeInput = document.getElementById('invite-code-input');
    const joinBtn = document.getElementById('join-btn');
    
    codeInput.addEventListener('input', (e) => {
        joinBtn.disabled = e.target.value.trim().length < 1;
        document.getElementById('code-error').textContent = '';
    });
    
    joinBtn.addEventListener('click', async () => {
        joinBtn.disabled = true;
        joinBtn.textContent = 'מחפש...';
        const success = await loadStory(codeInput.value);
        if (!success) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'הצטרף לסיפור';
        }
    });
    
    document.getElementById('back-to-code').addEventListener('click', () => {
        showScreen('code');
    });
    
    document.getElementById('start-record-btn').addEventListener('click', () => {
        showScreen('record3clips');
    });
    
    document.getElementById('back-to-watch-from-3clips').addEventListener('click', () => {
        showScreen('watch');
    });
    
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`clip${i}-btn`).addEventListener('click', async () => {
            currentRecordingClip = i;
            maxRecordTime = clipTimes[i];
            document.getElementById('max-time-display').textContent = maxRecordTime;
            document.getElementById('single-record-title').textContent = `הקלטת שיקוף ${i}`;
            document.getElementById('rec-timer').textContent = '00:00';
            document.getElementById('rec-timer').style.color = 'white';
            
            showScreen('recordSingle');
            await startCamera();
        });
    }
    
    document.getElementById('back-to-3clips').addEventListener('click', () => {
        stopCamera();
        if (autoStopTimeout) {
            clearTimeout(autoStopTimeout);
            autoStopTimeout = null;
        }
        showScreen('record3clips');
    });
    
    const singleRecordBtn = document.getElementById('single-record-btn');
    singleRecordBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecordingClip();
        } else {
            startRecordingClip(currentRecordingClip);
        }
    });
    
    document.getElementById('back-to-single-record').addEventListener('click', async () => {
        showScreen('recordSingle');
        await startCamera();
    });
    
    document.getElementById('retake-single-btn').addEventListener('click', async () => {
        showScreen('recordSingle');
        await startCamera();
    });
    
    document.getElementById('save-single-btn').addEventListener('click', () => {
        saveCurrentClip();
    });
    
    document.getElementById('submit-all-btn').addEventListener('click', async () => {
        await submitAllClips();
    });
}

async function init() {
    console.log('🌐 User Agent:', navigator.userAgent);
    console.log('📱 Is in-app browser:', isInAppBrowser());
    console.log('📍 Full URL:', window.location.href);
    console.log('📍 Pathname:', window.location.pathname);
    console.log('📍 Search:', window.location.search);
    console.log('📍 Hash:', window.location.hash);
    
    setupAccessGate();
    
    const accessGranted = await initAccessCheck();
    if (!accessGranted) {
        console.log('🔒 Access check failed - waiting for unlock');
        return;
    }
    
    initApp();
}

async function initApp() {
    const inAppBrowser = isInAppBrowser();
    
    const fbInit = await initFirebase();
    console.log('🔥 Firebase init result:', fbInit);
    
    setupEventListeners();
    setupVideoControls();
    
    const urlParams = getStoryParamsFromURL();
    console.log('🔍 URL params result:', urlParams);
    
    if (urlParams) {
        console.log('📱 URL params found:', urlParams);
        console.log('🔎 Searching for story with value:', urlParams.value);
        const success = await loadStory(urlParams.value);
        console.log('📖 loadStory result:', success);
        if (success) {
            if (inAppBrowser) {
                console.log('📱 In-app browser detected, adding banner for recording');
                addInAppBrowserBanner();
            }
        } else {
            if (inAppBrowser) {
                showWebViewRedirect();
                return;
            }
            document.getElementById('invite-code-input').value = urlParams.value;
            showScreen('code');
        }
    } else {
        console.log('⚠️ No URL params found');
        if (inAppBrowser) {
            console.log('⚠️ In-app browser with no story params, showing redirect');
            showWebViewRedirect();
            return;
        }
        showScreen('watch');
        showWelcomeMessage();
    }
}

function showWelcomeMessage() {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; text-align: center; padding: 20px;">
                <div style="font-size: 80px; margin-bottom: 20px;">🎬</div>
                <h2 style="margin-bottom: 15px;">ברוכים הבאים ל-Reflectly</h2>
                <p style="opacity: 0.8; margin-bottom: 20px;">כדי לצפות בסיפור, קבל קישור מחבר</p>
                <a href="/cube-demo.html" style="background: white; color: #C06FBB; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">🎲 צפה בדמו הקוביה</a>
            </div>
        `;
    }
    const recordBtn = document.getElementById('continue-to-record');
    if (recordBtn) recordBtn.style.display = 'none';
}

function addInAppBrowserBanner() {
    const watchScreen = document.getElementById('watch-screen');
    if (!watchScreen) return;
    
    const existingBanner = document.getElementById('inapp-browser-banner');
    if (existingBanner) return;
    
    const banner = document.createElement('div');
    banner.id = 'inapp-browser-banner';
    banner.style.cssText = 'background: linear-gradient(135deg, #FF6B9D, #C06FBB); color: white; padding: 12px 16px; text-align: center; font-size: 14px; position: fixed; top: 0; left: 0; right: 0; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
    banner.innerHTML = `
        <div style="margin-bottom: 8px;">📱 להקלטת הפידבק, פתח בדפדפן:</div>
        <button onclick="window.open(window.location.href, '_system')" style="background: white; color: #C06FBB; border: none; padding: 8px 20px; border-radius: 20px; font-weight: bold; cursor: pointer;">
            🔗 פתח ב-Safari/Chrome
        </button>
    `;
    watchScreen.insertBefore(banner, watchScreen.firstChild);
}

document.addEventListener('DOMContentLoaded', init);
