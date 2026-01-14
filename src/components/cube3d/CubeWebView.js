import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

const CUBE_HTML_DIR = FileSystem.cacheDirectory + 'cube/';

const CubeWebView = ({
  faces = [],
  autoRotate = true,
  rotationSpeed = 12000,
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  onPlaybackStart,
  onPlaybackComplete,
  onReadyToPlay,
  isFullscreen = false,
  currentPlayingFaceIndex = -1,
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlFilePath, setHtmlFilePath] = useState(null);

  const cubeHTML = useMemo(() => {
    const facesJSON = JSON.stringify(faces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      thumbnailUrl: face?.thumbnailUrl || face?.posterThumbUri || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
    })));

    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden;
      background: #000;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
    }
    .space-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%);
      z-index: 0;
    }
    .stars {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
    .stars-layer {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    .stars-layer-1 {
      background-image: 
        radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.9) 0%, transparent 100%),
        radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 40% 15%, rgba(255,255,255,0.8) 0%, transparent 100%),
        radial-gradient(1px 1px at 55% 70%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(2px 2px at 70% 35%, rgba(255,255,255,0.9) 0%, transparent 100%),
        radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 15% 80%, rgba(255,255,255,0.8) 0%, transparent 100%),
        radial-gradient(1px 1px at 30% 90%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1px 1px at 50% 5%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(2px 2px at 65% 85%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.8) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 95% 50%, rgba(255,255,255,0.7) 0%, transparent 100%);
      animation: twinkle 4s ease-in-out infinite;
    }
    .stars-layer-2 {
      background-image: 
        radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(1px 1px at 35% 75%, rgba(255,255,255,0.4) 0%, transparent 100%),
        radial-gradient(1px 1px at 60% 25%, rgba(255,255,255,0.7) 0%, transparent 100%),
        radial-gradient(2px 2px at 75% 55%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.6) 0%, transparent 100%),
        radial-gradient(1px 1px at 45% 40%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 8% 95%, rgba(255,255,255,0.4) 0%, transparent 100%);
      animation: twinkle 6s ease-in-out infinite 2s;
    }
    .depth-grid {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        linear-gradient(rgba(255,107,157,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,107,157,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      transform: perspective(500px) rotateX(60deg);
      transform-origin: center 120%;
      z-index: 1;
      opacity: 0.5;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .scene {
      width: ${CUBE_SIZE}px; 
      height: ${CUBE_SIZE}px; 
      perspective: 800px;
      perspective-origin: 50% 50%;
      z-index: 10;
      position: relative;
    }
    .cube {
      width: 100%; 
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
    }
    .cube-face {
      position: absolute;
      width: ${CUBE_SIZE}px; 
      height: ${CUBE_SIZE}px;
      border: 4px solid rgba(255,255,255,0.7);
      border-radius: 16px;
      overflow: hidden;
      background: linear-gradient(145deg, rgba(255,107,157,0.95), rgba(192,111,187,0.95));
      box-shadow: 0 0 30px rgba(0,0,0,0.3);
    }
    .cube-face video,
    .cube-face img {
      width: 100%; 
      height: 100%;
      object-fit: cover;
      position: absolute;
      top: 0;
      left: 0;
    }
    .cube-face .placeholder {
      display: flex; 
      flex-direction: column;
      align-items: center; 
      justify-content: center;
      height: 100%; 
      color: white; 
      text-align: center;
    }
    .cube-face .placeholder .icon { font-size: 60px; margin-bottom: 12px; }
    .cube-face .placeholder .label { font-size: 18px; opacity: 0.9; font-weight: 600; }
    .player-badge {
      position: absolute;
      bottom: 12px;
      left: 12px;
      right: 12px;
      background: rgba(0,0,0,0.65);
      padding: 8px 12px;
      border-radius: 10px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      z-index: 10;
    }
    .front  { transform: rotateY(0deg) translateZ(${CUBE_SIZE/2}px); }
    .back   { transform: rotateY(180deg) translateZ(${CUBE_SIZE/2}px); }
    .right  { transform: rotateY(90deg) translateZ(${CUBE_SIZE/2}px); }
    .left   { transform: rotateY(-90deg) translateZ(${CUBE_SIZE/2}px); }
    .top    { transform: rotateX(90deg) translateZ(${CUBE_SIZE/2}px); }
    .bottom { transform: rotateX(-90deg) translateZ(${CUBE_SIZE/2}px); }
    @keyframes float {
      0% { 
        transform: translate3d(0, 0, 0);
      }
      10% { 
        transform: translate3d(15px, -20px, 40px);
      }
      25% { 
        transform: translate3d(-10px, -35px, 25px);
      }
      40% { 
        transform: translate3d(20px, -15px, -30px);
      }
      55% { 
        transform: translate3d(-25px, -30px, 50px);
      }
      70% { 
        transform: translate3d(10px, -10px, -20px);
      }
      85% { 
        transform: translate3d(-15px, -25px, 35px);
      }
      100% { 
        transform: translate3d(0, 0, 0);
      }
    }
    @keyframes spin {
      0% { 
        transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
      }
      12.5% { 
        transform: rotateX(25deg) rotateY(45deg) rotateZ(8deg);
      }
      25% { 
        transform: rotateX(45deg) rotateY(90deg) rotateZ(-5deg);
      }
      37.5% { 
        transform: rotateX(20deg) rotateY(135deg) rotateZ(12deg);
      }
      50% { 
        transform: rotateX(-30deg) rotateY(180deg) rotateZ(-8deg);
      }
      62.5% { 
        transform: rotateX(-15deg) rotateY(225deg) rotateZ(10deg);
      }
      75% { 
        transform: rotateX(35deg) rotateY(270deg) rotateZ(-6deg);
      }
      87.5% { 
        transform: rotateX(10deg) rotateY(315deg) rotateZ(5deg);
      }
      100% { 
        transform: rotateX(0deg) rotateY(360deg) rotateZ(0deg);
      }
    }
    .float-wrapper {
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
    }
    .spin-wrapper {
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
    }
    .play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.95);
      border: none;
      cursor: pointer;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .play-button:hover {
      transform: translate(-50%, -50%) scale(1.1);
      box-shadow: 0 6px 25px rgba(0,0,0,0.4);
    }
    .play-button:active {
      transform: translate(-50%, -50%) scale(0.95);
    }
    .play-button .play-icon {
      width: 0;
      height: 0;
      border-left: 28px solid #FF6B9D;
      border-top: 18px solid transparent;
      border-bottom: 18px solid transparent;
      margin-left: 6px;
    }
    .play-button.hidden {
      display: none;
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
  <button class="play-button hidden" id="play-button" onclick="handlePlayClick()">
    <div class="play-icon"></div>
  </button>
  <div class="scene">
    <div class="float-wrapper">
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
    let videos = [];
    let videoDurations = [];
    let animationStarted = false;
    let animationId = null;
    let totalDuration = 0;
    let cycleStartTime = 0;
    let lastFrontFace = -1;
    
    const DEFAULT_VIDEO_DURATION = 5;
    
    // Video queue system - tracks all videos and which have been played
    let videoQueue = [...faces]; // All videos in order
    let playedVideoIndices = new Set(); // Which video indices have finished playing
    let currentlyPlayingIndices = new Set(); // Which video indices are currently playing
    let faceToVideoIndex = {}; // Maps face ID to current video index
    let totalVideosToPlay = faces.filter(f => f && f.videoUrl).length;
    
    // Initialize face to video mapping (first 6 videos on 6 faces)
    faces.forEach((face, i) => {
      if (i < 6 && face && face.videoUrl) {
        faceToVideoIndex[i] = i;
        currentlyPlayingIndices.add(i); // Mark initial videos as "in use"
      }
    });
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function getFrontFaceFromRotation(rotX, rotY) {
      const normY = ((rotY % 360) + 360) % 360;
      const normX = ((rotX % 360) + 360) % 360;
      
      if (normX > 45 && normX < 135) return 5;
      if (normX > 225 && normX < 315) return 4;
      
      if (normY >= 315 || normY < 45) return 0;
      if (normY >= 45 && normY < 135) return 3;
      if (normY >= 135 && normY < 225) return 1;
      if (normY >= 225 && normY < 315) return 2;
      
      return 0;
    }
    
    function animate(timestamp) {
      if (!cycleStartTime) cycleStartTime = timestamp;
      
      const elapsed = (timestamp - cycleStartTime) / 1000;
      const progress = Math.min(elapsed / totalDuration, 1);
      
      if (progress >= 1) {
        console.log('All videos completed! Animation finished.');
        postMessage('allVideosComplete', {});
        videos.forEach(v => v.element.pause());
        animationStarted = false;
        showPlayButton();
        return;
      }
      
      const baseSpeed = 2 * Math.PI / totalDuration;
      
      const rotY = elapsed * baseSpeed * 57.3 * 1.5 + 
                   Math.sin(elapsed * 0.3) * 25 + 
                   Math.sin(elapsed * 0.7) * 15;
      
      const rotX = Math.sin(elapsed * 0.4) * 35 + 
                   Math.sin(elapsed * 0.15) * 20 +
                   Math.cos(elapsed * 0.25) * 10;
      
      const rotZ = Math.sin(elapsed * 0.2) * 12 + 
                   Math.cos(elapsed * 0.35) * 8;
      
      const floatX = Math.sin(elapsed * 0.5) * 25 + 
                     Math.sin(elapsed * 0.3) * 15;
      const floatY = Math.sin(elapsed * 0.4 + 1) * 30 + 
                     Math.cos(elapsed * 0.25) * 20;
      const floatZ = Math.sin(elapsed * 0.35 + 2) * 45 + 
                     Math.cos(elapsed * 0.2) * 25;
      
      // Z-depth movement - cube moves forward (closer/larger) and backward (farther/smaller)
      // Using multiple sine waves with different frequencies for varied trajectories
      const depthPhase1 = Math.sin(elapsed * 0.15) * 0.3;  // Slow deep wave
      const depthPhase2 = Math.sin(elapsed * 0.4 + 1.5) * 0.15;  // Medium wave
      const depthPhase3 = Math.cos(elapsed * 0.25 + 0.8) * 0.1;  // Subtle variation
      
      // Scale ranges from 0.6 (far away) to 1.3 (very close)
      // Base scale is 0.95, depth adds variation of ±0.35
      const depthScale = 0.95 + depthPhase1 + depthPhase2 + depthPhase3;
      
      // Additional Z translation for parallax depth effect (moves in 3D space)
      const depthTranslateZ = Math.sin(elapsed * 0.18 + 2) * 150 + 
                              Math.cos(elapsed * 0.12) * 100;
      
      const spinWrapper = document.getElementById('spin-wrapper');
      const floatWrapper = document.querySelector('.float-wrapper');
      
      if (spinWrapper) {
        spinWrapper.style.transform = 
          'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) rotateZ(' + rotZ + 'deg)';
      }
      
      if (floatWrapper) {
        floatWrapper.style.transform = 
          'translate3d(' + floatX + 'px, ' + floatY + 'px, ' + (floatZ + depthTranslateZ) + 'px) scale(' + depthScale + ')';
      }
      
      const currentFrontFace = getFrontFaceFromRotation(rotX, rotY);
      if (currentFrontFace !== lastFrontFace) {
        lastFrontFace = currentFrontFace;
        updateAudioForFace(currentFrontFace);
        postMessage('faceChanged', { faceIndex: currentFrontFace });
      }
      
      animationId = requestAnimationFrame(animate);
    }
    
    function updateAudioForFace(faceIndex) {
      videos.forEach(v => {
        if (v.faceId === faceIndex) {
          v.element.muted = false;
          v.element.volume = 1;
        } else {
          v.element.muted = true;
        }
      });
    }
    
    function startAnimation() {
      if (animationStarted) return;
      
      totalDuration = videoDurations.reduce((sum, d) => sum + (d || DEFAULT_VIDEO_DURATION), 0);
      if (totalDuration < 10) totalDuration = 30;
      
      console.log('Starting continuous animation. Total duration: ' + totalDuration + 's');
      postMessage('animationStarted', { totalDuration });
      
      animationStarted = true;
      cycleStartTime = 0;
      animationId = requestAnimationFrame(animate);
    }
    
    let isReady = false;
    
    function showPlayButton() {
      const btn = document.getElementById('play-button');
      if (btn) btn.classList.remove('hidden');
    }
    
    function hidePlayButton() {
      const btn = document.getElementById('play-button');
      if (btn) btn.classList.add('hidden');
    }
    
    function handlePlayClick() {
      if (!isReady) return;
      hidePlayButton();
      
      videos.forEach(v => {
        v.element.currentTime = 0;
        v.element.play().catch(() => {});
      });
      
      startAnimation();
    }
    
    function tryStartAnimation() {
      const validDurations = videoDurations.filter(d => d > 0);
      if (validDurations.length >= Math.min(faces.length, 4)) {
        isReady = true;
        console.log('Videos ready! Waiting for play button click.');
        postMessage('readyToPlay', { videoCount: validDurations.length });
        showPlayButton();
      }
    }
    
    function setFaceContent(faceId, face) {
      const el = document.getElementById('face-' + faceId);
      if (!el) return;
      
      const existingVideo = el.querySelector('video');
      if (existingVideo) {
        existingVideo.pause();
        existingVideo.src = '';
        existingVideo.load();
      }
      
      if (face.thumbnailUrl || face.videoUrl) {
        let html = '';
        
        if (face.thumbnailUrl) {
          html += '<img src="' + face.thumbnailUrl + '" alt="Thumbnail" />';
        }
        
        if (face.videoUrl) {
          html += '<video muted playsinline preload="auto" style="opacity:0"></video>';
        }
        
        html += '<div class="player-badge">' + (face.playerName || 'סרטון') + '</div>';
        el.innerHTML = html;
        
        const video = el.querySelector('video');
        if (video && face.videoUrl) {
          videos.push({ element: video, faceId, duration: 0 });
          
          let retryCount = 0;
          const maxRetries = 3;
          
          function tryPlay() {
            video.play().then(() => {
              video.style.opacity = '1';
            }).catch((e) => {
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryPlay, 500);
              }
            });
          }
          
          video.addEventListener('loadedmetadata', () => {
            const duration = video.duration || 0;
            videoDurations[faceId] = duration;
            console.log('Video ' + faceId + ' duration: ' + duration + 's');
            
            if (videoDurations.filter(d => d > 0).length >= Math.min(faces.length, 4)) {
              tryStartAnimation();
            }
          });
          
          video.addEventListener('loadeddata', () => {
            video.style.opacity = '1';
            postMessage('videoLoaded', { faceId });
          });
          
          video.addEventListener('canplay', () => {
          });
          
          video.addEventListener('error', (e) => {
            console.error('Video error on face ' + faceId + ':', e);
            postMessage('videoError', { faceId, error: e.message });
          });
          
          video.addEventListener('play', () => {
            video.style.opacity = '1';
            postMessage('videoStart', { faceId });
          });
          
          video.addEventListener('ended', () => {
            const videoIndex = faceToVideoIndex[faceId];
            console.log('Video ended on face ' + faceId + ', video index: ' + videoIndex);
            
            // Mark this video as played and no longer playing
            if (videoIndex !== undefined) {
              playedVideoIndices.add(videoIndex);
              currentlyPlayingIndices.delete(videoIndex);
            }
            
            postMessage('videoEnd', { faceId, videoIndex, playedCount: playedVideoIndices.size, totalVideos: totalVideosToPlay });
            
            // Check if all videos have been played
            if (playedVideoIndices.size >= totalVideosToPlay) {
              console.log('All ' + totalVideosToPlay + ' videos have been played!');
              postMessage('allVideosComplete', { playedCount: playedVideoIndices.size });
              return;
            }
            
            // Find next video that's not played AND not currently playing
            let nextVideoIndex = -1;
            for (let i = 0; i < videoQueue.length; i++) {
              if (!playedVideoIndices.has(i) && !currentlyPlayingIndices.has(i) && videoQueue[i] && videoQueue[i].videoUrl) {
                nextVideoIndex = i;
                break;
              }
            }
            
            // Load next video onto this face
            if (nextVideoIndex >= 0) {
              console.log('Loading video ' + nextVideoIndex + ' onto face ' + faceId);
              const nextVideo = videoQueue[nextVideoIndex];
              faceToVideoIndex[faceId] = nextVideoIndex;
              currentlyPlayingIndices.add(nextVideoIndex);
              
              // Update face content with new video
              loadNewVideoOnFace(faceId, nextVideo, nextVideoIndex);
            }
          });
          
          video.src = face.videoUrl;
          video.load();
        }
      } else {
        el.innerHTML = '<div class="placeholder"><span class="icon">🎬</span><span class="label">סרטון ' + (faceId + 1) + '</span></div>';
      }
    }
    
    function loadNewVideoOnFace(faceId, videoData, videoIndex) {
      const el = document.getElementById('face-' + faceId);
      if (!el || !videoData || !videoData.videoUrl) return;
      
      // Remove old video from videos array
      videos = videos.filter(v => v.faceId !== faceId);
      
      let html = '';
      if (videoData.thumbnailUrl) {
        html += '<img src="' + videoData.thumbnailUrl + '" alt="Thumbnail" />';
      }
      html += '<video muted playsinline preload="auto" style="opacity:0"></video>';
      html += '<div class="player-badge">' + (videoData.playerName || 'סרטון') + '</div>';
      el.innerHTML = html;
      
      const video = el.querySelector('video');
      if (video) {
        videos.push({ element: video, faceId, duration: 0, videoIndex });
        
        video.addEventListener('loadeddata', () => {
          video.style.opacity = '1';
          video.play().catch(() => {});
        });
        
        video.addEventListener('ended', () => {
          const vIdx = faceToVideoIndex[faceId];
          console.log('Video ended on face ' + faceId + ', video index: ' + vIdx);
          
          if (vIdx !== undefined) {
            playedVideoIndices.add(vIdx);
            currentlyPlayingIndices.delete(vIdx);
          }
          
          postMessage('videoEnd', { faceId, videoIndex: vIdx, playedCount: playedVideoIndices.size, totalVideos: totalVideosToPlay });
          
          if (playedVideoIndices.size >= totalVideosToPlay) {
            console.log('All ' + totalVideosToPlay + ' videos have been played!');
            postMessage('allVideosComplete', { playedCount: playedVideoIndices.size });
            return;
          }
          
          // Find next video that's not played AND not currently playing
          let nextIdx = -1;
          for (let i = 0; i < videoQueue.length; i++) {
            if (!playedVideoIndices.has(i) && !currentlyPlayingIndices.has(i) && videoQueue[i] && videoQueue[i].videoUrl) {
              nextIdx = i;
              break;
            }
          }
          
          if (nextIdx >= 0) {
            console.log('Loading video ' + nextIdx + ' onto face ' + faceId);
            faceToVideoIndex[faceId] = nextIdx;
            currentlyPlayingIndices.add(nextIdx);
            loadNewVideoOnFace(faceId, videoQueue[nextIdx], nextIdx);
          }
        });
        
        video.src = videoData.videoUrl;
        video.load();
      }
    }
    
    function init() {
      faces.forEach((face, index) => {
        setFaceContent(index, face);
      });
      
      postMessage('cubeReady', { faceCount: faces.filter(f => f.videoUrl).length });
    }
    
    window.updateFaces = function(newFaces) {
      newFaces.forEach((face, index) => {
        setFaceContent(index, face);
      });
    };
    
    window.pauseCube = function() {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };
    
    window.resumeCube = function() {
      if (!animationId && animationStarted) {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    init();
  </script>
</body>
</html>
    `;
  }, [faces]);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'cubeReady':
          setIsLoading(false);
          break;
        case 'faceChange':
        case 'faceChanged':
          onFaceChange?.(data.faceIndex || data.faceId);
          break;
        case 'videoStart':
          onVideoStart?.(data.faceId);
          break;
        case 'videoEnd':
          onVideoEnd?.(data.faceId);
          break;
        case 'readyToPlay':
          console.log('🎬 Cube ready to play');
          onReadyToPlay?.();
          break;
        case 'animationStarted':
          console.log('▶️ Cube playback started');
          onPlaybackStart?.();
          break;
        case 'allVideosComplete':
          console.log('✅ Cube playback complete');
          onPlaybackComplete?.();
          break;
      }
    } catch (e) {
      console.warn('WebView message parse error:', e);
    }
  }, [onFaceChange, onVideoStart, onVideoEnd, onReadyToPlay, onPlaybackStart, onPlaybackComplete]);

  useEffect(() => {
    if (webViewRef.current) {
      const js = autoRotate ? 'window.resumeCube && window.resumeCube();' : 'window.pauseCube && window.pauseCube();';
      webViewRef.current.injectJavaScript(js + 'true;');
    }
  }, [autoRotate]);

  useEffect(() => {
    if (webViewRef.current && rotationSpeed > 0) {
      webViewRef.current.injectJavaScript(`window.setRotationSpeed && window.setRotationSpeed(${rotationSpeed}); true;`);
    }
  }, [rotationSpeed]);

  // Dynamically update faces when new videos are ready
  useEffect(() => {
    if (webViewRef.current && faces.some(f => f?.videoUrl)) {
      const facesData = faces.map((face, index) => ({
        index,
        videoUrl: face?.videoUrl || null,
        thumbnailUrl: face?.thumbnailUrl || face?.posterThumbUri || null,
        playerName: face?.playerName || `סרטון ${index + 1}`,
      }));
      const js = `window.updateFaces && window.updateFaces(${JSON.stringify(facesData)}); true;`;
      webViewRef.current.injectJavaScript(js);
      console.log('🔄 Injected updated faces:', facesData.filter(f => f.videoUrl).length, 'videos');
    }
  }, [faces]);

  useEffect(() => {
    const saveHtmlToFile = async () => {
      if (Platform.OS === 'web') {
        return;
      }
      
      try {
        const dirInfo = await FileSystem.getInfoAsync(CUBE_HTML_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(CUBE_HTML_DIR, { intermediates: true });
        }
        
        const htmlPath = CUBE_HTML_DIR + 'index.html';
        await FileSystem.writeAsStringAsync(htmlPath, cubeHTML, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        setHtmlFilePath(htmlPath);
        console.log('📄 Cube HTML saved to:', htmlPath);
      } catch (err) {
        console.warn('Failed to save HTML to file:', err);
      }
    };
    
    if (cubeHTML && faces.some(f => f?.videoUrl)) {
      saveHtmlToFile();
    }
  }, [cubeHTML, faces]);

  const webViewSource = useMemo(() => {
    if (Platform.OS === 'web' || !htmlFilePath) {
      return { html: cubeHTML };
    }
    return { uri: htmlFilePath };
  }, [cubeHTML, htmlFilePath]);

  const baseUrl = Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined;

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={[styles.webView, isFullscreen && styles.fullscreenWebView]}
        onMessage={onMessage}
        onError={(e) => setError(e.nativeEvent.description)}
        onLoad={() => setIsLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*', 'file://*']}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scalesPageToFit={false}
        useWebKit={true}
        allowsFullscreenVideo={false}
        mixedContentMode="always"
        cacheEnabled={false}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        allowingReadAccessToURL={baseUrl}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>טוען קוביה...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>שגיאה בטעינה</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CUBE_SIZE + 40,
    height: CUBE_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 999,
  },
  webView: {
    width: CUBE_SIZE + 40,
    height: CUBE_SIZE + 40,
    backgroundColor: 'transparent',
  },
  fullscreenWebView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 157, 0.2)',
    borderRadius: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#FF6B9D',
    fontSize: 16,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 20,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CubeWebView;
