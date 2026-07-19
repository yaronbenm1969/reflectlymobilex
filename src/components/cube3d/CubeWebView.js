import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

const CUBE_HTML_DIR = FileSystem.cacheDirectory + 'cube_v4/';

const CubeWebView = ({
  faces = [],
  storyName = '',
  autoRotate = true,
  rotationSpeed = 12000,
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  onPlaybackStart,
  onPlaybackComplete,
  onReadyToPlay,
  onRecordingSupport,
  onRecordingComplete,
  onRecordingProgress,
  isFullscreen = false,
  currentPlayingFaceIndex = -1,
  triggerAutoPlay = false,
  recordNextPlayback = false,
  backgroundUrl = null,
  backgroundMediaType = 'video',
  musicUrl = null,
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlFilePath, setHtmlFilePath] = useState(null);
  
  const [initialFaces, setInitialFaces] = useState(null);
  const hasInitializedRef = useRef(false);
  const webViewKeyRef = useRef(Date.now());
  
  const recordingChunksRef = useRef([]);
  const recordingMetaRef = useRef(null);
  const [logoDataUri, setLogoDataUri] = useState('');


  useEffect(() => {
    async function loadLogo() {
      try {
        const asset = await Asset.fromModule(require('../../../assets/logo.png')).downloadAsync();
        if (asset.localUri) {
          const b64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
          setLogoDataUri(`data:image/png;base64,${b64}`);
        }
      } catch (e) {
        console.warn('Could not load logo for cube face:', e);
      }
    }
    loadLogo();
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    const first4 = faces.slice(0, 4);
    const minRequired = Math.min(4, faces.length);
    const readyCount = first4.filter(f => f?.videoUrl).length;

    // Wait for logoDataUri so cubeHTML is only generated once (avoids WebView reload mid-play)
    if (!logoDataUri) return;

    if (minRequired > 0 && readyCount >= minRequired) {
      console.log(`🎲 All ${minRequired} initial videos ready - initializing cube`);
      hasInitializedRef.current = true;
      setInitialFaces([...faces]);
    }
  }, [faces, logoDataUri]);

  useEffect(() => {
    if (!hasInitializedRef.current || !initialFaces || !webViewRef.current) return;
    const newFaces = faces.filter(f => f?.videoUrl).slice(initialFaces.length);
    if (newFaces.length > 0) {
      const newVideos = newFaces.map((face, i) => ({
        index: initialFaces.length + i,
        videoUrl: face.videoUrl,
        playerName: face?.playerName || `סרטון ${initialFaces.length + i + 1}`,
      }));
      console.log(`🎲 Sending ${newVideos.length} additional videos to cube WebView`);
      webViewRef.current.injectJavaScript(`
        if (window.addVideosToQueue) {
          window.addVideosToQueue(${JSON.stringify(newVideos)});
        }
        true;
      `);
      setInitialFaces([...faces]);
    }
  }, [faces, initialFaces]);

  useEffect(() => {
    if (triggerAutoPlay && webViewRef.current) {
      console.log('🎲 Auto-play triggered via prop');
      webViewRef.current.injectJavaScript(`
        if (typeof handlePlayClick === 'function') {
          hasUserStarted = false;
          isPlaying = false;
          handlePlayClick();
        }
        true;
      `);
    }
  }, [triggerAutoPlay]);

  useEffect(() => {
    if (recordNextPlayback && webViewRef.current) {
      console.log('📹 Enabling recording for next playback');
      const safeMusicUrl = musicUrl ? musicUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
      webViewRef.current.injectJavaScript(`
        window._recEnabled = true;
        ${safeMusicUrl ? `window._musicUrl = '${safeMusicUrl}'; if (typeof window._preloadMusic === 'function') { window._preloadMusic('${safeMusicUrl}'); }` : ''}
        true;
      `);
    }
  }, [recordNextPlayback]);

  // Use initial faces for HTML generation - prevents WebView reload on face updates
  const cubeHTML = useMemo(() => {
    if (!initialFaces || initialFaces.length === 0) return null;

    const facesJSON = JSON.stringify(initialFaces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
    })));

    // Safe background URL — strip single quotes to avoid template injection
    const safeBgUrl = (backgroundUrl || '').replace(/'/g, '');
    // Logo data URI (base64 embedded — safe to use directly in HTML)
    const safeLogoDataUri = logoDataUri || '';
    const bgHtml = safeBgUrl
      ? (backgroundMediaType === 'image'
          ? `<img id="custom-bg" src="${safeBgUrl}" style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;" />`
          : `<video id="custom-bg" crossorigin="anonymous" src="${safeBgUrl}" autoplay loop muted playsinline style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;"></video>`)
      : `<div class="space-bg"></div>
  <div class="stars">
    <div class="stars-layer stars-layer-1"></div>
    <div class="stars-layer stars-layer-2"></div>
  </div>
  <div class="depth-grid"></div>`;

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
      background: ${safeBgUrl ? 'transparent' : '#000'};
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
    .cube-face video {
      width: 100%; 
      height: 100%;
      object-fit: cover;
      position: absolute;
      top: 0;
      left: 0;
      background: #000;
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
    .replay-button {
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
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .replay-button:hover {
      transform: translate(-50%, -50%) scale(1.1);
      box-shadow: 0 6px 25px rgba(0,0,0,0.4);
    }
    .replay-button:active {
      transform: translate(-50%, -50%) scale(0.95);
    }
    .replay-button .replay-icon {
      font-size: 36px;
      color: #FF6B9D;
    }
    .replay-button.hidden {
      display: none;
    }
    .face-intro {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #0d0a1e 0%, #1a0a2e 100%);
      z-index: 2;
      pointer-events: none;
    }
    .face-intro-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin-bottom: 14px;
      border-radius: 18px;
    }
    .face-intro-label {
      color: #FF6B9D;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    .face-intro-text {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7);
      letter-spacing: 0.3px;
      line-height: 1.3;
      word-break: break-word;
      text-align: center;
      padding: 0 20px;
    }
    .face-intro.hidden {
      display: none;
    }
  </style>
</head>
<body>
  ${bgHtml}
  <button class="play-button hidden" id="play-button" onclick="handlePlayClick()">
    <div class="play-icon"></div>
  </button>
  <button class="replay-button hidden" id="replay-button" onclick="handleReplayClick()">
    <div class="replay-icon">↻</div>
  </button>
  <div class="scene">
    <div class="float-wrapper">
      <div class="spin-wrapper" id="spin-wrapper">
        <div class="cube" id="cube">
          <div class="cube-face front" id="face-0">
            <div class="face-intro" id="face-intro">
              ${safeLogoDataUri ? `<img class="face-intro-logo" src="${safeLogoDataUri}" />` : '<span class="face-intro-label">Reflectly</span>'}
              <span class="face-intro-text" id="face-intro-text"></span>
            </div>
          </div>
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
    // ============ MINIMAL CUBE V2 ============
    // Simple state machine: currentIndex triggers everything
    // Rotation only happens when video 'ended' fires
    
    const faces = ${facesJSON};
    const storyTitle = '${(storyName || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')}';
    const logoDataUri = '${safeLogoDataUri}';
    (function() { var el = document.getElementById('face-intro-text'); if (el) el.textContent = storyTitle; })();
    let fullVideoQueue = faces.filter(f => f && f.videoUrl);
    
    window.addVideosToQueue = function(newVideos) {
      newVideos.forEach(function(v) {
        fullVideoQueue.push(v);
      });
      console.log('🎲 Queue updated: now ' + fullVideoQueue.length + ' videos');
    };
    
    // 4-face rotation path with dynamic tilt for visual interest
    // iOS WebView cannot render video on rotateX faces, so we use only side faces
    // but add slight X rotation for depth effect while keeping video on working faces
    const ROTATION_PATH = [
      { faceId: 0, rotX: 0, rotY: 0 },         // Front - straight
      { faceId: 2, rotX: 12, rotY: -90 },      // Right - slight tilt up
      { faceId: 1, rotX: -35, rotY: -180 },    // Top-tilt - looking down at cube (pseudo-top)
      { faceId: 3, rotX: 10, rotY: -270 },     // Left - slight tilt up
    ];
    
    // STATE
    let currentIndex = 0;          // Current video in queue
    let isPlaying = false;         // Is playback active?
    let isRotating = false;        // Is rotation animation in progress?
    let faceVideos = {};           // faceId -> { element, queueIdx }
    let floatAnimId = null;        // Float animation frame ID
    let floatStartTime = 0;        // Float animation start
    
    // Current rotation angles
    let currentRotX = 0;
    let currentRotY = 0;
    
    console.log('🎲 Cube V2 init: ' + fullVideoQueue.length + ' videos');
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    // Get which physical face should show video at queueIdx
    function getFaceForIndex(queueIdx) {
      return ROTATION_PATH[queueIdx % 4].faceId;
    }
    
    // Get target rotation for queueIdx
    function getTargetRotation(queueIdx) {
      const cycleNum = Math.floor(queueIdx / 4);
      const step = ROTATION_PATH[queueIdx % 4];
      return {
        rotX: step.rotX,
        rotY: step.rotY - (cycleNum * 360)
      };
    }
    
    // ============ VIDEO LOADING ============
    // Persistent video elements - created once, src changed
    let faceVideoElements = {}; // faceId -> video element (persistent)
    
    // Initialize video elements once on each face
    function initFaceVideoElements() {
      [0, 1, 2, 3].forEach(faceId => {
        const el = document.getElementById('face-' + faceId);
        if (el && !faceVideoElements[faceId]) {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('crossorigin', 'anonymous');
          video.crossOrigin = 'anonymous';
          video.preload = 'auto';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          el.appendChild(video);
          faceVideoElements[faceId] = video;
          console.log('📺 Created persistent video element on face ' + faceId);
        }
      });
      
      // Add thumbnail images to top and bottom faces for visual effect during tilts
      initTopBottomFaces();

      // Start with top face visible (title card shown before playback)
      const sw = document.getElementById('spin-wrapper');
      if (sw) { currentRotX = -90; currentRotY = 0; sw.style.transition = 'none'; sw.style.transform = 'rotateX(-90deg) rotateY(0deg)'; }
    }
    
    // Populate top/bottom faces - bottom gets a title card, top gets a gradient
    function initTopBottomFaces() {
      const topFace = document.getElementById('face-4');
      const bottomFace = document.getElementById('face-5');

      var logoEl = logoDataUri ? '<img class="face-intro-logo" src="' + logoDataUri + '" />' : '<span class="face-intro-label">Reflectly</span>';

      // Bottom face: title card (shown when cube tilts to reveal it at end)
      if (bottomFace && !bottomFace.querySelector('.face-intro')) {
        const div = document.createElement('div');
        div.className = 'face-intro';
        div.style.transform = 'rotate(180deg)';
        div.innerHTML = logoEl + (storyTitle ? '<span class="face-intro-text">' + storyTitle + '</span>' : '');
        bottomFace.appendChild(div);
        console.log('🎬 Title card added to BOTTOM face');
      }

      // Top face: title card (shown at beginning before playback starts)
      if (topFace && !topFace.querySelector('.face-intro')) {
        const div = document.createElement('div');
        div.className = 'face-intro';
        div.innerHTML = logoEl + (storyTitle ? '<span class="face-intro-text">' + storyTitle + '</span>' : '');
        topFace.appendChild(div);
        console.log('🎬 Title card added to TOP face');
      }
    }
    
    // Load video onto a face - reuses existing video element, waits for canplay
    function loadVideoOnFace(faceId, queueIdx) {
      return new Promise((resolve, reject) => {
        if (queueIdx >= fullVideoQueue.length) {
          reject('No video at index ' + queueIdx);
          return;
        }
        
        const videoData = fullVideoQueue[queueIdx];
        const video = faceVideoElements[faceId];
        
        if (!video) {
          reject('No video element on face ' + faceId);
          return;
        }
        
        // Check if already loaded with correct video
        if (faceVideos[faceId] && faceVideos[faceId].queueIdx === queueIdx && video.readyState >= 2) {
          console.log('📹 Face ' + faceId + ' already has queue[' + queueIdx + '] ready');
          resolve(video);
          return;
        }
        
        const videoUrl = videoData.videoUrl;
        
        // Clean up old listeners
        video.oncanplay = null;
        video.onerror = null;
        video.onloadedmetadata = null;
        video.ontimeupdate = null;
        video.onwaiting = null;
        video.onplaying = null;
        
        let resolved = false;

        function doResolve() {
          if (resolved) return;
          resolved = true;
          video.oncanplaythrough = null;
          video.oncanplay = null;
          video.onerror = null;
          // Tiny seek to trigger iOS to paint first frame
          video.currentTime = 0.001;
          console.log('📹 Face ' + faceId + ' READY: queue[' + queueIdx + '] dur=' + (video.duration || 0).toFixed(1) + 's readyState=' + video.readyState);
          resolve(video);
        }

        // canplaythrough = browser has enough data to play without mid-video stall
        // This is the key fix for first-playback freezes (network load vs cache)
        video.oncanplaythrough = function() { doResolve(); };

        // canplay fallback: if canplaythrough never fires (some iOS builds),
        // wait an extra 800ms to let the buffer fill a bit more, then resolve anyway
        video.oncanplay = function() {
          setTimeout(function() { doResolve(); }, 800);
        };

        video.onerror = function() {
          if (resolved) return;
          resolved = true;
          video.oncanplaythrough = null;
          video.oncanplay = null;
          video.onerror = null;
          console.log('❌ Face ' + faceId + ' error loading queue[' + queueIdx + ']');
          reject('Video load error');
        };

        // Release previous blob URL before loading new one
        revokeFaceBlobUrl(faceId);

        // Update tracking
        faceVideos[faceId] = { element: video, queueIdx: queueIdx };

        // Pre-fetch video as Blob so iOS has it fully in memory before playback
        // This eliminates first-play network stalls (canplaythrough fires instantly on blob URLs)
        fetch(videoUrl)
          .then(function(r) { return r.blob(); })
          .then(function(blob) {
            var blobUrl = URL.createObjectURL(blob);
            faceVideos[faceId].blobUrl = blobUrl; // track for cleanup
            video.src = blobUrl;
            video.load();
          })
          .catch(function() {
            // Fallback: use direct URL if fetch fails
            video.src = videoUrl;
            video.load();
          });

        // Fallback timeout — always resolves or rejects (no hanging promise)
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            video.oncanplaythrough = null;
            video.oncanplay = null;
            video.onerror = null;
            if (video.readyState >= 3) {
              console.log('📹 Face ' + faceId + ' timeout-ready (HAVE_FUTURE_DATA): queue[' + queueIdx + ']');
              resolve(video);
            } else if (video.readyState >= 2) {
              console.log('⚠️ Face ' + faceId + ' timeout-partial (HAVE_CURRENT_DATA): queue[' + queueIdx + '] - may stall');
              resolve(video);
            } else {
              console.log('❌ Face ' + faceId + ' timeout: readyState=' + video.readyState + ', rejecting');
              reject('Timeout: video not ready (readyState=' + video.readyState + ')');
            }
          }
        }, 8000);
      });
    }
    
    // Revoke a blob URL when a face is reloaded (prevents memory leak)
    function revokeFaceBlobUrl(faceId) {
      var existing = faceVideos[faceId];
      if (existing && existing.blobUrl) {
        URL.revokeObjectURL(existing.blobUrl);
        existing.blobUrl = null;
      }
    }

    // Pause all videos and reset to first frame
    function pauseAllVideos() {
      Object.values(faceVideos).forEach(fv => {
        if (fv && fv.element) {
          fv.element.pause();
          fv.element.muted = true;
          fv.element.currentTime = 0;
        }
      });
    }
    
    // ============ ROTATION STATE ============
    // Active video being used for rotation sync
    let activeVideo = null;
    let activeVideoIndex = -1;
    let rotationFromX = 0, rotationFromY = 0;
    let rotationToX = 0, rotationToY = 0;
    
    // ============ FLOAT & ROTATION ANIMATION ============
    function updateCubeTransform(timestamp) {
      if (!floatStartTime) floatStartTime = timestamp;
      const elapsed = (timestamp - floatStartTime) / 1000;
      
      // Float effects
      const floatX = Math.sin(elapsed * 0.5) * 22 + Math.sin(elapsed * 0.3) * 13;
      const floatY = Math.sin(elapsed * 0.4 + 1) * 26 + Math.cos(elapsed * 0.25) * 16;
      const floatZ = Math.sin(elapsed * 0.35 + 2) * 38 + Math.cos(elapsed * 0.2) * 20;
      
      // Depth effects
      const depthPhase1 = Math.sin(elapsed * 0.15) * 0.22;
      const depthPhase2 = Math.sin(elapsed * 0.4 + 1.5) * 0.11;
      const depthScale = 0.95 + depthPhase1 + depthPhase2;
      const depthTranslateZ = Math.sin(elapsed * 0.18 + 2) * 110 + Math.cos(elapsed * 0.12) * 70;
      
      // VIDEO-SYNCED ROTATION: Update rotation based on current video progress
      if (activeVideo && activeVideoIndex >= 0) {
        const duration = activeVideo.duration;
        const currentTime = activeVideo.currentTime;
        
        if (duration && duration > 0 && isFinite(duration)) {
          // Calculate progress (0 to 1)
          const progress = Math.min(currentTime / duration, 1);
          
          // Smooth easing for rotation
          const ease = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          // Interpolate rotation based on video progress
          currentRotX = rotationFromX + (rotationToX - rotationFromX) * ease;
          currentRotY = rotationFromY + (rotationToY - rotationFromY) * ease;
        }
      }
      
      const spinWrapper = document.getElementById('spin-wrapper');
      const floatWrapper = document.querySelector('.float-wrapper');
      
      if (spinWrapper) {
        spinWrapper.style.transform = 'rotateX(' + currentRotX + 'deg) rotateY(' + currentRotY + 'deg)';
      }
      if (floatWrapper) {
        floatWrapper.style.transform = 'translate3d(' + floatX + 'px, ' + floatY + 'px, ' + (floatZ + depthTranslateZ) + 'px) scale(' + depthScale + ')';
      }
    }
    
    function floatLoop(timestamp) {
      if (!isPlaying) return;
      updateCubeTransform(timestamp);
      floatAnimId = requestAnimationFrame(floatLoop);
    }
    
    // ============ PLAYBACK CONTROL ============
    let videoTimeoutId = null;
    const MAX_VIDEO_DURATION = 60; // Safety timeout: max 60 seconds per video
    
    // Set up rotation sync for a video - "HALF TO HALF" mode
    // Video starts when face is at +45° (entering), ends when face is at -45° (exiting)
    // This creates smooth overlap where next video starts as current exits
    const HALF_ANGLE = 45; // Offset for half-to-half transitions
    
    function setupRotationSync(video, videoIndex) {
      const toTarget = getTargetRotation(videoIndex + 1);
      rotationToX = toTarget.rotX;
      rotationToY = toTarget.rotY + HALF_ANGLE;

      if (videoIndex === 0) {
        // First video: snap to expected start position
        const fromTarget = getTargetRotation(0);
        rotationFromX = fromTarget.rotX;
        rotationFromY = fromTarget.rotY + HALF_ANGLE;
        currentRotX = rotationFromX;
        currentRotY = rotationFromY;
      } else {
        // Subsequent videos: start from wherever rotation currently is (no snap/jump)
        rotationFromX = currentRotX;
        rotationFromY = currentRotY;
      }

      activeVideo = video;
      activeVideoIndex = videoIndex;
      console.log('🔄 Sync: idx=' + videoIndex + ' from(' + rotationFromX.toFixed(1) + ',' + rotationFromY.toFixed(1) + ') to(' + rotationToX + ',' + rotationToY + ')');
    }
    
    function clearRotationSync() {
      activeVideo = null;
      activeVideoIndex = -1;
    }
    
    function preloadUpcoming(fromIndex) {
      const prevFace = fromIndex > 0 ? getFaceForIndex(fromIndex - 1) : -1;
      for (let ahead = 1; ahead <= 2; ahead++) {
        const idx = fromIndex + ahead;
        if (idx >= fullVideoQueue.length) break;
        const fId = getFaceForIndex(idx);
        const existing = faceVideos[fId];
        if (!existing || existing.queueIdx !== idx) {
          if (fId === prevFace) {
            console.log('🔮 Delayed preload queue[' + idx + '] onto face ' + fId + ' (just finished)');
            setTimeout(() => {
              loadVideoOnFace(fId, idx).catch(() => {});
            }, 2500);
          } else {
            console.log('🔮 Preloading queue[' + idx + '] onto face ' + fId);
            loadVideoOnFace(fId, idx).catch(() => {});
          }
        }
      }
    }
    
    async function playCurrentVideo() {
      const faceId = getFaceForIndex(currentIndex);
      let fv = faceVideos[faceId];
      
      if (videoTimeoutId) {
        clearTimeout(videoTimeoutId);
        videoTimeoutId = null;
      }
      
      if (!fv || !fv.element || fv.queueIdx !== currentIndex || fv.element.readyState < 2) {
        console.log('🔄 Face ' + faceId + ' not ready (queueIdx=' + (fv ? fv.queueIdx : 'none') + ' need=' + currentIndex + ' readyState=' + (fv && fv.element ? fv.element.readyState : '?') + '), loading...');
        try {
          await loadVideoOnFace(faceId, currentIndex);
          fv = faceVideos[faceId];
        } catch (e) {
          console.log('❌ Failed to load video for queue[' + currentIndex + ']: ' + e);
          advanceToNext();
          return;
        }
      }
      
      if (!fv || !fv.element) {
        console.log('❌ No video on face ' + faceId + ' for queue[' + currentIndex + ']');
        advanceToNext();
        return;
      }
      
      const video = fv.element;
      const playingIndex = currentIndex;
      
      Object.entries(faceVideos).forEach(([id, v]) => {
        if (parseInt(id) !== faceId && v && v.element) {
          v.element.pause();
          v.element.muted = true;
        }
      });
      
      video.muted = false;
      video.volume = 1;

      let stallTimerId = null;
      let startupTimerId = null;
      let watchdogId = null;
      let watchdogLastTime = -1;
      let hasStartedPlaying = false;
      const clearStall = () => { if (stallTimerId) { clearTimeout(stallTimerId); stallTimerId = null; } };
      const clearStartupTimer = () => { if (startupTimerId) { clearTimeout(startupTimerId); startupTimerId = null; } };
      const stopWatchdog = () => { if (watchdogId) { clearInterval(watchdogId); watchdogId = null; } };
      const startWatchdog = () => {
        stopWatchdog();
        watchdogLastTime = video.currentTime;
        watchdogId = setInterval(function() {
          if (currentIndex !== playingIndex) { stopWatchdog(); return; }
          if (video.currentTime <= watchdogLastTime + 0.1) {
            console.log('🐕 Watchdog: queue[' + playingIndex + '] frozen at ' + video.currentTime.toFixed(1) + 's');
            stopWatchdog();
            cleanup();
            if (currentIndex === playingIndex) advanceToNext();
          } else {
            watchdogLastTime = video.currentTime;
          }
        }, 4000);
      };
      const armStall = () => {
        clearStall();
        const stallAt = video.currentTime;
        stallTimerId = setTimeout(() => {
          if (video.currentTime > stallAt + 0.1) {
            // Video actually progressed — false alarm (onplaying didn't fire)
            console.log('✅ False stall cleared: progressed to ' + video.currentTime.toFixed(1) + 's');
            return;
          }
          console.log('⚠️ Stall confirmed: queue[' + playingIndex + '] frozen at ' + video.currentTime.toFixed(1) + 's');
          cleanup();
          if (currentIndex === playingIndex) advanceToNext();
        }, 3000);
      };
      const cleanup = () => {
        video.ontimeupdate = null;
        video.onwaiting = null;
        video.onplaying = null;
        video.onended = null;
        video.pause();
        video.muted = true;
        clearStall();
        clearStartupTimer();
        stopWatchdog();
        if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
        clearRotationSync();
      };

      video.onended = function() {
        cleanup();
        console.log('🎬 Video ended naturally: queue[' + playingIndex + ']');
        if (currentIndex === playingIndex) advanceToNext();
      };

      // iOS WKWebView backup: ontimeupdate fires reliably even when onended doesn't
      video.ontimeupdate = function() {
        if (video.duration > 0 && video.currentTime >= video.duration - 0.3) {
          // Remove listeners only — don't pause, let video finish naturally (no freeze)
          video.ontimeupdate = null;
          video.onended = null;
          video.onwaiting = null;
          video.onplaying = null;
          clearStall();
          clearStartupTimer();
          stopWatchdog();
          if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
          clearRotationSync();
          console.log('🎬 Video end via timeupdate: queue[' + playingIndex + ']');
          if (currentIndex === playingIndex) advanceToNext();
        }
      };

      // Stall detector: only fires after video has already started playing (mid-video stalls only)
      // Ignores initial onwaiting before first frame — avoids premature advance on slow load
      video.onwaiting = function() {
        if (!hasStartedPlaying) return;
        console.log('⏳ Mid-video stall: queue[' + playingIndex + '] at ' + video.currentTime.toFixed(1) + 's');
        armStall();
      };
      video.onplaying = function() {
        hasStartedPlaying = true;
        clearStartupTimer();
        clearStall();
        startWatchdog();
      };

      // Set up rotation sync BEFORE play() so cube starts rotating immediately (no freeze)
      setupRotationSync(video, playingIndex);

      console.log('▶️ Playing queue[' + currentIndex + '] on face ' + faceId);

      video.play().then(() => {
        console.log('✅ Play started: queue[' + currentIndex + ']');
        postMessage('videoStart', { faceId, queueIndex: currentIndex });

        // Startup stall: if onplaying never fires within 6s, the video is stuck
        // before the first frame (initial buffering stall — ignored by onwaiting guard).
        // Force advance so playback doesn't hang forever on first load.
        startupTimerId = setTimeout(function() {
          if (!hasStartedPlaying) {
            console.log('⚠️ Startup stall: queue[' + playingIndex + '] never started playing, advancing');
            cleanup();
            if (currentIndex === playingIndex) advanceToNext();
          }
        }, 6000);

        preloadUpcoming(playingIndex);

        const duration = video.duration;
        const timeout = (duration && isFinite(duration) && duration > 0)
          ? (duration + 5) * 1000
          : MAX_VIDEO_DURATION * 1000;

        videoTimeoutId = setTimeout(() => {
          console.log('⏰ Timeout: queue[' + playingIndex + '] - forcing advance');
          cleanup();
          if (currentIndex === playingIndex) advanceToNext();
        }, timeout);

      }).catch(e => {
        cleanup();
        console.log('❌ Play failed: ' + e.message + ', advancing...');
        setTimeout(() => advanceToNext(), 500);
      });
    }
    
    function advanceToNext() {
      currentIndex++;
      console.log('⏭️ Advancing to queue[' + currentIndex + ']');
      
      if (currentIndex >= fullVideoQueue.length) {
        console.log('🏁 All ' + fullVideoQueue.length + ' videos complete!');
        isPlaying = false;
        if (floatAnimId) cancelAnimationFrame(floatAnimId);
        // Tilt cube to reveal title face (bottom), fade to black, then fire complete
        revealTitleFace(function() {
          showReplayButton();
          var fade = document.createElement('div');
          fade.id = 'playback-end-fade';
          fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;z-index:9999;transition:opacity 1.5s ease;pointer-events:none;';
          document.body.appendChild(fade);
          requestAnimationFrame(function() { requestAnimationFrame(function() {
            fade.style.opacity = '1';
            setTimeout(function() { postMessage('allVideosComplete', { playedCount: fullVideoQueue.length }); }, 1500);
          }); });
        });
        return;
      }
      
      playCurrentVideo();
    }
    
    // ============ INITIALIZATION ============
    let isReady = false;
    let hasUserStarted = false; // Prevent play button from showing again after user clicks
    
    function showPlayButton() {
      // Don't show if user already started playback
      if (hasUserStarted || isPlaying) return;
      const btn = document.getElementById('play-button');
      if (btn) btn.classList.remove('hidden');
    }

    function hidePlayButton() {
      const btn = document.getElementById('play-button');
      if (btn) btn.classList.add('hidden');
    }

    function showReplayButton() {
      const btn = document.getElementById('replay-button');
      if (btn) btn.classList.remove('hidden');
    }

    function hideReplayButton() {
      const btn = document.getElementById('replay-button');
      if (btn) btn.classList.add('hidden');
    }

    function hideFaceIntro() {
      const intro = document.getElementById('face-intro');
      if (intro) intro.classList.add('hidden');
    }

    // Animate cube to reveal the bottom (title) face, then call callback
    function revealTitleFace(callback) {
      var spinWrapper = document.getElementById('spin-wrapper');
      var startRotX = currentRotX;
      var startRotY = currentRotY;
      var targetRotX = 90; // tilt forward to show bottom face
      var duration = 1500;
      var startTime = null;
      function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        currentRotX = startRotX + (targetRotX - startRotX) * ease;
        if (spinWrapper) {
          spinWrapper.style.transition = 'none';
          spinWrapper.style.transform = 'rotateX(' + currentRotX + 'deg) rotateY(' + currentRotY + 'deg)';
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(callback, 1500); // hold on title face for 1.5s
        }
      }
      requestAnimationFrame(animate);
    }

    // Animate cube from top face (rotX=-90) to normal (rotX=0), then call callback
    function revealFromTopFace(callback) {
      var spinWrapper = document.getElementById('spin-wrapper');
      var startRotX = -90;
      var targetRotX = 0;
      var duration = 1500;
      var startTime = null;
      currentRotX = -90;
      // Do NOT reset currentRotY — caller pre-sets it to the first face's target Y so
      // the cube ends reveal at the correct angle without a snap in the callback.
      function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        currentRotX = startRotX + (targetRotX - startRotX) * ease;
        if (spinWrapper) {
          spinWrapper.style.transition = 'none';
          spinWrapper.style.transform = 'rotateX(' + currentRotX + 'deg) rotateY(' + currentRotY + 'deg)';
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          callback();
        }
      }
      requestAnimationFrame(animate);
    }

    async function handleReplayClick() {
      hideReplayButton();
      hideFaceIntro();
      console.log('🔄 Replaying: ' + fullVideoQueue.length + ' videos');

      // iOS gesture unlock: play() on face 0 synchronously unlocks the audio context
      // for the entire WebView — no need to unlock all 4 faces (which causes them all
      // to start playing simultaneously on back/invisible faces)
      var _unlockFaceId = getFaceForIndex(0);
      var _unlockV = faceVideoElements[_unlockFaceId];
      if (_unlockV && _unlockV.readyState >= 2) {
        _unlockV.muted = false;
        _unlockV.volume = 0;
        var _unlockP = _unlockV.play();
        if (_unlockP) _unlockP.catch(function(){});
      }

      // Also re-play background video after replay
      var bgVidR = document.getElementById('custom-bg');
      if (bgVidR && bgVidR.tagName === 'VIDEO') {
        bgVidR.play().catch(function(){});
      }

      // Stop and mute all video elements, then clear the face map
      // so playCurrentVideo re-loads fresh (uses HTTP cache — fast)
      Object.values(faceVideos).forEach(fv => {
        if (fv && fv.element) {
          fv.element.pause();
          fv.element.muted = true;
          fv.element.removeAttribute('src');
          fv.element.load();
        }
      });
      faceVideos = {};

      // Reset state
      currentIndex = 0;
      isPlaying = true;
      
      // Set initial rotation with half-to-half offset
      const initial = getTargetRotation(0);
      currentRotX = initial.rotX;
      currentRotY = initial.rotY + HALF_ANGLE;
      updateCubeTransform(performance.now());
      
      // Start float animation
      floatStartTime = 0;
      if (floatAnimId) cancelAnimationFrame(floatAnimId);
      floatAnimId = requestAnimationFrame(floatLoop);

      postMessage('replayStarted', { videoCount: fullVideoQueue.length });

      // Preload first 2 videos before starting (HTTP cache makes this fast)
      const replayCount = Math.min(2, fullVideoQueue.length);
      const reloadPromises = [];
      for (var ri = 0; ri < replayCount; ri++) {
        reloadPromises.push(loadVideoOnFace(getFaceForIndex(ri), ri).catch(function() {}));
      }
      await Promise.all(reloadPromises);
      console.log('✅ Replay preload done, starting');

      playCurrentVideo();
    }
    
    async function handlePlayClick() {
      if (!isReady || isPlaying || hasUserStarted) return;
      hasUserStarted = true; // Block any future showPlayButton calls
      hidePlayButton();
      hideFaceIntro();

      console.log('🎬 Starting playback: ' + fullVideoQueue.length + ' videos');
      
      // Ensure video elements exist
      initFaceVideoElements();
      
      // Reset state (but DON'T clear faceVideos - they're already loaded!)
      currentIndex = 0;

      // iOS gesture unlock: play() on face 0 synchronously unlocks the audio context
      // for the entire WebView — playing all 4 causes videos to start on back faces
      var _unlockFaceId2 = getFaceForIndex(0);
      var _unlockV2 = faceVideoElements[_unlockFaceId2];
      if (_unlockV2 && _unlockV2.readyState >= 2) {
        _unlockV2.muted = false;
        _unlockV2.volume = 0;
        var _unlockP2 = _unlockV2.play();
        if (_unlockP2) _unlockP2.catch(function(){});
        // Immediately pause + reset — audio context is already unlocked by play().
        // Without this, face-0 advances during the 1.5s revealFromTopFace animation
        // and becomes visible ~1s into the clip, then jumps back to 0 in the callback.
        _unlockV2.pause();
        _unlockV2.currentTime = 0;
      }

      // Also unlock background video — iOS autoplay is blocked until user gesture
      var bgVid = document.getElementById('custom-bg');
      if (bgVid && bgVid.tagName === 'VIDEO') {
        bgVid.play().catch(function(){});
      }

      console.log('📦 Using pre-loaded videos (no reload needed)');

      // Remove any black fade overlay from a previous completed playback
      var oldFade = document.getElementById('playback-end-fade');
      if (oldFade) oldFade.remove();

      postMessage('animationStarted', { videoCount: fullVideoQueue.length });

      // Pre-set Y to target so revealFromTopFace starts at the correct Y position.
      // Without this, revealFromTopFace sets currentRotY=0 then callback snaps it to
      // initial.rotY+HALF_ANGLE (=45°) — a visible jump at the end of the reveal.
      const _initialForReveal = getTargetRotation(0);
      currentRotY = _initialForReveal.rotY + HALF_ANGLE;

      // Animate cube from title face (top) to first video position, then start
      revealFromTopFace(function() {
        // Hide top face intro after reveal — restores its semi-transparent glass appearance
        var topIntro = document.querySelector('#face-4 .face-intro');
        if (topIntro) topIntro.style.display = 'none';
        isPlaying = true;
        const initial = getTargetRotation(0);
        currentRotX = initial.rotX;
        // currentRotY already = initial.rotY + HALF_ANGLE (set before revealFromTopFace)
        floatStartTime = 0;
        floatAnimId = requestAnimationFrame(floatLoop);
        // Ensure face-0 is at t=0 (it was paused+reset after unlock, but reset again for safety)
        var face0El = faceVideoElements[getFaceForIndex(0)];
        if (face0El) {
          if (!face0El.paused) face0El.pause();
          face0El.currentTime = 0;
        }
        playCurrentVideo();
      });
    }
    
    // Capture first frame from a loaded video and set as top face thumbnail
    function setTopFaceThumbnail() {
      var topFace = document.getElementById('face-4');
      if (!topFace) return;
      var faceOrder = [0, 2, 1, 3];
      for (var i = 0; i < faceOrder.length; i++) {
        var videoEl = faceVideoElements[faceOrder[i]];
        if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) continue;
        try {
          var canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl && dataUrl.length > 200) {
            var img = document.createElement('img');
            img.src = dataUrl;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:1;';
            topFace.insertBefore(img, topFace.firstChild);
            console.log('🖼️ Top face thumbnail set from face ' + faceOrder[i]);
            return;
          }
        } catch(e) {
          console.log('⚠️ Canvas capture failed: ' + e.message);
        }
      }
      console.log('🖼️ Top face using gradient (canvas unavailable)');
    }

    async function init() {
      console.log('🎲 Cube init: ' + fullVideoQueue.length + ' videos');
      
      // Create persistent video elements on each face (once)
      initFaceVideoElements();
      
      postMessage('cubeReady', { faceCount: fullVideoQueue.length });
      
      if (fullVideoQueue.length > 0) {
        // Wait for ALL first 4 videos to be fully ready (canplay) before showing play button
        const preloadCount = Math.min(4, fullVideoQueue.length);
        console.log('⏳ Preloading first ' + preloadCount + ' videos...');
        
        const loadPromises = [];
        for (let i = 0; i < preloadCount; i++) {
          const faceId = getFaceForIndex(i);
          loadPromises.push(loadVideoOnFace(faceId, i).catch(e => {
            console.log('⚠️ Preload failed for ' + i + ': ' + e);
            return null;
          }));
        }
        
        await Promise.all(loadPromises);
        console.log('✅ All ' + preloadCount + ' initial videos ready (canplay)');
        setTopFaceThumbnail();

        isReady = true;
        postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
        showPlayButton();
      }
    }
    
    window.updateFaces = function(newFaces) {
      const validFaces = newFaces.filter(f => f && f.videoUrl);
      const prevLen = fullVideoQueue.length;
      
      // Check if any URLs changed (not just length)
      let hasChanges = validFaces.length !== prevLen;
      if (!hasChanges) {
        for (let i = 0; i < validFaces.length; i++) {
          if (!fullVideoQueue[i] || fullVideoQueue[i].videoUrl !== validFaces[i].videoUrl) {
            hasChanges = true;
            break;
          }
        }
      }
      
      // Always update the queue when there are changes
      if (hasChanges) {
        fullVideoQueue = validFaces;
        console.log('📥 Queue updated: ' + prevLen + ' → ' + fullVideoQueue.length + ' videos');
        
        // Force reload faces with new URLs
        if (!isPlaying) {
          for (let i = 0; i < Math.min(fullVideoQueue.length, 4); i++) {
            const faceId = getFaceForIndex(i);
            loadVideoOnFace(faceId, i).catch(() => {});
          }
        }
      }
      
      if (!isReady && fullVideoQueue.length > 0) {
        isReady = true;
        console.log('✅ Ready with ' + fullVideoQueue.length + ' videos total');
        postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
        showPlayButton();
      }
    };
    
    window.pauseCube = function() {
      if (floatAnimId) {
        cancelAnimationFrame(floatAnimId);
        floatAnimId = null;
      }
    };
    
    window.resumeCube = function() {
      if (!floatAnimId && isPlaying) {
        floatAnimId = requestAnimationFrame(floatLoop);
      }
    };
    
    // ============ CLIENT-SIDE RECORDING MODULE ============
    window._recEnabled = false;
    window._musicUrl = null;

    // Pre-load music as a blob URL so it's ready when recording starts
    var _musicBlobUrl = null;
    var _musicAudioEl = null;
    var _musicCaptured = false;
    window._preloadMusic = function(url) {
      if (!url) return;
      console.log('🎵 Pre-loading music for recording...');
      fetch(url, { mode: 'cors' })
        .then(function(r) { return r.blob(); })
        .then(function(blob) {
          if (_musicBlobUrl) URL.revokeObjectURL(_musicBlobUrl);
          _musicBlobUrl = URL.createObjectURL(blob);
          console.log('🎵 Music pre-loaded as blob, ready for recording');
        })
        .catch(function(e) { console.warn('🎵 Music pre-load failed:', e.message); });
    };

    var _recModule = (function() {
      var hasRecorder = typeof MediaRecorder !== 'undefined';
      var hasCapture = HTMLCanvasElement.prototype &&
                       typeof HTMLCanvasElement.prototype.captureStream === 'function';
      var supported = hasRecorder && hasCapture;

      setTimeout(function() {
        postMessage('recordingSupport', { supported: supported });
      }, 200);
      
      if (!supported) {
        console.log('📹 Recording not supported in this WebView');
        return { supported: false, start: function(){}, stop: function(){}, isRec: function(){ return false; } };
      }
      
      console.log('📹 Client-side recording available');
      
      var RW = 720, RH = 1280;
      var cvs = document.createElement('canvas');
      cvs.width = RW; cvs.height = RH;
      var ctx = cvs.getContext('2d');
      
      var recorder = null;
      var chunks = [];
      var recAnimId = null;
      var recState = 'idle';


      var CUBE_PX = ${CUBE_SIZE};
      var HALF_PX = CUBE_PX / 2;
      var SF = RW / (CUBE_PX + 80);
      var PERSP = 800;
      
      var FACE_CORNERS = [
        [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
        [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
        [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
        [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],
        [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
        [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]
      ];
      
      var bgStars = [];
      for (var si = 0; si < 60; si++) {
        bgStars.push({ x: Math.random()*RW, y: Math.random()*RH, r: Math.random()*1.5+0.5, a: Math.random()*0.5+0.2 });
      }

      // Pre-render title face canvas (face-4/face-5): gradient background + logo + story title.
      // Used by getDrawSource() so canvas recording captures the title card.
      // flip=true: rotate canvas 180° (used for face-5/bottom which has CSS rotate(180deg)).
      var _titleFaceCanvas = null;
      var _titleFaceCanvasFlipped = null;
      function getTitleFaceCanvas(flip) {
        if (flip && _titleFaceCanvasFlipped) return _titleFaceCanvasFlipped;
        if (!flip && _titleFaceCanvas) return _titleFaceCanvas;
        var tc = document.createElement('canvas');
        tc.width = 720; tc.height = 720;
        var tctx = tc.getContext('2d');
        // Rotate canvas 180° for face-5 (bottom face has CSS rotate(180deg) — pre-flip so drawQuad renders right-side up)
        if (flip) { tctx.translate(tc.width, tc.height); tctx.rotate(Math.PI); }
        // Gradient: slightly lighter purple (not near-black) so tile seams are less visible against colored backgrounds
        var g = tctx.createLinearGradient(0, 0, tc.width, tc.height);
        g.addColorStop(0, '#1e0a3c');
        g.addColorStop(1, '#2d0f52');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, tc.width, tc.height);
        var cx = tc.width / 2;
        var logoSize = 140;
        var logoY = tc.height / 2 - 130;
        // Draw logo by reusing the img element already in the DOM (already loaded, data URI — no CORS issue)
        try {
          var logoImgEl = document.querySelector('#face-5 .face-intro-logo, #face-4 .face-intro-logo');
          if (logoImgEl && logoImgEl.complete && logoImgEl.naturalWidth > 0) {
            var lx = cx - logoSize / 2, ly = logoY, r = 18;
            tctx.save();
            tctx.beginPath();
            tctx.moveTo(lx + r, ly);
            tctx.lineTo(lx + logoSize - r, ly);
            tctx.quadraticCurveTo(lx + logoSize, ly, lx + logoSize, ly + r);
            tctx.lineTo(lx + logoSize, ly + logoSize - r);
            tctx.quadraticCurveTo(lx + logoSize, ly + logoSize, lx + logoSize - r, ly + logoSize);
            tctx.lineTo(lx + r, ly + logoSize);
            tctx.quadraticCurveTo(lx, ly + logoSize, lx, ly + logoSize - r);
            tctx.lineTo(lx, ly + r);
            tctx.quadraticCurveTo(lx, ly, lx + r, ly);
            tctx.closePath();
            tctx.clip();
            tctx.drawImage(logoImgEl, lx, ly, logoSize, logoSize);
            tctx.restore();
          }
        } catch(e) {}
        // Draw story title text
        if (storyTitle) {
          tctx.fillStyle = '#ffffff';
          tctx.font = 'bold 56px sans-serif';
          tctx.textAlign = 'center';
          tctx.textBaseline = 'top';
          var textY = logoY + logoSize + 20;
          var maxW = tc.width - 60;
          var words = storyTitle.split(' ');
          var lineStr = '', lineArr = [];
          for (var wi = 0; wi < words.length; wi++) {
            var test = lineStr + (lineStr ? ' ' : '') + words[wi];
            if (tctx.measureText(test).width > maxW && lineStr) { lineArr.push(lineStr); lineStr = words[wi]; }
            else { lineStr = test; }
          }
          if (lineStr) lineArr.push(lineStr);
          for (var tli = 0; tli < lineArr.length; tli++) {
            tctx.fillText(lineArr[tli], cx, textY + tli * 68);
          }
        }
        if (flip) { _titleFaceCanvasFlipped = tc; } else { _titleFaceCanvas = tc; }
        return tc;
      }

      function rY(p, deg) {
        var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
        return [p[0]*c + p[2]*s, p[1], -p[0]*s + p[2]*c];
      }
      function rX(p, deg) {
        var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
        return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c];
      }
      function lrp(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
      
      function computeFace(faceIdx, fx, fy, fz, ds) {
        var corners = FACE_CORNERS[faceIdx];
        var tr = [];
        for (var i = 0; i < 4; i++) {
          var p = rY(corners[i], currentRotY);
          p = rX(p, currentRotX);
          tr.push([p[0]*ds, p[1]*ds, p[2]*ds]);
        }
        var e1 = [tr[1][0]-tr[0][0], tr[1][1]-tr[0][1], tr[1][2]-tr[0][2]];
        var e2 = [tr[3][0]-tr[0][0], tr[3][1]-tr[0][1], tr[3][2]-tr[0][2]];
        var nz = e1[0]*e2[1] - e1[1]*e2[0];
        if (nz <= 0) return null;
        
        var proj = [];
        for (var i = 0; i < 4; i++) {
          var xPx = (tr[i][0] * HALF_PX + fx) * SF;
          var yPx = (tr[i][1] * HALF_PX + fy) * SF;
          var zPx = (tr[i][2] * HALF_PX + fz) * SF;
          var factor = (PERSP * SF) / (PERSP * SF - zPx);
          if (factor < 0.01) return null;
          proj.push([RW/2 + xPx * factor, RH/2 + yPx * factor]);
        }
        var avgZ = (tr[0][2]+tr[1][2]+tr[2][2]+tr[3][2])/4;
        return { id: faceIdx, proj: proj, z: avgZ };
      }
      
      function getDrawSource(faceId) {
        if (faceId < 4) {
          var v = faceVideoElements[faceId];
          if (v && v.readyState >= 2) return v;
          return null;
        }
        // Face 4 (top) and 5 (bottom/title): try video, then img, then pre-rendered title canvas
        var faceEl = document.getElementById('face-' + faceId);
        if (faceEl) {
          var v = faceEl.querySelector('video');
          if (v && v.readyState >= 2) return v;
          // Only use img if it's a full-face thumbnail (not the .face-intro-logo which is just the small logo icon)
          var img = faceEl.querySelector('img:not(.face-intro-logo)');
          if (img && img.complete && img.naturalWidth > 0) return img;
        }
        // face-5 (bottom) has CSS rotate(180deg) — pass flip=true so drawQuad renders text right-side up
        return getTitleFaceCanvas(faceId === 5);
      }
      
      function drawTriTextured(src, sx, sy, sw, sh, p0, p1, p2) {
        var dw = sw || 1;
        var dh = sh || 1;
        var x0 = (sx) / dw, y0 = (sy) / dh;
        var x1 = (sx + sw) / dw, y1 = y0;
        var x2 = x0, y2 = (sy + sh) / dh;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.closePath();
        ctx.clip();
        
        var vw = src.videoWidth || src.naturalWidth || src.width || 720;
        var vh = src.videoHeight || src.naturalHeight || src.height || 720;
        
        var a1 = (p1[0] - p0[0]) / vw;
        var b1 = (p1[1] - p0[1]) / vw;
        var c1 = (p2[0] - p0[0]) / vh;
        var d1 = (p2[1] - p0[1]) / vh;
        ctx.setTransform(a1, b1, c1, d1, p0[0], p0[1]);
        try { ctx.drawImage(src, 0, 0); } catch(ex) {}
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.restore();
      }
      
      // GRID: number of subdivisions per face axis. 4 = 4x4=16 cells, near-perfect perspective.
      // ROLLBACK: set GRID=1 to revert to simple 2-triangle mode (fast, slight corner error).
      var DRAW_GRID = 16;
      // SEAM_PX: expand clip path outward by N pixels to fill sub-pixel anti-aliasing gaps.
      // At DRAW_GRID=16 cells are ~45px. Recording canvas (720px wide) renders at higher scale
      // than the display preview — increase to 3.0 to cover wider anti-alias bands in recording.
      var SEAM_PX = 3.0;

      // Bilinear interpolation across the 4 projected face corners.
      // proj[0]=TL, proj[1]=TR, proj[2]=BR, proj[3]=BL
      // u: 0=left→1=right, v: 0=top→1=bottom
      function biLerp(proj, u, v) {
        var top = [proj[0][0] + (proj[1][0]-proj[0][0])*u, proj[0][1] + (proj[1][1]-proj[0][1])*u];
        var bot = [proj[3][0] + (proj[2][0]-proj[3][0])*u, proj[3][1] + (proj[2][1]-proj[3][1])*u];
        return [top[0] + (bot[0]-top[0])*v, top[1] + (bot[1]-top[1])*v];
      }

      // Expand a point outward from (cx,cy) by px pixels (used to hide tile seams).
      function _expandPt(pt, cx, cy, px) {
        var dx = pt[0]-cx, dy = pt[1]-cy, l = Math.sqrt(dx*dx+dy*dy) || 1;
        return [pt[0]+dx/l*px, pt[1]+dy/l*px];
      }

      function drawQuad(fd) {
        var proj = fd.proj;
        var src = getDrawSource(fd.id);

        // Black pre-fill: fill face polygon with black before grid draw.
        // Intra-cell gaps show black (not bright background). No drawImage → no canvas taint.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(proj[0][0], proj[0][1]);
        for (var pi = 1; pi < 4; pi++) ctx.lineTo(proj[pi][0], proj[pi][1]);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();

        if (src) {
          var vw = src.videoWidth || src.naturalWidth || src.width || 720;
          var vh = src.videoHeight || src.naturalHeight || src.height || 720;
          var G = DRAW_GRID;
          var sw = vw / G, sh = vh / G;

          for (var gy = 0; gy < G; gy++) {
            for (var gx = 0; gx < G; gx++) {
              var u0 = gx/G, u1 = (gx+1)/G, v0 = gy/G, v1 = (gy+1)/G;
              var ctl = biLerp(proj, u0, v0);
              var ctr = biLerp(proj, u1, v0);
              var cbr = biLerp(proj, u1, v1);
              var cbl = biLerp(proj, u0, v1);
              var sx = u0*vw, sy = v0*vh;

              // Expand clip corners slightly outward from cell center to hide sub-pixel seams.
              // Image transform still uses exact (non-expanded) corners — no distortion.
              var ccx = (ctl[0]+ctr[0]+cbr[0]+cbl[0])*0.25;
              var ccy = (ctl[1]+ctr[1]+cbr[1]+cbl[1])*0.25;
              var ectl = _expandPt(ctl,ccx,ccy,SEAM_PX);
              var ectr = _expandPt(ctr,ccx,ccy,SEAM_PX);
              var ecbr = _expandPt(cbr,ccx,ccy,SEAM_PX);
              var ecbl = _expandPt(cbl,ccx,ccy,SEAM_PX);

              // Outer quad clip (expanded) — one clip per cell covers both triangles
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(ectl[0],ectl[1]); ctx.lineTo(ectr[0],ectr[1]);
              ctx.lineTo(ecbr[0],ecbr[1]); ctx.lineTo(ecbl[0],ecbl[1]);
              ctx.closePath(); ctx.clip();

              // Pass 1: T2 fills the full quad (no inner triangle clip).
              // Anti-aliased diagonal edge of T1 will reveal T2 texture underneath — no black gap.
              var c2=(cbr[0]-ctr[0])/sh, d2=(cbr[1]-ctr[1])/sh;
              var e2=cbl[0]-c2*sh, f2=cbl[1]-d2*sh;
              var a2=(ctr[0]-e2)/sw, b2=(ctr[1]-f2)/sw;
              ctx.save();
              ctx.setTransform(a2,b2,c2,d2,e2,f2);
              try { ctx.drawImage(src,sx,sy,sw,sh,0,0,sw,sh); } catch(ex) {}
              ctx.setTransform(1,0,0,1,0,0); ctx.restore();

              // Pass 2: T1 with exact (non-expanded) triangle clip drawn on top.
              // The anti-aliased diagonal fade blends into T2's texture, not black.
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(ctl[0],ctl[1]); ctx.lineTo(ctr[0],ctr[1]); ctx.lineTo(cbl[0],cbl[1]);
              ctx.closePath(); ctx.clip();
              var a1=(ctr[0]-ctl[0])/sw, b1=(ctr[1]-ctl[1])/sw;
              var c1=(cbl[0]-ctl[0])/sh, d1=(cbl[1]-ctl[1])/sh;
              ctx.setTransform(a1,b1,c1,d1,ctl[0],ctl[1]);
              try { ctx.drawImage(src,sx,sy,sw,sh,0,0,sw,sh); } catch(ex) {}
              ctx.setTransform(1,0,0,1,0,0); ctx.restore();

              ctx.restore(); // outer quad clip
            }
          }
        } else {
          ctx.fillStyle = '#1a1a2e';
          ctx.beginPath();
          ctx.moveTo(proj[0][0],proj[0][1]);
          for (var i = 1; i < 4; i++) ctx.lineTo(proj[i][0],proj[i][1]);
          ctx.closePath(); ctx.fill();
        }
        // Face border stroke removed — was rgba(255,255,255,0.6) lineWidth=3,
        // visible as white seam lines against colored backgrounds in recordings.
      }
      
      function renderRecFrame() {
        if (recState !== 'recording') return;
        
        var elapsed = floatStartTime ? (performance.now() - floatStartTime) / 1000 : 0;
        var fx = Math.sin(elapsed*0.5)*22 + Math.sin(elapsed*0.3)*13;
        var fy = Math.sin(elapsed*0.4+1)*26 + Math.cos(elapsed*0.25)*16;
        var fz = Math.sin(elapsed*0.35+2)*38 + Math.cos(elapsed*0.2)*20;
        var dp1 = Math.sin(elapsed*0.15)*0.22;
        var dp2 = Math.sin(elapsed*0.4+1.5)*0.11;
        var ds = 0.95 + dp1 + dp2;
        var dtz = Math.sin(elapsed*0.18+2)*110 + Math.cos(elapsed*0.12)*70;
        
        // Recording canvas background: always solid black to prevent iOS WKWebView canvas taint.
        // Drawing cross-origin video (customBgEl) taints the canvas → captureStream() returns 1s clips.
        // Live preview still shows custom background via CSS/DOM layer (unaffected).
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, RW, RH);
        
        var visible = [];
        for (var f = 0; f < 6; f++) {
          var fd = computeFace(f, fx, fy, fz + dtz, ds);
          if (fd) visible.push(fd);
        }
        visible.sort(function(a,b) { return a.z - b.z; });
        for (var i = 0; i < visible.length; i++) drawQuad(visible[i]);
        
        recAnimId = requestAnimationFrame(renderRecFrame);
      }
      
      var _audioCtx = null;
      var _audioSources = new Map();
      
      function setupAudioCapture(stream) {
        try {
          _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          var dest = _audioCtx.createMediaStreamDestination();
          
          Object.values(faceVideos).forEach(function(fv) {
            if (fv && fv.element && !_audioSources.has(fv.element)) {
              try {
                var source = _audioCtx.createMediaElementSource(fv.element);
                var gain = _audioCtx.createGain();
                gain.gain.value = 1.0;
                source.connect(gain);
                gain.connect(dest);
                gain.connect(_audioCtx.destination);
                _audioSources.set(fv.element, { source: source, gain: gain });
              } catch(e) {
                console.warn('📹 Audio source error:', e.message);
              }
            }
          });
          
          // Also capture AI music if pre-loaded — routes music to recording only (not speaker)
          // User hears music via Expo AV on native side; WebView captures it silently for the recording
          _musicCaptured = false;
          if (_musicBlobUrl) {
            try {
              _musicAudioEl = document.createElement('audio');
              _musicAudioEl.src = _musicBlobUrl;
              _musicAudioEl.loop = true;
              var musicSource = _audioCtx.createMediaElementSource(_musicAudioEl);
              var musicGain = _audioCtx.createGain();
              musicGain.gain.value = 0; // clips already contain mic-captured music; server adds clean music layer
              musicSource.connect(musicGain);
              musicGain.connect(dest); // only to recording dest, NOT to audioCtx.destination → silent to speaker
              _musicAudioEl.play().catch(function(e) { console.warn('🎵 Music play error:', e.message); });
              _musicCaptured = true;
              console.log('🎵 Music audio captured for recording (silent to speaker)');
            } catch(me) {
              console.warn('🎵 Music capture setup failed:', me.message);
            }
          } else {
            console.log('🎵 No music blob ready — recording without music (server will mix)');
          }

          dest.stream.getAudioTracks().forEach(function(track) {
            stream.addTrack(track);
          });
          console.log('🔊 Audio capture added (' + _audioSources.size + ' voice sources, music=' + _musicCaptured + ')');
          return true;
        } catch(e) {
          console.warn('🔇 Audio capture failed:', e.message);
          return false;
        }
      }
      
      function waitForFaceVideos() {
        return new Promise(function(resolve) {
          var attempts = 0;
          function check() {
            var ready = 0;
            var total = 0;
            for (var fid = 0; fid < 4; fid++) {
              var v = faceVideoElements[fid];
              if (v && v.src) {
                total++;
                if (v.readyState >= 2) ready++;
              }
            }
            if (ready >= total && total > 0) {
              console.log('📹 All ' + ready + ' face videos ready for recording');
              resolve(true);
            } else if (attempts > 50) {
              console.warn('📹 Timeout waiting for videos: ' + ready + '/' + total + ' ready');
              resolve(false);
            } else {
              attempts++;
              setTimeout(check, 100);
            }
          }
          check();
        });
      }
      
      function startRec(skipWait) {
        if (recState !== 'idle') return;
        // skipWait=true: start immediately (used when triggered by videoStart — video is already playing)
        if (skipWait) {
          actualStartRec();
          return;
        }
        waitForFaceVideos().then(function(allReady) {
          if (!allReady) {
            console.warn('📹 Not all videos ready but proceeding anyway');
          }
          actualStartRec();
        });
      }
      
      function actualStartRec() {
        if (recState !== 'idle') return;
        recState = 'recording';
        chunks = [];
        
        var stream = cvs.captureStream(30);
        setupAudioCapture(stream);
        
        var mimeType = '';
        ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].some(function(m) {
          if (MediaRecorder.isTypeSupported(m)) { mimeType = m; return true; }
        });
        if (!mimeType) {
          postMessage('recordingError', { error: 'No supported format' });
          recState = 'idle'; return;
        }
        
        recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
        recorder.ondataavailable = function(e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = function() {
          recState = 'processing';
          var blob = new Blob(chunks, { type: mimeType });
          var sizeMB = (blob.size/1024/1024).toFixed(2);
          console.log('📹 Recording blob: ' + sizeMB + 'MB (' + blob.size + ' bytes, ' + chunks.length + ' chunks)');
          if (blob.size < 50000) {
            console.warn('📹 Recording too small (' + blob.size + 'b) - captureStream likely not working on this device');
            postMessage('recordingFailed', { error: 'Recording too small', sizeBytes: blob.size });
            recState = 'idle';
            return;
          }
          postMessage('recordingProcessing', { sizeBytes: blob.size });
          
          var reader = new FileReader();
          reader.onloadend = function() {
            var b64Marker = ';base64,';
            var b64Idx = reader.result.indexOf(b64Marker);
            var b64 = b64Idx >= 0 ? reader.result.substring(b64Idx + b64Marker.length) : reader.result.split(',').slice(1).join(',');
            console.log('📹 Cube base64 length: ' + b64.length + ' chars');
            var CHUNK = 64 * 1024;
            var total = Math.ceil(b64.length / CHUNK);
            postMessage('recordingMeta', { totalChunks: total, sizeBytes: blob.size, mimeType: mimeType, hasMusic: _musicCaptured });
            
            var sendIdx = 0;
            function sendNext() {
              if (sendIdx >= total) {
                postMessage('recordingComplete', { totalChunks: total, sizeBytes: blob.size });
                recState = 'idle';
                return;
              }
              var data = b64.substring(sendIdx * CHUNK, (sendIdx+1) * CHUNK);
              postMessage('recordingChunk', { index: sendIdx, data: data, total: total });
              sendIdx++;
              setTimeout(sendNext, 5);
            }
            sendNext();
          };
          reader.readAsDataURL(blob);
        };
        
        recorder.start(1000);
        recAnimId = requestAnimationFrame(renderRecFrame);
        postMessage('recordingStarted', {});
        console.log('📹 Recording started: ' + mimeType);
      }
      
      function stopRec() {
        if (recState !== 'recording' || !recorder) return;
        console.log('📹 Stopping recording...');
        if (recAnimId) cancelAnimationFrame(recAnimId);
        recorder.stop();
        if (_musicAudioEl) {
          try { _musicAudioEl.pause(); _musicAudioEl.src = ''; } catch(e) {}
          _musicAudioEl = null;
        }
        if (_audioCtx) {
          try { _audioCtx.close(); } catch(e) {}
          _audioCtx = null;
          _audioSources.clear();
        }
      }
      
      return {
        supported: true,
        start: startRec,
        stop: stopRec,
        isRec: function() { return recState === 'recording'; }
      };
    })();

    var _origPostMsg = postMessage;
    postMessage = function(type, data) {
      _origPostMsg(type, data);
      // Start recording when first video actually starts playing (not during reveal animation).
      // 'animationStarted' fires before revealFromTopFace (~2-3s). Starting there puts the
      // recording 2-3s ahead of the audio concat → desync. 'videoStart' queueIndex=0 fires
      // exactly when video 0 begins, so audio and video start at the same moment.
      if (type === 'videoStart' && data.queueIndex === 0 && window._recEnabled) {
        window._recEnabled = false;
        _recModule.start(true); // skipWait — face 0 is already playing
      }
      if (type === 'allVideosComplete' && _recModule.isRec()) {
        setTimeout(function() { _recModule.stop(); }, 500);
      }
    };
    
    window.startClientRecording = function() { _recModule.start(); };
    window.stopClientRecording = function() { _recModule.stop(); };
    
    init();
  </script>
</body>
</html>
    `;
  }, [initialFaces, storyName, backgroundUrl, backgroundMediaType, logoDataUri]);

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
        case 'replayStarted':
          console.log('🔄 Cube replay started');
          onPlaybackStart?.();
          break;
        case 'recordingSupport':
          console.log('📹 Recording support:', data.supported);
          onRecordingSupport?.(data.supported);
          break;
        case 'recordingStarted':
          console.log('📹 Recording started in WebView');
          break;
        case 'recordingMeta':
          recordingMetaRef.current = { ...data };
          recordingChunksRef.current = [];
          onRecordingProgress?.({ phase: 'transferring', progress: 0 });
          break;
        case 'recordingChunk':
          recordingChunksRef.current.push(data.data);
          if (recordingMetaRef.current) {
            const pct = Math.round(((data.index + 1) / data.total) * 100);
            onRecordingProgress?.({ phase: 'transferring', progress: pct });
          }
          break;
        case 'recordingProcessing':
          onRecordingProgress?.({ phase: 'processing', progress: 0 });
          break;
        case 'recordingComplete': {
          console.log('📹 All recording chunks received:', data.totalChunks);
          onRecordingProgress?.({ phase: 'saving', progress: 90 });
          const base64Data = recordingChunksRef.current.join('');
          const recMime = recordingMetaRef.current?.mimeType || '';
          const recExt = recMime.includes('mp4') ? '.mp4' : '.webm';
          console.log('📹 Recording mimeType:', recMime, 'extension:', recExt);
          const fileUri = FileSystem.cacheDirectory + 'cube_recording_' + Date.now() + recExt;
          const recMeta = { hasMusic: recordingMetaRef.current?.hasMusic === true };
          FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          }).then(() => {
            console.log('📹 Recording saved:', fileUri, 'hasMusic:', recMeta.hasMusic);
            onRecordingComplete?.(fileUri, recMeta);
            recordingChunksRef.current = [];
            recordingMetaRef.current = null;
          }).catch(err => {
            console.error('📹 Failed to save recording:', err);
            onRecordingComplete?.(null);
          });
          break;
        }
        case 'recordingFailed':
          console.warn('📹 Recording failed (too small):', data.sizeBytes, 'bytes');
          onRecordingComplete?.(null);
          break;
        case 'recordingError':
          console.error('📹 Recording error:', data.error);
          onRecordingComplete?.(null);
          break;
      }
    } catch (e) {
      console.warn('WebView message parse error:', e);
    }
  }, [onFaceChange, onVideoStart, onVideoEnd, onReadyToPlay, onPlaybackStart, onPlaybackComplete, onRecordingSupport, onRecordingComplete, onRecordingProgress]);

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
        playerName: face?.playerName || `סרטון ${index + 1}`,
      }));
      const js = `window.updateFaces && window.updateFaces(${JSON.stringify(facesData)}); true;`;
      webViewRef.current.injectJavaScript(js);
      console.log('🔄 Injected updated faces:', facesData.filter(f => f.videoUrl).length, 'videos');
    }
  }, [faces]);

  // Save HTML to file only once when cubeHTML is generated
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
    
    if (cubeHTML) {
      saveHtmlToFile();
    }
  }, [cubeHTML]); // Only depends on cubeHTML, not faces

  // Use html content with baseUrl for iOS to allow file:// video access
  const webViewSource = useMemo(() => {
    // Always use html content with baseUrl - this allows file:// video access on iOS
    if (cubeHTML) {
      return { 
        html: cubeHTML, 
        baseUrl: Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined 
      };
    }
    return { html: '<html><body></body></html>' };
  }, [cubeHTML]);

  // Show loading while waiting for initial faces or cubeHTML
  if (!cubeHTML) {
    return (
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>טוען סרטונים...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      <WebView
        key={webViewKeyRef.current}
        ref={webViewRef}
        source={webViewSource}
        style={[styles.webView, isFullscreen && styles.fullscreenWebView]}
        onMessage={onMessage}
        onError={(e) => setError(e.nativeEvent.description)}
        onLoad={() => {
          setIsLoading(false);
        }}
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
        allowingReadAccessToURL={Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined}
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
