import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';
import { firebaseConfig } from './config.js';

let app, db, storage;
let currentStory = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let cameraStream = null;
let recordingStartTime = null;
let timerInterval = null;

const screens = {
    loading: document.getElementById('loading-screen'),
    code: document.getElementById('code-screen'),
    watch: document.getElementById('watch-screen'),
    record: document.getElementById('record-screen'),
    review: document.getElementById('review-screen'),
    success: document.getElementById('success-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
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

function getInviteCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const codeFromQuery = params.get('code') || params.get('c');
    if (codeFromQuery) return decodeURIComponent(codeFromQuery).trim();
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
        const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]);
        if (lastPart.length >= 2 && lastPart.length <= 20) {
            return lastPart.trim();
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
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
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
    
    document.getElementById('story-title').textContent = story.name || 'הסיפור';
    document.getElementById('creator-instructions').textContent = 
        story.instructions || 'צפה בסרטון והקלט את השיקוף שלך';
    
    const videoTimings = story.videoTimings || {};
    document.getElementById('recommended-time').textContent = videoTimings.video1 || 30;
    
    const videoEl = document.getElementById('story-video');
    const placeholder = document.getElementById('video-placeholder');
    
    const videoUrl = story.videoUri || story.videoUrl;
    console.log('📹 Video URL:', videoUrl);
    
    if (videoUrl) {
        const lowerUrl = videoUrl.toLowerCase();
        const needsConversion = lowerUrl.includes('.mov') || 
                                lowerUrl.includes('.hevc') ||
                                lowerUrl.includes('.m4v') ||
                                lowerUrl.includes('%2f') && (lowerUrl.includes('.mov') || lowerUrl.match(/\.mov[?&]/));
        
        console.log('🎬 Video URL analysis:', { url: videoUrl.substring(0, 100), needsConversion });
        
        if (needsConversion) {
            console.log('🔄 Video needs conversion, requesting from server...');
            placeholder.innerHTML = '<div class="placeholder-icon">🔄</div><p>ממיר סרטון לפורמט תואם...</p>';
            
            try {
                const convertResponse = await fetch('/api/convert-from-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl, storyId: story.id })
                });
                
                if (convertResponse.ok) {
                    const result = await convertResponse.json();
                    console.log('✅ Conversion result:', result);
                    videoEl.src = result.url;
                } else {
                    console.log('⚠️ Conversion failed, using original URL');
                    videoEl.src = videoUrl;
                }
            } catch (error) {
                console.error('Conversion request error:', error);
                videoEl.src = videoUrl;
            }
        } else {
            videoEl.src = videoUrl;
        }
        
        videoEl.load();
        
        videoEl.onloadedmetadata = () => {
            console.log('✅ Video metadata loaded, duration:', videoEl.duration);
            placeholder.classList.add('hidden');
        };
        
        videoEl.oncanplay = () => {
            console.log('✅ Video can play');
            placeholder.classList.add('hidden');
        };
        
        videoEl.onerror = (e) => {
            console.error('❌ Video error:', videoEl.error?.message || 'Unknown error');
            placeholder.innerHTML = `
                <div class="placeholder-icon">📹</div>
                <p>הסרטון בפורמט שלא נתמך בדפדפן זה</p>
                <a href="${videoUrl}" target="_blank" class="download-link" style="
                    display: inline-block;
                    margin-top: 15px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #FF6B9D, #C06FBB);
                    color: white;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: 600;
                ">📥 הורד והפעל</a>
                <p style="margin-top: 10px; font-size: 12px; color: #666;">
                    או פתח ב-Safari לצפייה ישירה
                </p>
            `;
        };
        
        videoEl.onstalled = () => {
            console.log('⚠️ Video stalled');
        };
    } else {
        console.log('❌ No video URL found in story');
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

function startRecording() {
    recordedChunks = [];
    
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
        document.getElementById('review-video').src = videoUrl;
        showScreen('review');
    };
    
    mediaRecorder.start(1000);
    recordingStartTime = Date.now();
    
    document.getElementById('recording-indicator').classList.add('active');
    document.getElementById('record-btn').classList.add('recording');
    document.getElementById('record-status').textContent = 'לחץ לעצירה';
    
    timerInterval = setInterval(updateTimer, 1000);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        document.getElementById('recording-indicator').classList.remove('active');
        document.getElementById('record-btn').classList.remove('recording');
        document.getElementById('record-status').textContent = 'לחץ להקלטה';
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('rec-timer').textContent = `${minutes}:${seconds}`;
}

async function submitRecording() {
    if (!recordedBlob || !currentStory) return;
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח...';
    
    try {
        const fileName = `reflections/${currentStory.id}/${Date.now()}.webm`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, recordedBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        
        await addDoc(collection(db, 'reflections'), {
            storyId: currentStory.id,
            videoUrl: downloadUrl,
            createdAt: serverTimestamp(),
            status: 'pending'
        });
        
        stopCamera();
        showScreen('success');
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('שגיאה בשליחה. נסה שוב.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'שלח שיקוף';
    }
}

function setupEventListeners() {
    const codeInput = document.getElementById('invite-code-input');
    const joinBtn = document.getElementById('join-btn');
    
    codeInput.addEventListener('input', (e) => {
        // Allow Hebrew, English, and numbers
        e.target.value = e.target.value.replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, '').trim();
        joinBtn.disabled = e.target.value.length < 2;
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
    
    document.getElementById('start-record-btn').addEventListener('click', async () => {
        showScreen('record');
        await startCamera();
    });
    
    document.getElementById('back-to-watch').addEventListener('click', () => {
        stopCamera();
        showScreen('watch');
    });
    
    const recordBtn = document.getElementById('record-btn');
    recordBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    });
    
    document.getElementById('back-to-record').addEventListener('click', () => {
        showScreen('record');
    });
    
    document.getElementById('retake-btn').addEventListener('click', async () => {
        showScreen('record');
        await startCamera();
    });
    
    document.getElementById('submit-btn').addEventListener('click', async () => {
        const consent = document.getElementById('privacy-consent');
        if (!consent.checked) {
            alert('יש לאשר את שיתוף הסרטון');
            return;
        }
        await submitRecording();
    });
    
    document.getElementById('record-another-btn').addEventListener('click', async () => {
        showScreen('record');
        await startCamera();
    });
}

async function init() {
    await initFirebase();
    setupEventListeners();
    
    const codeFromUrl = getInviteCodeFromURL();
    
    if (codeFromUrl) {
        const success = await loadStory(codeFromUrl);
        if (!success) {
            document.getElementById('invite-code-input').value = codeFromUrl;
            showScreen('code');
        }
    } else {
        showScreen('code');
    }
}

init();
