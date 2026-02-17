const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROMIUM_PATH = execSync('which chromium 2>/dev/null || find /nix -name "chromium" -type f 2>/dev/null | head -1').toString().trim();
const FRAME_RATE = 12;
const VIEWPORT_WIDTH = 540;
const VIEWPORT_HEIGHT = 960;

function getVideoDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 10000 }
    ).toString();
    const data = JSON.parse(result);
    return parseFloat(data.format.duration) || 0;
  } catch (e) {
    console.log('ffprobe error:', e.message);
    return 0;
  }
}

function generateCubeHTML(videoUrls, videoDurations) {
  const CUBE_SIZE = 280;

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
    .cube-face canvas {
      width: 100%; height: 100%;
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
    const videoUrls = ${JSON.stringify(videoUrls)};
    const videoDurations = ${JSON.stringify(videoDurations)};
    const CANVAS_SIZE = ${CUBE_SIZE};
    
    const ROTATION_PATH = [
      { faceId: 0, rotX: 0, rotY: 0 },
      { faceId: 2, rotX: 12, rotY: -90 },
      { faceId: 1, rotX: -35, rotY: -180 },
      { faceId: 3, rotX: 10, rotY: -270 },
    ];
    const HALF_ANGLE = 45;
    
    const videoElements = [];
    const canvasElements = [];
    const ctxElements = [];
    
    let cumulativeTimes = [];
    let totalDuration = 0;
    
    function init() {
      let cumTime = 0;
      for (let i = 0; i < videoUrls.length; i++) {
        cumulativeTimes.push(cumTime);
        cumTime += videoDurations[i];
      }
      totalDuration = cumTime;
      
      for (let i = 0; i < videoUrls.length; i++) {
        const video = document.createElement('video');
        video.src = videoUrls[i];
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.style.display = 'none';
        document.body.appendChild(video);
        videoElements.push(video);
      }
      
      [0,1,2,3,4,5].forEach(faceId => {
        const el = document.getElementById('face-' + faceId);
        const canvas = document.createElement('canvas');
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        el.appendChild(canvas);
        canvasElements[faceId] = canvas;
        ctxElements[faceId] = canvas.getContext('2d');
        ctxElements[faceId].fillStyle = '#000';
        ctxElements[faceId].fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      });
    }
    
    function getFaceForIndex(idx) { return ROTATION_PATH[idx % 4].faceId; }
    function getTargetRotation(idx) {
      const cycle = Math.floor(idx / 4);
      const step = ROTATION_PATH[idx % 4];
      return { rotX: step.rotX, rotY: step.rotY - (cycle * 360) };
    }
    
    function getVideoAtTime(globalTime) {
      for (let i = videoUrls.length - 1; i >= 0; i--) {
        if (globalTime >= cumulativeTimes[i]) {
          const localTime = globalTime - cumulativeTimes[i];
          const dur = videoDurations[i];
          if (localTime <= dur) {
            return { videoIndex: i, localTime: Math.min(localTime, dur - 0.01) };
          }
        }
      }
      return { videoIndex: videoUrls.length - 1, localTime: videoDurations[videoDurations.length - 1] - 0.01 };
    }
    
    function drawVideoOnFace(videoIndex, faceId) {
      const video = videoElements[videoIndex];
      const ctx = ctxElements[faceId];
      if (!ctx || !video) return;
      
      if (video.readyState >= 2) {
        const vw = video.videoWidth || CANVAS_SIZE;
        const vh = video.videoHeight || CANVAS_SIZE;
        const scale = Math.max(CANVAS_SIZE / vw, CANVAS_SIZE / vh);
        const sw = vw * scale;
        const sh = vh * scale;
        const sx = (CANVAS_SIZE - sw) / 2;
        const sy = (CANVAS_SIZE - sh) / 2;
        ctx.drawImage(video, sx, sy, sw, sh);
      }
    }
    
    window.__seekAndDraw = function(globalTime) {
      return new Promise(async (resolve) => {
        if (globalTime >= totalDuration) {
          resolve({ done: true });
          return;
        }
        
        const { videoIndex, localTime } = getVideoAtTime(globalTime);
        const video = videoElements[videoIndex];
        
        const faceId = getFaceForIndex(videoIndex);
        
        if (video.readyState < 2) {
          await new Promise((r) => {
            if (video.readyState >= 2) { r(); return; }
            video.oncanplay = () => { video.oncanplay = null; r(); };
            setTimeout(r, 5000);
          });
        }
        
        if (Math.abs(video.currentTime - localTime) > 0.05) {
          await new Promise((r) => {
            video.onseeked = () => { video.onseeked = null; r(); };
            video.currentTime = localTime;
            setTimeout(r, 1000);
          });
        }
        
        drawVideoOnFace(videoIndex, faceId);
        
        const prevVideoIndex = videoIndex > 0 ? videoIndex - 1 : null;
        const nextVideoIndex = videoIndex < videoUrls.length - 1 ? videoIndex + 1 : null;
        if (prevVideoIndex !== null) {
          drawVideoOnFace(prevVideoIndex, getFaceForIndex(prevVideoIndex));
        }
        if (nextVideoIndex !== null) {
          const nextVideo = videoElements[nextVideoIndex];
          if (nextVideo.readyState >= 2) {
            drawVideoOnFace(nextVideoIndex, getFaceForIndex(nextVideoIndex));
          }
        }
        
        const dur = videoDurations[videoIndex];
        const videoProgress = dur > 0 ? Math.min(localTime / dur, 1) : 0;
        
        const fromTarget = getTargetRotation(videoIndex);
        const toTarget = getTargetRotation(videoIndex + 1);
        const ease = videoProgress < 0.5 ? 2*videoProgress*videoProgress : 1 - Math.pow(-2*videoProgress+2,2)/2;
        
        const fromRotX = fromTarget.rotX;
        const fromRotY = fromTarget.rotY + HALF_ANGLE;
        const toRotX = toTarget.rotX;
        const toRotY = toTarget.rotY + HALF_ANGLE;
        
        const currentRotX = fromRotX + (toRotX - fromRotX) * ease;
        const currentRotY = fromRotY + (toRotY - fromRotY) * ease;
        
        const elapsed = globalTime;
        const floatX = Math.sin(elapsed * 0.5) * 22 + Math.sin(elapsed * 0.3) * 13;
        const floatY = Math.sin(elapsed * 0.4 + 1) * 26 + Math.cos(elapsed * 0.25) * 16;
        const floatZ = Math.sin(elapsed * 0.35 + 2) * 38 + Math.cos(elapsed * 0.2) * 20;
        const depthPhase1 = Math.sin(elapsed * 0.15) * 0.22;
        const depthPhase2 = Math.sin(elapsed * 0.4 + 1.5) * 0.11;
        const depthScale = 0.95 + depthPhase1 + depthPhase2;
        const depthTranslateZ = Math.sin(elapsed * 0.18 + 2) * 110 + Math.cos(elapsed * 0.12) * 70;
        
        const spinWrapper = document.getElementById('spin-wrapper');
        const floatWrapper = document.getElementById('float-wrapper');
        if (spinWrapper) spinWrapper.style.transform = 'rotateX('+currentRotX+'deg) rotateY('+currentRotY+'deg)';
        if (floatWrapper) floatWrapper.style.transform = 'translate3d('+floatX+'px,'+floatY+'px,'+(floatZ+depthTranslateZ)+'px) scale('+depthScale+')';
        
        resolve({ done: false, videoIndex, localTime: localTime.toFixed(2), faceId });
      });
    };
    
    window.__loadAllVideos = function() {
      return Promise.all(videoElements.map((v, i) => {
        return new Promise((resolve) => {
          if (v.readyState >= 2) { resolve(true); return; }
          v.oncanplay = () => { v.oncanplay = null; resolve(true); };
          v.onerror = () => { resolve(false); };
          v.load();
          setTimeout(() => resolve(v.readyState >= 2), 15000);
        });
      }));
    };
    
    window.__getTotalDuration = function() { return totalDuration; };
    window.__ready = false;
    
    init();
    window.__loadAllVideos().then(() => {
      window.__ready = true;
      console.log('READY: all videos loaded, totalDuration=' + totalDuration);
    });
  </script>
</body>
</html>`;
}

function generateFlipPagesHTML(videoUrls, storyName, videoDurations) {
  const PAGE_WIDTH = 280;
  const PAGE_HEIGHT = PAGE_WIDTH * 1.4;
  const safeStoryName = (storyName || 'My Story').replace(/'/g, "\\'").replace(/"/g, '&quot;');

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
    .page canvas {
      width: 100%; height: 100%; object-fit: cover;
      border-radius: 4px 8px 8px 4px;
    }
    .page.flipped { transform: rotateY(180deg); }
    .book-cover {
      position: absolute; width: 100%; height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
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
    .book-cover-back-face {
      transform: rotateY(-180deg);
      background: linear-gradient(145deg, #654321, #3E2508);
    }
    .book-cover.opened { transform: rotateY(180deg); }
  </style>
</head>
<body>
  <div class="book-container" id="book-container">
    <div class="book-cover-back"></div>
    <div class="page-edges"></div>
    <div class="book-spine"></div>
    <div class="book-cover" id="book-cover">
      <div class="book-cover-face book-cover-front-face">
        <div class="cover-border"></div>
        <div class="cover-border-inner"></div>
        <div class="cover-ornament"></div>
        <div class="cover-title">${safeStoryName}</div>
        <div class="cover-ornament"></div>
      </div>
      <div class="book-cover-face book-cover-back-face"></div>
    </div>
  </div>
  <script>
    const videoUrls = ${JSON.stringify(videoUrls)};
    const videoDurations = ${JSON.stringify(videoDurations)};
    const PAGE_WIDTH = ${PAGE_WIDTH};
    const PAGE_HEIGHT = ${PAGE_HEIGHT};
    
    const videoElements = [];
    const pages = [];
    let totalDuration = 0;
    let cumulativeTimes = [];
    const COVER_OPEN_TIME = 2.0;
    const PAGE_FLIP_TIME = 1.2;
    
    function init() {
      let cumTime = COVER_OPEN_TIME;
      for (let i = 0; i < videoUrls.length; i++) {
        cumulativeTimes.push(cumTime);
        cumTime += videoDurations[i] + PAGE_FLIP_TIME;
      }
      totalDuration = cumTime;
      
      for (let i = 0; i < videoUrls.length; i++) {
        const video = document.createElement('video');
        video.src = videoUrls[i];
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.style.display = 'none';
        document.body.appendChild(video);
        videoElements.push(video);
      }
      
      const container = document.getElementById('book-container');
      for (let i = 0; i < videoUrls.length; i++) {
        const page = document.createElement('div');
        page.className = 'page';
        page.style.zIndex = String(videoUrls.length - i + 10);
        page.id = 'page-' + i;
        
        const front = document.createElement('div');
        front.className = 'page-front';
        const canvas = document.createElement('canvas');
        canvas.width = PAGE_WIDTH;
        canvas.height = PAGE_HEIGHT;
        canvas.id = 'canvas-' + i;
        front.appendChild(canvas);
        
        const back = document.createElement('div');
        back.className = 'page-back';
        
        page.appendChild(front);
        page.appendChild(back);
        container.appendChild(page);
        
        pages.push({ page, canvas, ctx: canvas.getContext('2d') });
      }
    }
    
    function drawVideoOnCanvas(videoIndex) {
      const video = videoElements[videoIndex];
      const { ctx } = pages[videoIndex];
      if (!ctx || !video || video.readyState < 2) return;
      
      const vw = video.videoWidth || PAGE_WIDTH;
      const vh = video.videoHeight || PAGE_HEIGHT;
      const scale = Math.max(PAGE_WIDTH / vw, PAGE_HEIGHT / vh);
      const sw = vw * scale;
      const sh = vh * scale;
      const sx = (PAGE_WIDTH - sw) / 2;
      const sy = (PAGE_HEIGHT - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh);
    }
    
    window.__seekAndDraw = function(globalTime) {
      return new Promise(async (resolve) => {
        if (globalTime >= totalDuration) {
          resolve({ done: true });
          return;
        }
        
        const cover = document.getElementById('book-cover');
        if (globalTime < COVER_OPEN_TIME) {
          const progress = globalTime / COVER_OPEN_TIME;
          const angle = Math.min(progress * 180, 180);
          if (cover) cover.style.transform = 'rotateY(' + angle + 'deg)';
          resolve({ done: false, phase: 'cover', progress: progress.toFixed(2) });
          return;
        }
        
        if (cover && cover.style.transform !== 'rotateY(180deg)') {
          cover.style.transform = 'rotateY(180deg)';
        }
        
        let activeVideoIndex = -1;
        for (let i = videoUrls.length - 1; i >= 0; i--) {
          if (globalTime >= cumulativeTimes[i]) {
            activeVideoIndex = i;
            break;
          }
        }
        if (activeVideoIndex < 0) activeVideoIndex = 0;
        
        const videoStartTime = cumulativeTimes[activeVideoIndex];
        const timeSinceStart = globalTime - videoStartTime;
        const dur = videoDurations[activeVideoIndex];
        
        for (let i = 0; i < activeVideoIndex; i++) {
          const pg = pages[i];
          if (pg && !pg.page.classList.contains('flipped')) {
            pg.page.classList.add('flipped');
            pg.page.style.transition = 'none';
          }
        }
        
        if (timeSinceStart <= dur) {
          const localTime = Math.min(timeSinceStart, dur - 0.01);
          const video = videoElements[activeVideoIndex];
          
          if (video.readyState < 2) {
            await new Promise((r) => {
              if (video.readyState >= 2) { r(); return; }
              video.oncanplay = () => { video.oncanplay = null; r(); };
              setTimeout(r, 5000);
            });
          }
          
          if (Math.abs(video.currentTime - localTime) > 0.05) {
            await new Promise((r) => {
              video.onseeked = () => { video.onseeked = null; r(); };
              video.currentTime = localTime;
              setTimeout(r, 1000);
            });
          }
          
          drawVideoOnCanvas(activeVideoIndex);
          resolve({ done: false, videoIndex: activeVideoIndex, localTime: localTime.toFixed(2) });
        } else {
          const flipProgress = Math.min((timeSinceStart - dur) / PAGE_FLIP_TIME, 1);
          const pg = pages[activeVideoIndex];
          if (pg) {
            const angle = flipProgress * 180;
            pg.page.style.transition = 'none';
            pg.page.style.transform = 'rotateY(' + angle + 'deg)';
          }
          resolve({ done: false, phase: 'flip', videoIndex: activeVideoIndex, flipProgress: flipProgress.toFixed(2) });
        }
      });
    };
    
    window.__loadAllVideos = function() {
      return Promise.all(videoElements.map((v, i) => {
        return new Promise((resolve) => {
          if (v.readyState >= 2) { resolve(true); return; }
          v.oncanplay = () => { v.oncanplay = null; resolve(true); };
          v.onerror = () => { resolve(false); };
          v.load();
          setTimeout(() => resolve(v.readyState >= 2), 15000);
        });
      }));
    };
    
    window.__getTotalDuration = function() { return totalDuration; };
    window.__ready = false;
    
    init();
    window.__loadAllVideos().then(() => {
      window.__ready = true;
      console.log('READY: all videos loaded, totalDuration=' + totalDuration);
    });
  </script>
</body>
</html>`;
}

async function downloadFile(url, destPath) {
  const https = require('https');
  const http = require('http');
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const request = mod.get(url, { timeout: 60000 }, (response) => {
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
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
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
    const videoDurations = [];
    
    for (let i = 0; i < videoUrls.length; i++) {
      const localPath = path.join(videosDir, `video_${i}.mp4`);
      console.log(`Downloading video ${i+1}/${videoUrls.length}...`);
      await downloadFile(videoUrls[i], localPath);
      
      const duration = getVideoDuration(localPath);
      console.log(`Video ${i}: duration=${duration}s, size=${fs.statSync(localPath).size} bytes`);
      videoDurations.push(duration > 0 ? duration : 5);
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
    if (format === 'flip-pages') {
      html = generateFlipPagesHTML(localUrls, storyName, videoDurations);
    } else {
      html = generateCubeHTML(localUrls, videoDurations);
    }
    
    onProgress(20, 'Loading animation');
    
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    
    onProgress(22, 'Waiting for videos to load');
    
    try {
      await page.waitForFunction('window.__ready === true', { timeout: 60000 });
      console.log('All videos loaded in browser');
    } catch (e) {
      console.log('Warning: video loading timeout, proceeding anyway');
    }
    
    const totalDuration = await page.evaluate(() => window.__getTotalDuration());
    console.log(`Total animation duration: ${totalDuration.toFixed(1)}s`);
    
    const totalFrames = Math.ceil(totalDuration * FRAME_RATE) + FRAME_RATE * 2;
    
    onProgress(25, 'Recording animation');
    
    let frameCount = 0;
    
    for (let f = 0; f < totalFrames; f++) {
      const globalTime = f / FRAME_RATE;
      
      const result = await page.evaluate(async (t) => {
        return await window.__seekAndDraw(t);
      }, globalTime);
      
      const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.jpg`);
      await page.screenshot({ path: framePath, type: 'jpeg', quality: 85 });
      frameCount++;
      
      if (result.done) {
        for (let extra = 0; extra < FRAME_RATE; extra++) {
          const extraPath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.jpg`);
          await page.screenshot({ path: extraPath, type: 'jpeg', quality: 85 });
          frameCount++;
        }
        break;
      }
      
      if (frameCount % (FRAME_RATE * 5) === 0) {
        const progressPct = Math.min(25 + (f / totalFrames) * 55, 80);
        onProgress(Math.round(progressPct), `Recording... ${Math.round(globalTime)}s / ${Math.round(totalDuration)}s`);
      }
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
    
    const videoDurationSecs = frameCount / FRAME_RATE;
    const audioPath = path.join(tmpDir, 'audio.aac');
    let hasAudio = false;
    
    try {
      const concatList = path.join(tmpDir, 'concat.txt');
      const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4')).sort();
      if (videoFiles.length > 0) {
        const lines = videoFiles.map(f => `file '${path.join(videosDir, f)}'`).join('\n');
        fs.writeFileSync(concatList, lines);
        const concatAudioCmd = `ffmpeg -y -f concat -safe 0 -i ${concatList} -vn -acodec aac -b:a 128k -t ${videoDurationSecs} ${audioPath} 2>/dev/null`;
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
        '-i', path.join(framesDir, 'frame_%06d.jpg'),
        '-i', audioPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
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
        '-i', path.join(framesDir, 'frame_%06d.jpg'),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-vf', `scale=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}`,
        outputPath,
      ].join(' ');
    }
    
    execSync(ffmpegCmd, { timeout: 300000 });
    
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
