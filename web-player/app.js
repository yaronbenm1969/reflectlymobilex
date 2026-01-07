import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';
import { firebaseConfig } from './config.js';

function isInAppBrowser() {
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
    code: document.getElementById('code-screen'),
    watch: document.getElementById('watch-screen'),
    record3clips: document.getElementById('record-3clips-screen'),
    recordSingle: document.getElementById('record-single-screen'),
    reviewSingle: document.getElementById('review-single-screen'),
    success: document.getElementById('success-screen'),
    webviewRedirect: document.getElementById('webview-redirect-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
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
        const pathStoryId = decodeURIComponent(pathParts[1]);
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
        if (!lastPart.includes('?') && !lastPart.includes('=') && lastPart.length >= 2 && lastPart.length <= 30) {
            return { type: 'code', value: lastPart.trim() };
        }
    }
    
    return null;
}

async function findStoryByCode(code) {
    try {
        const storyRef = doc(db, 'stories', code);
        const storySnap = await getDoc(storyRef);
        
        if (storySnap.exists()) {
            return { id: storySnap.id, ...storySnap.data() };
        }
        
        const q = query(collection(db, 'stories'), where('inviteCode', '==', code.trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return { id: docSnap.id, ...docSnap.data() };
        }
        
        return null;
    } catch (error) {
        console.error('Error finding story:', error);
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
    console.log('📖 Story loaded:', story);
    
    document.getElementById('story-title').textContent = story.name || 'הסיפור';
    document.getElementById('creator-instructions').textContent = 
        story.instructions || 'צפה בסרטון והקלט את השיקוף שלך';
    
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
                const convertResponse = await fetch('/api/convert-from-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl, storyId: story.id }),
                    signal: AbortSignal.timeout(120000)
                });
                
                if (convertResponse.ok) {
                    const result = await convertResponse.json();
                    if (result.url) {
                        videoEl.src = result.url;
                    } else {
                        videoEl.src = videoUrl;
                    }
                } else {
                    videoEl.src = videoUrl;
                }
            } catch (error) {
                console.error('Conversion error:', error);
                videoEl.src = videoUrl;
            }
        } else {
            videoEl.src = videoUrl;
        }
        
        videoEl.load();
        
        videoEl.oncanplay = () => {
            placeholder.classList.add('hidden');
        };
        
        videoEl.onerror = () => {
            placeholder.innerHTML = `
                <div class="placeholder-icon">📹</div>
                <p>הסרטון בפורמט שלא נתמך</p>
                <a href="${videoUrl}" target="_blank" class="download-link" style="
                    display: inline-block;
                    margin-top: 15px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #FF6B9D, #C06FBB);
                    color: white;
                    text-decoration: none;
                    border-radius: 25px;
                ">📥 הורד והפעל</a>
            `;
        };
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
    
    if (isInAppBrowser()) {
        console.log('⚠️ Detected in-app browser, showing redirect screen');
        showWebViewRedirect();
        return;
    }
    
    await initFirebase();
    setupEventListeners();
    setupVideoControls();
    
    const urlParams = getStoryParamsFromURL();
    
    if (urlParams) {
        console.log('📱 URL params found:', urlParams);
        const success = await loadStory(urlParams.value);
        if (!success) {
            document.getElementById('invite-code-input').value = urlParams.value;
            showScreen('code');
        }
    } else {
        showScreen('code');
    }
}

document.addEventListener('DOMContentLoaded', init);
