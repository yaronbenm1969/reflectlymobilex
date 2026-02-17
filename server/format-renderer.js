const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROMIUM_PATH = execSync('which chromium 2>/dev/null || find /nix -name "chromium" -type f 2>/dev/null | head -1').toString().trim();
const FRAME_RATE = 24;
const VIEWPORT_WIDTH = 720;
const VIEWPORT_HEIGHT = 1280;

function generateCubeHTML(videoUrls) {
  const CUBE_SIZE = 280;
  const facesJSON = JSON.stringify(videoUrls.map((url, i) => ({
    index: i,
    videoUrl: url,
    playerName: `Video ${i + 1}`,
  })));

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${VIEWPORT_WIDTH}, height=${VIEWPORT_HEIGHT}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: ${VIEWPORT_WIDTH}px; 
      height: ${VIEWPORT_HEIGHT}px; 
      overflow: hidden;
      background: #000;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: sans-serif;
    }
    .space-bg {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%);
      z-index: 0;
    }
    .stars {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;
    }
    .stars-layer { position: absolute; width: 100%; height: 100%; }
    .stars-layer-1 {
      background-image: 
        radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.9) 0%, transparent 100%),
        radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 40% 15%, rgba(255,255,255,0.8) 0%, transparent 100%),
        radial-gradient(1px 1px at 55% 70%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(2px 2px at 70% 35%, rgba(255,255,255,0.9) 0%, transparent 100%),
        radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.7) 0%, transparent 100%);
      animation: twinkle 4s ease-in-out infinite;
    }
    .stars-layer-2 {
      background-image: 
        radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(1px 1px at 60% 25%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(2px 2px at 75% 55%, rgba(255,255,255,0.5) 0%, transparent 100%);
      animation: twinkle 6s ease-in-out infinite 2s;
    }
    .depth-grid {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: 
        linear-gradient(rgba(255,107,157,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,107,157,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      transform: perspective(500px) rotateX(60deg);
      transform-origin: center 120%;
      z-index: 1; opacity: 0.5;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .scene {
      width: ${CUBE_SIZE}px; height: ${CUBE_SIZE}px;
      perspective: 800px;
      perspective-origin: 50% 50%;
      z-index: 10; position: relative;
    }
    .cube {
      width: 100%; height: 100%;
      position: relative;
      transform-style: preserve-3d;
    }
    .cube-face {
      position: absolute;
      width: ${CUBE_SIZE}px; height: ${CUBE_SIZE}px;
      border: 4px solid rgba(255,255,255,0.7);
      border-radius: 16px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 0 30px rgba(0,0,0,0.3);
      backface-visibility: hidden;
    }
    .cube-face video {
      width: 100%; height: 100%;
      object-fit: cover;
      position: absolute; top: 0; left: 0;
      background: #000;
    }
    .front  { transform: rotateY(0deg) translateZ(${CUBE_SIZE/2}px); }
    .back   { transform: rotateY(180deg) translateZ(${CUBE_SIZE/2}px); }
    .right  { transform: rotateY(90deg) translateZ(${CUBE_SIZE/2}px); }
    .left   { transform: rotateY(-90deg) translateZ(${CUBE_SIZE/2}px); }
    .top    { transform: rotateX(90deg) translateZ(${CUBE_SIZE/2}px); }
    .bottom { transform: rotateX(-90deg) translateZ(${CUBE_SIZE/2}px); }
    .float-wrapper {
      width: 100%; height: 100%;
      transform-style: preserve-3d;
    }
    .spin-wrapper {
      width: 100%; height: 100%;
      transform-style: preserve-3d;
    }
  </style>
</head>
<body>
  <div class="space-bg"></div>
  <div class="stars">
    <div class="stars-layer stars-layer-1"></div>
    <div class="stars-layer stars-layer-2"></div>
  </div>
  <div class="depth-grid"></div>
  <div class="scene">
    <div class="float-wrapper" id="float-wrapper">
      <div class="spin-wrapper" id="spin-wrapper">
        <div class="cube" id="cube">
          <div class="cube-face front" id="face-0"></div>
          <div class="cube-face back" id="face-1"></div>
          <div class="cube-face right" id="face-2"></div>
          <div class="cube-face left" id="face-3"></div>
          <div class="cube-face top" id="face-4"></div>
          <div class="cube-face bottom" id="face-5"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const faces = ${facesJSON};
    const fullVideoQueue = faces.filter(f => f && f.videoUrl);
    
    const ROTATION_PATH = [
      { faceId: 0, rotX: 0, rotY: 0 },
      { faceId: 2, rotX: 12, rotY: -90 },
      { faceId: 1, rotX: -35, rotY: -180 },
      { faceId: 3, rotX: 10, rotY: -270 },
    ];
    const HALF_ANGLE = 45;
    
    let currentIndex = 0;
    let isPlaying = false;
    let faceVideoElements = {};
    let faceVideos = {};
    let floatAnimId = null;
    let floatStartTime = 0;
    let currentRotX = 0, currentRotY = 0;
    let activeVideo = null, activeVideoIndex = -1;
    let rotationFromX = 0, rotationFromY = 0;
    let rotationToX = 0, rotationToY = 0;
    
    function getFaceForIndex(idx) { return ROTATION_PATH[idx % 4].faceId; }
    function getTargetRotation(idx) {
      const cycle = Math.floor(idx / 4);
      const step = ROTATION_PATH[idx % 4];
      return { rotX: step.rotX, rotY: step.rotY - (cycle * 360) };
    }
    
    function initFaceVideoElements() {
      [0,1,2,3,4,5].forEach(faceId => {
        const el = document.getElementById('face-' + faceId);
        if (el && !faceVideoElements[faceId]) {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.preload = 'auto';
          video.crossOrigin = 'anonymous';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          el.appendChild(video);
          faceVideoElements[faceId] = video;
        }
      });
    }
    
    function loadVideoOnFace(faceId, queueIdx) {
      return new Promise((resolve, reject) => {
        if (queueIdx >= fullVideoQueue.length) { reject('No video'); return; }
        const video = faceVideoElements[faceId];
        if (!video) { reject('No element'); return; }
        if (faceVideos[faceId] && faceVideos[faceId].queueIdx === queueIdx && video.readyState >= 2) {
          resolve(video); return;
        }
        let resolved = false;
        video.oncanplay = function() {
          if (resolved) return; resolved = true;
          video.oncanplay = null; video.onerror = null;
          video.currentTime = 0.001;
          resolve(video);
        };
        video.onerror = function() {
          if (resolved) return; resolved = true;
          video.oncanplay = null; video.onerror = null;
          reject('Load error');
        };
        faceVideos[faceId] = { element: video, queueIdx };
        video.src = fullVideoQueue[queueIdx].videoUrl;
        video.load();
        setTimeout(() => { if (!resolved && video.readyState >= 2) { resolved = true; resolve(video); } }, 8000);
        setTimeout(() => { if (!resolved) { resolved = true; reject('Timeout'); } }, 15000);
      });
    }
    
    function updateCubeTransform(timestamp) {
      if (!floatStartTime) floatStartTime = timestamp;
      const elapsed = (timestamp - floatStartTime) / 1000;
      const floatX = Math.sin(elapsed * 0.5) * 22 + Math.sin(elapsed * 0.3) * 13;
      const floatY = Math.sin(elapsed * 0.4 + 1) * 26 + Math.cos(elapsed * 0.25) * 16;
      const floatZ = Math.sin(elapsed * 0.35 + 2) * 38 + Math.cos(elapsed * 0.2) * 20;
      const depthPhase1 = Math.sin(elapsed * 0.15) * 0.22;
      const depthPhase2 = Math.sin(elapsed * 0.4 + 1.5) * 0.11;
      const depthScale = 0.95 + depthPhase1 + depthPhase2;
      const depthTranslateZ = Math.sin(elapsed * 0.18 + 2) * 110 + Math.cos(elapsed * 0.12) * 70;
      
      if (activeVideo && activeVideoIndex >= 0) {
        const duration = activeVideo.duration;
        const currentTime = activeVideo.currentTime;
        if (duration && duration > 0 && isFinite(duration)) {
          const progress = Math.min(currentTime / duration, 1);
          const ease = progress < 0.5 ? 2*progress*progress : 1 - Math.pow(-2*progress+2,2)/2;
          currentRotX = rotationFromX + (rotationToX - rotationFromX) * ease;
          currentRotY = rotationFromY + (rotationToY - rotationFromY) * ease;
        }
      }
      
      const spinWrapper = document.getElementById('spin-wrapper');
      const floatWrapper = document.getElementById('float-wrapper');
      if (spinWrapper) spinWrapper.style.transform = 'rotateX('+currentRotX+'deg) rotateY('+currentRotY+'deg)';
      if (floatWrapper) floatWrapper.style.transform = 'translate3d('+floatX+'px,'+floatY+'px,'+(floatZ+depthTranslateZ)+'px) scale('+depthScale+')';
    }
    
    function floatLoop(timestamp) {
      if (!isPlaying) return;
      updateCubeTransform(timestamp);
      floatAnimId = requestAnimationFrame(floatLoop);
    }
    
    function setupRotationSync(video, videoIndex) {
      const fromTarget = getTargetRotation(videoIndex);
      const toTarget = getTargetRotation(videoIndex + 1);
      rotationFromX = fromTarget.rotX;
      rotationFromY = fromTarget.rotY + HALF_ANGLE;
      rotationToX = toTarget.rotX;
      rotationToY = toTarget.rotY + HALF_ANGLE;
      currentRotX = rotationFromX;
      currentRotY = rotationFromY;
      activeVideo = video;
      activeVideoIndex = videoIndex;
    }
    
    function clearRotationSync() { activeVideo = null; activeVideoIndex = -1; }
    
    function preloadUpcoming(fromIdx) {
      for (let a = 1; a <= 3; a++) {
        const idx = fromIdx + a;
        if (idx >= fullVideoQueue.length) break;
        const fId = getFaceForIndex(idx);
        const existing = faceVideos[fId];
        if (!existing || existing.queueIdx !== idx) {
          loadVideoOnFace(fId, idx).catch(() => {});
        }
      }
    }
    
    async function playCurrentVideo() {
      if (currentIndex >= fullVideoQueue.length) {
        console.log('ALL_DONE');
        window.__renderComplete = true;
        isPlaying = false;
        if (floatAnimId) cancelAnimationFrame(floatAnimId);
        return;
      }
      const faceId = getFaceForIndex(currentIndex);
      let fv = faceVideos[faceId];
      if (!fv || fv.queueIdx !== currentIndex) {
        try { await loadVideoOnFace(faceId, currentIndex); fv = faceVideos[faceId]; }
        catch(e) { advanceToNext(); return; }
      }
      if (!fv || !fv.element) { advanceToNext(); return; }
      
      const video = fv.element;
      const playingIdx = currentIndex;
      
      Object.entries(faceVideos).forEach(([id, v]) => {
        if (parseInt(id) !== faceId && v && v.element) { v.element.pause(); v.element.muted = true; }
      });
      
      video.muted = false;
      video.volume = 1;
      video.onended = function() {
        clearRotationSync();
        if (currentIndex === playingIdx) advanceToNext();
      };
      
      try {
        await video.play();
        setupRotationSync(video, playingIdx);
        preloadUpcoming(playingIdx);
      } catch(e) {
        video.muted = true;
        try { await video.play(); setupRotationSync(video, playingIdx); preloadUpcoming(playingIdx); }
        catch(e2) { setTimeout(() => advanceToNext(), 200); }
      }
    }
    
    function advanceToNext() {
      currentIndex++;
      if (currentIndex >= fullVideoQueue.length) {
        console.log('ALL_DONE');
        window.__renderComplete = true;
        isPlaying = false;
        if (floatAnimId) cancelAnimationFrame(floatAnimId);
        return;
      }
      clearRotationSync();
      playCurrentVideo();
    }
    
    async function autoStart() {
      initFaceVideoElements();
      const preloadCount = Math.min(4, fullVideoQueue.length);
      const promises = [];
      for (let i = 0; i < preloadCount; i++) {
        promises.push(loadVideoOnFace(getFaceForIndex(i), i).catch(() => null));
      }
      await Promise.all(promises);
      
      currentIndex = 0;
      isPlaying = true;
      const initial = getTargetRotation(0);
      currentRotX = initial.rotX;
      currentRotY = initial.rotY + HALF_ANGLE;
      updateCubeTransform(performance.now());
      floatStartTime = 0;
      floatAnimId = requestAnimationFrame(floatLoop);
      
      window.__renderStarted = true;
      playCurrentVideo();
    }
    
    window.__renderComplete = false;
    window.__renderStarted = false;
    autoStart();
  </script>
</body>
</html>`;
}

function generateFlipPagesHTML(videoUrls, storyName = 'My Story') {
  const PAGE_WIDTH = 280;
  const PAGE_HEIGHT = PAGE_WIDTH * 1.4;
  const safeStoryName = (storyName || 'My Story').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const facesJSON = JSON.stringify(videoUrls.map((url, i) => ({
    index: i,
    videoUrl: url,
    playerName: `Video ${i + 1}`,
  })));

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${VIEWPORT_WIDTH}, height=${VIEWPORT_HEIGHT}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: ${VIEWPORT_WIDTH}px; height: ${VIEWPORT_HEIGHT}px;
      overflow: hidden; background: #1a1a2e;
    }
    body {
      display: flex; align-items: center; justify-content: center;
      font-family: sans-serif;
    }
    .book-container {
      width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
      position: relative; perspective: 1500px;
    }
    .book-spine {
      position: absolute; right: -10px; top: -3px;
      width: 12px; height: calc(100% + 6px);
      background: linear-gradient(90deg, #6B3410, #8B4513, #6B3410);
      border-radius: 2px 0 0 2px;
      box-shadow: inset 0 0 6px rgba(0,0,0,0.5), 2px 0 6px rgba(0,0,0,0.3);
      z-index: 50;
    }
    .book-cover-back {
      position: absolute;
      width: calc(100% + 6px); height: calc(100% + 6px);
      top: -3px; right: -12px;
      background: linear-gradient(145deg, #5C2D0E, #3A1A06);
      border-radius: 4px 10px 10px 4px;
      box-shadow: 4px 6px 20px rgba(0,0,0,0.6);
      z-index: -1;
    }
    .page-edges {
      position: absolute; bottom: -3px; right: 0;
      width: 90%; height: 8px;
      background: repeating-linear-gradient(90deg, #f5f0e8 0px, #f5f0e8 2px, #e0d8cc 2px, #e0d8cc 3px);
      border-radius: 0 0 4px 4px;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      z-index: -1;
    }
    .page {
      position: absolute; width: 100%; height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      transition: transform 1.2s cubic-bezier(0.645, 0.045, 0.355, 1.000);
      border-radius: 4px 8px 8px 4px;
      overflow: hidden;
    }
    .page-front, .page-back {
      position: absolute; width: 100%; height: 100%;
      backface-visibility: hidden;
      border-radius: 4px 8px 8px 4px;
      overflow: hidden;
      background: linear-gradient(145deg, #f5f0e8, #ebe4d8);
    }
    .page-front { z-index: 2; box-shadow: -3px 0 10px rgba(0,0,0,0.2); }
    .page-back { transform: rotateY(-180deg); background: linear-gradient(145deg, #ebe4d8, #ddd6c8); }
    .page video {
      width: 100%; height: 100%; object-fit: cover;
      border-radius: 4px 8px 8px 4px;
    }
    .page.flipped { transform: rotateY(180deg); }
    .book-cover {
      position: absolute; width: 100%; height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      transition: transform 1.8s cubic-bezier(0.645, 0.045, 0.355, 1.000);
      z-index: 100;
      border-radius: 4px 10px 10px 4px;
    }
    .book-cover-face {
      position: absolute; width: 100%; height: 100%;
      backface-visibility: hidden;
      border-radius: 4px 10px 10px 4px;
      overflow: hidden;
    }
    .book-cover-front-face {
      background: linear-gradient(160deg, #8B4513 0%, #654321 30%, #5C3317 50%, #8B4513 70%, #A0522D 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      box-shadow: 3px 4px 15px rgba(0,0,0,0.5);
      border: 2px solid rgba(139,69,19,0.4);
    }
    .cover-border {
      position: absolute; top: 12px; left: 12px; right: 12px; bottom: 12px;
      border: 1px solid rgba(212,175,55,0.35); border-radius: 4px; pointer-events: none;
    }
    .cover-border-inner {
      position: absolute; top: 18px; left: 18px; right: 18px; bottom: 18px;
      border: 1px solid rgba(212,175,55,0.2); border-radius: 2px; pointer-events: none;
    }
    .cover-title {
      color: #D4AF37; font-size: 22px; font-weight: bold;
      text-align: center; padding: 0 30px;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.5);
      line-height: 1.4; letter-spacing: 1px; z-index: 2;
    }
    .cover-ornament {
      width: 60px; height: 2px;
      background: linear-gradient(90deg, transparent, #D4AF37, transparent);
      margin: 16px auto; z-index: 2;
    }
    .cover-subtitle {
      color: rgba(212,175,55,0.6); font-size: 13px;
      text-align: center; letter-spacing: 3px;
      text-transform: uppercase; z-index: 2;
    }
    .cover-icon { font-size: 40px; margin-bottom: 20px; z-index: 2; opacity: 0.8; }
    .book-cover-inside {
      transform: rotateY(-180deg);
      background: linear-gradient(145deg, #f5f0e8, #ebe4d8);
    }
    .book-cover.opened { transform: rotateY(180deg); }
    .book-shadow {
      position: absolute; bottom: -15px; right: 5%;
      width: 90%; height: 15px;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, transparent 70%);
      filter: blur(6px); z-index: -2;
    }
  </style>
</head>
<body>
  <div class="book-container" id="book">
    <div class="book-cover-back"></div>
    <div class="book-spine"></div>
    <div class="page-edges"></div>
    <div class="page" id="page-3" style="z-index:10;">
      <div class="page-front" id="front-3"></div>
      <div class="page-back" id="back-3"></div>
    </div>
    <div class="page" id="page-2" style="z-index:20;">
      <div class="page-front" id="front-2"></div>
      <div class="page-back" id="back-2"></div>
    </div>
    <div class="page" id="page-1" style="z-index:30;">
      <div class="page-front" id="front-1"></div>
      <div class="page-back" id="back-1"></div>
    </div>
    <div class="page" id="page-0" style="z-index:40;">
      <div class="page-front" id="front-0"></div>
      <div class="page-back" id="back-0"></div>
    </div>
    <div class="book-cover" id="book-cover">
      <div class="book-cover-face book-cover-front-face">
        <div class="cover-border"></div>
        <div class="cover-border-inner"></div>
        <div class="cover-icon">📖</div>
        <div class="cover-title">${safeStoryName}</div>
        <div class="cover-ornament"></div>
        <div class="cover-subtitle">Reflectly</div>
      </div>
      <div class="book-cover-face book-cover-inside"></div>
    </div>
    <div class="book-shadow"></div>
  </div>
  <script>
    const faces = ${facesJSON};
    const fullVideoQueue = faces.filter(f => f && f.videoUrl);
    let currentIndex = 0;
    let isPlaying = false;
    const pageVideos = {};
    
    function initPageVideos() {
      for (let i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        const frontEl = document.getElementById('front-' + i);
        if (frontEl && !pageVideos[i]) {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.preload = 'auto';
          video.crossOrigin = 'anonymous';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          video.src = fullVideoQueue[i].videoUrl;
          frontEl.appendChild(video);
          pageVideos[i] = video;
        }
      }
    }
    
    function flipPage(pageIndex) {
      const page = document.getElementById('page-' + pageIndex);
      if (page) { page.classList.add('flipped'); page.style.zIndex = 1; }
    }
    
    function resetAllPages() {
      for (let i = 0; i < 4; i++) {
        const page = document.getElementById('page-' + i);
        if (page) { page.classList.remove('flipped'); page.style.zIndex = (4-i)*10; }
      }
    }
    
    function preloadNextVideo() {
      const nextIdx = currentIndex + 1;
      if (nextIdx >= fullVideoQueue.length) return;
      const nextSlot = nextIdx % 4;
      const nextVideo = pageVideos[nextSlot];
      if (nextVideo && fullVideoQueue[nextIdx]) {
        nextVideo.muted = true;
        nextVideo.src = fullVideoQueue[nextIdx].videoUrl;
        nextVideo.load();
      }
    }
    
    function playCurrentVideo() {
      if (currentIndex >= fullVideoQueue.length) {
        console.log('ALL_DONE');
        window.__renderComplete = true;
        isPlaying = false;
        return;
      }
      const pageSlot = currentIndex % 4;
      const video = pageVideos[pageSlot];
      if (!video) { advanceToNext(); return; }
      
      const playingIndex = currentIndex;
      Object.values(pageVideos).forEach(v => { if (v !== video) v.pause(); });
      video.muted = false;
      video.currentTime = 0;
      
      let earlyFlipDone = false;
      video.ontimeupdate = function() {
        if (earlyFlipDone) return;
        const remaining = video.duration - video.currentTime;
        if (remaining <= 1.5 && video.duration > 2) {
          earlyFlipDone = true;
          flipPage(playingIndex % 4);
        }
      };
      
      video.onended = function() {
        video.ontimeupdate = null;
        if (!earlyFlipDone) flipPage(playingIndex % 4);
        setTimeout(() => {
          if (currentIndex === playingIndex) advanceToNext();
        }, earlyFlipDone ? 100 : 600);
      };
      
      video.play().then(() => {
        preloadNextVideo();
      }).catch(e => {
        video.muted = true;
        video.play().then(() => preloadNextVideo()).catch(() => {
          setTimeout(() => advanceToNext(), 200);
        });
      });
    }
    
    function advanceToNext() {
      currentIndex++;
      if (currentIndex >= fullVideoQueue.length) {
        console.log('ALL_DONE');
        window.__renderComplete = true;
        isPlaying = false;
        return;
      }
      if (currentIndex % 4 === 0) {
        resetAllPages();
        for (let i = 0; i < Math.min(4, fullVideoQueue.length - currentIndex); i++) {
          const video = pageVideos[i];
          if (video && fullVideoQueue[currentIndex + i]) {
            video.muted = true;
            video.src = fullVideoQueue[currentIndex + i].videoUrl;
            video.load();
          }
        }
        setTimeout(() => playCurrentVideo(), 300);
      } else {
        playCurrentVideo();
      }
    }
    
    async function autoStart() {
      initPageVideos();
      const preloadPromises = Object.values(pageVideos).map(video => {
        return new Promise(resolve => {
          if (video.readyState >= 2) resolve();
          else {
            video.oncanplay = () => resolve();
            setTimeout(resolve, 8000);
          }
        });
      });
      await Promise.all(preloadPromises);
      
      const cover = document.getElementById('book-cover');
      if (cover) {
        cover.classList.add('opened');
        await new Promise(r => setTimeout(r, 2000));
        cover.style.display = 'none';
      }
      
      currentIndex = 0;
      isPlaying = true;
      resetAllPages();
      window.__renderStarted = true;
      playCurrentVideo();
    }
    
    window.__renderComplete = false;
    window.__renderStarted = false;
    autoStart();
  </script>
</body>
</html>`;
}

async function downloadFile(url, destPath) {
  const https = require('https');
  const http = require('http');
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const request = mod.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
      file.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Download timeout')); });
  });
}

function startLocalVideoServer(videosDir, port) {
  const http = require('http');
  const server = http.createServer((req, res) => {
    const filePath = path.join(videosDir, req.url.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404); res.end(); return;
    }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Local video server on port ${port}`);
      resolve(server);
    });
  });
}

async function renderFormatVideo(videoUrls, format, storyName, jobId, onProgress) {
  const tmpDir = path.join(os.tmpdir(), `render_${jobId}`);
  const framesDir = path.join(tmpDir, 'frames');
  const videosDir = path.join(tmpDir, 'videos');
  const outputPath = path.join(tmpDir, 'output.mp4');
  
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(videosDir, { recursive: true });
  
  let browser;
  let localServer;
  const localPort = 9100 + Math.floor(Math.random() * 900);
  
  try {
    onProgress(5, 'Downloading videos');
    
    const localUrls = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const localPath = path.join(videosDir, `video_${i}.mp4`);
      console.log(`Downloading video ${i+1}/${videoUrls.length}...`);
      await downloadFile(videoUrls[i], localPath);
      localUrls.push(`http://127.0.0.1:${localPort}/video_${i}.mp4`);
      onProgress(5 + Math.round((i+1)/videoUrls.length * 10), `Downloaded ${i+1}/${videoUrls.length}`);
    }
    
    localServer = await startLocalVideoServer(videosDir, localPort);
    
    onProgress(18, 'Starting browser');
    
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-web-security',
        '--allow-file-access-from-files',
        `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
      ],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser Error] ${err.message}`));
    
    let html;
    if (format === 'cube-3d') {
      html = generateCubeHTML(localUrls);
    } else if (format === 'flip-pages') {
      html = generateFlipPagesHTML(localUrls, storyName);
    } else {
      html = generateCubeHTML(localUrls);
    }
    
    onProgress(20, 'Loading animation');
    
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    
    onProgress(22, 'Waiting for videos to load');
    
    try {
      await page.waitForFunction('window.__renderStarted === true', { timeout: 60000 });
    } catch (e) {
      console.log('Warning: __renderStarted not detected, proceeding anyway');
    }
    
    onProgress(25, 'Recording animation');
    
    const frameInterval = 1000 / FRAME_RATE;
    let frameCount = 0;
    const maxFrames = FRAME_RATE * 300;
    const maxWaitMs = 300000;
    const startTime = Date.now();
    const minFrames = FRAME_RATE * 5;
    
    while (frameCount < maxFrames) {
      const isComplete = await page.evaluate(() => window.__renderComplete);
      if (isComplete && frameCount >= minFrames) {
        for (let extra = 0; extra < FRAME_RATE * 2; extra++) {
          const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.png`);
          await page.screenshot({ path: framePath, type: 'png' });
          frameCount++;
          await new Promise(r => setTimeout(r, frameInterval));
        }
        break;
      }
      
      if (Date.now() - startTime > maxWaitMs) {
        console.log('Render timeout - using captured frames');
        break;
      }
      
      const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
      frameCount++;
      
      if (frameCount % (FRAME_RATE * 5) === 0) {
        const progressPct = Math.min(25 + (frameCount / (FRAME_RATE * 60)) * 55, 80);
        onProgress(Math.round(progressPct), `Recording... ${Math.round(frameCount / FRAME_RATE)}s`);
      }
      
      await new Promise(r => setTimeout(r, frameInterval));
    }
    
    console.log(`Captured ${frameCount} frames (${(frameCount/FRAME_RATE).toFixed(1)}s)`);
    
    await browser.close();
    browser = null;
    
    if (localServer) {
      localServer.close();
      localServer = null;
    }
    
    if (frameCount < 10) {
      throw new Error('Not enough frames captured');
    }
    
    onProgress(82, 'Compiling video');
    
    const videoDuration = frameCount / FRAME_RATE;
    const audioPath = path.join(tmpDir, 'audio.aac');
    let hasAudio = false;
    
    try {
      const concatList = path.join(tmpDir, 'concat.txt');
      const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4')).sort();
      if (videoFiles.length > 0) {
        const lines = videoFiles.map(f => `file '${path.join(videosDir, f)}'`).join('\n');
        fs.writeFileSync(concatList, lines);
        const concatAudioCmd = `ffmpeg -y -f concat -safe 0 -i ${concatList} -vn -acodec aac -b:a 128k -t ${videoDuration} ${audioPath} 2>/dev/null`;
        execSync(concatAudioCmd, { timeout: 30000 });
        if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 100) {
          hasAudio = true;
        }
      }
    } catch(e) {
      console.log('Audio extraction skipped:', e.message);
    }
    
    let ffmpegCmd;
    if (hasAudio) {
      ffmpegCmd = [
        'ffmpeg', '-y',
        '-framerate', String(FRAME_RATE),
        '-i', path.join(framesDir, 'frame_%06d.png'),
        '-i', audioPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        '-vf', `scale=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}`,
        outputPath,
      ].join(' ');
    } else {
      ffmpegCmd = [
        'ffmpeg', '-y',
        '-framerate', String(FRAME_RATE),
        '-i', path.join(framesDir, 'frame_%06d.png'),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-vf', `scale=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}`,
        outputPath,
      ].join(' ');
    }
    
    execSync(ffmpegCmd, { timeout: 120000 });
    
    onProgress(90, 'Video compiled');
    
    return outputPath;
  } catch (error) {
    console.error('Format render error:', error);
    throw error;
  } finally {
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
    if (localServer) {
      try { localServer.close(); } catch(e) {}
    }
  }
}

function cleanupRenderDir(jobId) {
  const tmpDir = path.join(os.tmpdir(), `render_${jobId}`);
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch(e) {}
}

module.exports = {
  renderFormatVideo,
  cleanupRenderDir,
  generateCubeHTML,
  generateFlipPagesHTML,
};
