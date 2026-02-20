import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

const CUBE_HTML_DIR = FileSystem.cacheDirectory + 'cube_v4/';

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
  onRecordingSupport,
  onRecordingComplete,
  onRecordingProgress,
  isFullscreen = false,
  currentPlayingFaceIndex = -1,
  triggerAutoPlay = false,
  recordNextPlayback = false,
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
  
  useEffect(() => {
    if (hasInitializedRef.current) return;
    const first4 = faces.slice(0, 4);
    const minRequired = Math.min(4, faces.length);
    const readyCount = first4.filter(f => f?.videoUrl).length;
    
    if (minRequired > 0 && readyCount >= minRequired) {
      console.log(`🎲 All ${minRequired} initial videos ready - initializing cube`);
      hasInitializedRef.current = true;
      setInitialFaces([...faces]);
    }
  }, [faces]);

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
      webViewRef.current.injectJavaScript(`
        window._recEnabled = true;
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
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .cube-face {
      background: #000;
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
    /* Top/bottom faces - force GPU rendering on iOS */
    .top video, .bottom video {
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
      -webkit-backface-visibility: visible;
      backface-visibility: visible;
    }
    /* Force redraw on top/bottom faces */
    .top, .bottom {
      -webkit-transform-style: flat;
      transform-style: flat;
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
  <button class="replay-button hidden" id="replay-button" onclick="handleReplayClick()">
    <div class="replay-icon">↻</div>
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
    // ============ MINIMAL CUBE V2 ============
    // Simple state machine: currentIndex triggers everything
    // Rotation only happens when video 'ended' fires
    
    const faces = ${facesJSON};
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
          video.preload = 'auto';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          el.appendChild(video);
          faceVideoElements[faceId] = video;
          console.log('📺 Created persistent video element on face ' + faceId);
        }
      });
      
      // Add thumbnail images to top and bottom faces for visual effect during tilts
      initTopBottomFaces();
    }
    
    // Populate top/bottom faces with video thumbnails
    function initTopBottomFaces() {
      const topFace = document.getElementById('face-4');
      const bottomFace = document.getElementById('face-5');
      
      if (!topFace || !bottomFace || fullVideoQueue.length === 0) return;
      
      // Use first two videos for top/bottom thumbnails
      const topVideoUrl = fullVideoQueue[0]?.videoUrl;
      const bottomVideoUrl = fullVideoQueue[Math.min(1, fullVideoQueue.length - 1)]?.videoUrl;
      
      // Create video element for top face (shows first frame as thumbnail)
      if (topVideoUrl && !topFace.querySelector('video')) {
        const topVideo = document.createElement('video');
        topVideo.muted = true;
        topVideo.playsInline = true;
        topVideo.setAttribute('playsinline', '');
        topVideo.preload = 'metadata';
        topVideo.src = topVideoUrl;
        topVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0.85;';
        topVideo.currentTime = 0.5; // Seek to half second for better thumbnail
        topFace.appendChild(topVideo);
        console.log('🖼️ Added thumbnail to TOP face');
      }
      
      // Create video element for bottom face
      if (bottomVideoUrl && !bottomFace.querySelector('video')) {
        const bottomVideo = document.createElement('video');
        bottomVideo.muted = true;
        bottomVideo.playsInline = true;
        bottomVideo.setAttribute('playsinline', '');
        bottomVideo.preload = 'metadata';
        bottomVideo.src = bottomVideoUrl;
        bottomVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0.85;';
        bottomVideo.currentTime = 0.5;
        bottomFace.appendChild(bottomVideo);
        console.log('🖼️ Added thumbnail to BOTTOM face');
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
        
        // Add cache-busting parameter
        const cacheBuster = '_t=' + Date.now() + '_' + queueIdx;
        const videoUrl = videoData.videoUrl + (videoData.videoUrl.includes('?') ? '&' + cacheBuster : '?' + cacheBuster);
        
        // Clean up old listeners
        video.oncanplay = null;
        video.onerror = null;
        video.onloadedmetadata = null;
        
        let resolved = false;
        
        // Wait for canplay (video is ready to play without buffering)
        video.oncanplay = function() {
          if (resolved) return;
          resolved = true;
          video.oncanplay = null;
          video.onerror = null;
          
          // Tiny seek to trigger iOS to paint first frame (no play/pause needed)
          video.currentTime = 0.001;
          
          console.log('📹 Face ' + faceId + ' READY: queue[' + queueIdx + '] dur=' + (video.duration || 0).toFixed(1) + 's');
          resolve(video);
        };
        
        video.onerror = function() {
          if (resolved) return;
          resolved = true;
          video.oncanplay = null;
          video.onerror = null;
          console.log('❌ Face ' + faceId + ' error loading queue[' + queueIdx + ']');
          reject('Video load error');
        };
        
        // Update tracking
        faceVideos[faceId] = { element: video, queueIdx: queueIdx };
        
        // Change source (doesn't recreate element)
        video.src = videoUrl;
        video.load();
        
        // Fallback timeout
        setTimeout(() => {
          if (!resolved && video.readyState >= 2) {
            resolved = true;
            video.oncanplay = null;
            video.onerror = null;
            console.log('📹 Face ' + faceId + ' timeout-ready: queue[' + queueIdx + ']');
            resolve(video);
          }
        }, 4000);
      });
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
      // Get rotation targets for current and next face
      const fromTarget = getTargetRotation(videoIndex);
      const toTarget = getTargetRotation(videoIndex + 1);
      
      // HALF-TO-HALF: Offset Y rotation by 45° so video plays from "entering" to "exiting"
      // Instead of 0° to -90°, we do +45° to -45° (face enters from right, exits to left)
      rotationFromX = fromTarget.rotX;
      rotationFromY = fromTarget.rotY + HALF_ANGLE; // Start 45° before center
      rotationToX = toTarget.rotX;
      rotationToY = toTarget.rotY + HALF_ANGLE; // End 45° after center (same offset)
      
      // Set current position to start
      currentRotX = rotationFromX;
      currentRotY = rotationFromY;
      
      // Activate video for rotation sync
      activeVideo = video;
      activeVideoIndex = videoIndex;
      
      console.log('🔄 Half-to-half sync: idx=' + videoIndex + ' from(' + rotationFromX + ',' + rotationFromY + ') to(' + rotationToX + ',' + rotationToY + ')');
    }
    
    function clearRotationSync() {
      activeVideo = null;
      activeVideoIndex = -1;
    }
    
    function preloadUpcoming(fromIndex) {
      for (let ahead = 1; ahead <= 3; ahead++) {
        const idx = fromIndex + ahead;
        if (idx >= fullVideoQueue.length) break;
        const fId = getFaceForIndex(idx);
        const existing = faceVideos[fId];
        if (!existing || existing.queueIdx !== idx) {
          console.log('🔮 Preloading queue[' + idx + '] onto face ' + fId);
          loadVideoOnFace(fId, idx).catch(() => {});
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
      
      if (!fv || !fv.element || fv.queueIdx !== currentIndex) {
        console.log('🔄 Face ' + faceId + ' has wrong video (has ' + (fv ? fv.queueIdx : 'none') + ', need ' + currentIndex + '), reloading...');
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
      
      video.onended = function() {
        if (videoTimeoutId) clearTimeout(videoTimeoutId);
        clearRotationSync();
        console.log('🎬 Video ended naturally: queue[' + playingIndex + ']');
        if (currentIndex === playingIndex) advanceToNext();
      };
      
      console.log('▶️ Playing queue[' + currentIndex + '] on face ' + faceId);
      
      video.play().then(() => {
        console.log('✅ Play started: queue[' + currentIndex + ']');
        postMessage('videoStart', { faceId, queueIndex: currentIndex });
        
        setupRotationSync(video, playingIndex);
        
        preloadUpcoming(playingIndex);
        
        const duration = video.duration;
        const timeout = (duration && isFinite(duration) && duration > 0) 
          ? (duration + 2) * 1000 
          : MAX_VIDEO_DURATION * 1000;
        
        videoTimeoutId = setTimeout(() => {
          console.log('⏰ Timeout: queue[' + playingIndex + '] - forcing advance');
          clearRotationSync();
          if (currentIndex === playingIndex) advanceToNext();
        }, timeout);
        
      }).catch(e => {
        console.log('❌ Play failed: ' + e.message + ', advancing...');
        setTimeout(() => advanceToNext(), 500);
      });
    }
    
    function advanceToNext() {
      currentIndex++;
      console.log('⏭️ Advancing to queue[' + currentIndex + ']');
      
      if (currentIndex >= fullVideoQueue.length) {
        console.log('🏁 All ' + fullVideoQueue.length + ' videos complete!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        isPlaying = false;
        if (floatAnimId) cancelAnimationFrame(floatAnimId);
        showReplayButton();
        return;
      }
      
      clearRotationSync();
      
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
    
    async function handleReplayClick() {
      hideReplayButton();
      console.log('🔄 Replaying: ' + fullVideoQueue.length + ' videos');
      
      // Reset all videos to start
      Object.values(faceVideos).forEach(fv => {
        if (fv && fv.element) {
          fv.element.pause();
          fv.element.currentTime = 0.001;
        }
      });
      
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
      
      // Start first video
      playCurrentVideo();
      
      postMessage('replayStarted', { videoCount: fullVideoQueue.length });
    }
    
    async function handlePlayClick() {
      if (!isReady || isPlaying || hasUserStarted) return;
      hasUserStarted = true; // Block any future showPlayButton calls
      hidePlayButton();
      
      console.log('🎬 Starting playback: ' + fullVideoQueue.length + ' videos');
      
      // Ensure video elements exist
      initFaceVideoElements();
      
      // Reset state (but DON'T clear faceVideos - they're already loaded!)
      currentIndex = 0;
      isPlaying = true;
      
      // Set initial rotation to face 0 with half-to-half offset
      const initial = getTargetRotation(0);
      currentRotX = initial.rotX;
      currentRotY = initial.rotY + HALF_ANGLE; // Start at +45° for half-to-half
      updateCubeTransform(performance.now());
      
      // Videos are already preloaded from init() - no need to reload!
      // Just verify they're ready
      console.log('📦 Using pre-loaded videos (no reload needed)');
      
      postMessage('animationStarted', { videoCount: fullVideoQueue.length });
      
      // Start float animation
      floatStartTime = 0;
      floatAnimId = requestAnimationFrame(floatLoop);
      
      // Play first video immediately (already loaded)
      playCurrentVideo();
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
        
        // Wait for all to be ready
        await Promise.all(loadPromises);
        console.log('✅ All ' + preloadCount + ' initial videos READY');
        
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
        [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]
      ];
      
      var bgStars = [];
      for (var si = 0; si < 60; si++) {
        bgStars.push({ x: Math.random()*RW, y: Math.random()*RH, r: Math.random()*1.5+0.5, a: Math.random()*0.5+0.2 });
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
      
      function drawQuad(fd) {
        var proj = fd.proj;
        var vidEl = faceVideoElements[fd.id];
        var STRIPS = 14;
        
        for (var s = 0; s < STRIPS; s++) {
          var t0 = s/STRIPS, t1 = (s+1)/STRIPS;
          var tl = lrp(proj[0], proj[1], t0);
          var tr2 = lrp(proj[0], proj[1], t1);
          var bl = lrp(proj[3], proj[2], t0);
          var br = lrp(proj[3], proj[2], t1);
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tr2[0],tr2[1]);
          ctx.lineTo(br[0],br[1]); ctx.lineTo(bl[0],bl[1]);
          ctx.closePath(); ctx.clip();
          
          if (vidEl && vidEl.readyState >= 2) {
            var sw = vidEl.videoWidth || 720, sh = vidEl.videoHeight || 720;
            var sx = t0*sw, sW = (t1-t0)*sw;
            var mnX = Math.min(tl[0],tr2[0],bl[0],br[0]);
            var mxX = Math.max(tl[0],tr2[0],bl[0],br[0]);
            var mnY = Math.min(tl[1],tr2[1],bl[1],br[1]);
            var mxY = Math.max(tl[1],tr2[1],bl[1],br[1]);
            try { ctx.drawImage(vidEl, sx, 0, sW, sh, mnX, mnY, mxX-mnX, mxY-mnY); } catch(e) {}
          } else {
            ctx.fillStyle = '#1a1a2e'; ctx.fill();
          }
          ctx.restore();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(proj[0][0],proj[0][1]);
        for (var i = 1; i < 4; i++) ctx.lineTo(proj[i][0],proj[i][1]);
        ctx.closePath(); ctx.stroke();
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
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, RW, RH);
        var grad = ctx.createRadialGradient(RW/2, RH*0.45, 0, RW/2, RH*0.45, RW*0.85);
        grad.addColorStop(0, '#0a0a1a');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, RW, RH);
        
        ctx.fillStyle = '#fff';
        for (var si = 0; si < bgStars.length; si++) {
          var st = bgStars[si];
          ctx.globalAlpha = st.a * (0.4 + 0.6 * Math.sin(elapsed*(0.8+si*0.05)));
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        var visible = [];
        for (var f = 0; f < 4; f++) {
          var fd = computeFace(f, fx, fy, fz + dtz, ds);
          if (fd) visible.push(fd);
        }
        visible.sort(function(a,b) { return a.z - b.z; });
        for (var i = 0; i < visible.length; i++) drawQuad(visible[i]);
        
        recAnimId = requestAnimationFrame(renderRecFrame);
      }
      
      function startRec() {
        if (recState !== 'idle') return;
        recState = 'recording';
        chunks = [];
        
        var stream = cvs.captureStream(30);
        var mimeType = '';
        ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].some(function(m) {
          if (MediaRecorder.isTypeSupported(m)) { mimeType = m; return true; }
        });
        if (!mimeType) {
          postMessage('recordingError', { error: 'No supported format' });
          recState = 'idle'; return;
        }
        
        recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 4000000 });
        recorder.ondataavailable = function(e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = function() {
          recState = 'processing';
          var blob = new Blob(chunks, { type: mimeType });
          console.log('📹 Recording blob: ' + (blob.size/1024/1024).toFixed(1) + 'MB');
          postMessage('recordingProcessing', { sizeBytes: blob.size });
          
          var reader = new FileReader();
          reader.onloadend = function() {
            var b64 = reader.result.split(',')[1];
            var CHUNK = 64 * 1024;
            var total = Math.ceil(b64.length / CHUNK);
            postMessage('recordingMeta', { totalChunks: total, sizeBytes: blob.size, mimeType: mimeType });
            
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
      if (type === 'animationStarted' && window._recEnabled) {
        window._recEnabled = false;
        _recModule.start();
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
  }, [initialFaces]); // Only regenerate when initialFaces is first set

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
          FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          }).then(() => {
            console.log('📹 Recording saved:', fileUri);
            onRecordingComplete?.(fileUri);
            recordingChunksRef.current = [];
            recordingMetaRef.current = null;
          }).catch(err => {
            console.error('📹 Failed to save recording:', err);
            onRecordingComplete?.(null);
          });
          break;
        }
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
