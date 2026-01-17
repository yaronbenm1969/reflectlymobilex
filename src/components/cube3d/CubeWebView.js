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
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
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
    /* Fix video orientation on top/bottom faces so they appear upright */
    .top video, .top img {
      transform: rotateZ(180deg);
    }
    .bottom video, .bottom img {
      transform: rotateZ(180deg);
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
    let animationStarted = false;
    let animationId = null;
    let cycleStartTime = 0;
    let lastFrontFace = -1;
    
    const DEFAULT_VIDEO_DURATION = 5;
    
    // ========== NEW QUEUE SYSTEM ==========
    // All 6 faces in fixed rotation order with target angles
    // Each entry: { faceId, rotX, rotY } - the rotation that makes this face front
    // 6-step rotation path visiting all 6 faces - optimized order to avoid 180° transitions
    // Experimentally verified: rotX=+90 shows TOP, rotX=-90 shows BOTTOM
    const ROTATION_PATH = [
      { faceId: 0, rotX: 0, rotY: 0 },       // 0: Front
      { faceId: 2, rotX: 0, rotY: -90 },     // 1: Right
      { faceId: 4, rotX: 90, rotY: -90 },    // 2: Top
      { faceId: 1, rotX: 0, rotY: -180 },    // 3: Back
      { faceId: 3, rotX: 0, rotY: -270 },    // 4: Left
      { faceId: 5, rotX: -90, rotY: -270 },  // 5: Bottom
    ];
    const VISIBLE_FACES = [0, 2, 1, 3, 4, 5]; // All 6 unique faces for video loading
    
    // Full video queue - all videos to play
    let fullVideoQueue = faces.filter(f => f && f.videoUrl);
    let totalVideosToPlay = fullVideoQueue.length;
    let currentQueueIndex = 0; // Which video in queue is currently playing
    
    // Map visible faces to their current video element
    let faceVideoElements = {}; // faceId -> { element, queueIndex }
    
    // Preload tracking
    let preloadedOnFace = {}; // faceId -> queueIndex (for next video ready to play)
    
    console.log('Queue initialized with ' + totalVideosToPlay + ' videos for ' + VISIBLE_FACES.length + ' visible faces');
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function getFrontFaceFromRotation(rotX, rotY) {
      const normY = ((rotY % 360) + 360) % 360;
      const normX = ((rotX % 360) + 360) % 360;
      
      // rotX=+90 (normX 45-135) tilts cube forward → shows TOP face (4)
      // rotX=-90 (normX 225-315) tilts cube backward → shows BOTTOM face (5)
      if (normX > 45 && normX < 135) return 4;  // TOP
      if (normX > 225 && normX < 315) return 5; // BOTTOM
      
      if (normY >= 315 || normY < 45) return 0;
      if (normY >= 45 && normY < 135) return 3;
      if (normY >= 135 && normY < 225) return 1;
      if (normY >= 225 && normY < 315) return 2;
      
      return 0;
    }
    
    // Calculate visibility percentage for each face (0-1)
    // Uses dot product of face normal with camera direction
    function calculateFaceVisibilities(rotXDeg, rotYDeg, rotZDeg) {
      const toRad = Math.PI / 180;
      const rx = rotXDeg * toRad;
      const ry = rotYDeg * toRad;
      const rz = rotZDeg * toRad;
      
      // Face normals in local space (before rotation)
      const faceNormals = [
        [0, 0, 1],   // Face 0: front (+Z)
        [0, 0, -1],  // Face 1: back (-Z)
        [1, 0, 0],   // Face 2: right (+X)
        [-1, 0, 0],  // Face 3: left (-X)
        [0, 1, 0],   // Face 4: top (+Y)
        [0, -1, 0]   // Face 5: bottom (-Y)
      ];
      
      // Rotation matrix components
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const cz = Math.cos(rz), sz = Math.sin(rz);
      
      // Apply rotation to each normal and get Z component (visibility)
      const visibilities = faceNormals.map(n => {
        // Rotate around Y (ry)
        let x1 = n[0] * cy + n[2] * sy;
        let y1 = n[1];
        let z1 = -n[0] * sy + n[2] * cy;
        
        // Rotate around X (rx)
        let x2 = x1;
        let y2 = y1 * cx - z1 * sx;
        let z2 = y1 * sx + z1 * cx;
        
        // Rotate around Z (rz)
        let x3 = x2 * cz - y2 * sz;
        let y3 = x2 * sz + y2 * cz;
        let z3 = z2;
        
        // Z component = dot product with camera (0,0,1)
        // Convert from [-1,1] to [0,1] visibility
        return (z3 + 1) / 2;
      });
      
      return visibilities;
    }
    
    // ========== QUEUE-BASED SEGMENT SYSTEM ==========
    // Each segment = one video from the queue, played on one of the 4 visible faces
    // Rotation cycles through VISIBLE_FACES order, videos advance through queue
    let cumulativeAngle = -45; // Start so face 0 enters at 50% visibility
    
    // Get which visible face should be "front" for a given queue index
    // Cycles through [0, 2, 1, 3] repeatedly
    function getFaceForQueueIndex(queueIdx) {
      // Use ROTATION_PATH to determine which face shows this video
      const pathIndex = queueIdx % ROTATION_PATH.length;
      return ROTATION_PATH[pathIndex].faceId;
    }
    
    // Get video data from queue
    function getQueueVideo(queueIdx) {
      if (queueIdx >= fullVideoQueue.length) return null;
      return fullVideoQueue[queueIdx];
    }
    
    // Get current video element on a face
    function getVideoElementOnFace(faceId) {
      return faceVideoElements[faceId];
    }
    
    // Get duration of current queue video
    function getCurrentVideoDuration() {
      const faceId = getFaceForQueueIndex(currentQueueIndex);
      const faceVideo = faceVideoElements[faceId];
      if (faceVideo && faceVideo.element) {
        const dur = faceVideo.element.duration;
        if (dur && dur > 0 && isFinite(dur)) return dur;
      }
      return DEFAULT_VIDEO_DURATION;
    }
    
    // FORCE stop all videos - called before starting new one
    function stopAllVideos() {
      Object.values(faceVideoElements).forEach(fv => {
        if (fv && fv.element) {
          fv.element.pause();
          fv.element.muted = true;
          fv.element.volume = 0;
        }
      });
    }
    
    // Get current playing face ID
    function getCurrentFaceId() {
      return getFaceForQueueIndex(currentQueueIndex);
    }
    
    // ========== PER-SEGMENT STATE MACHINE ==========
    // Each segment has a unique token to verify the exact video element
    let loadToken = 0; // Increments with each load to track element identity
    
    // Current segment state
    let currentSegmentState = {
      queueIndex: 0,
      faceId: 0,
      elementToken: -1,
      ready: false
    };
    
    // Load a video from queue onto a specific face
    // Returns the token for this load operation
    function loadVideoOnFace(faceId, queueIdx) {
      const videoData = getQueueVideo(queueIdx);
      if (!videoData) {
        console.log('No video at queue index ' + queueIdx);
        return -1;
      }
      
      const el = document.getElementById('face-' + faceId);
      if (!el) return -1;
      
      // Generate unique token for this load
      const thisToken = ++loadToken;
      
      // Create video element
      let html = '';
      if (videoData.thumbnailUrl) {
        html += '<img src="' + videoData.thumbnailUrl + '" alt="Thumbnail" />';
      }
      html += '<video muted playsinline preload="auto" src="' + videoData.videoUrl + '" style="opacity:1"></video>';
      el.innerHTML = html;
      
      const video = el.querySelector('video');
      if (video) {
        faceVideoElements[faceId] = { element: video, queueIndex: queueIdx, token: thisToken };
        
        // Set ready flag when metadata is loaded - verify token matches
        video.addEventListener('loadedmetadata', function() {
          // Only set ready if this is still the current segment's expected element
          if (currentSegmentState.faceId === faceId && 
              currentSegmentState.queueIndex === queueIdx && 
              currentSegmentState.elementToken === thisToken) {
            currentSegmentState.ready = true;
            console.log('Video ready: face ' + faceId + ' queue[' + queueIdx + '] token=' + thisToken + ' dur=' + video.duration.toFixed(1) + 's');
          }
        });
        
        console.log('Loaded queue[' + queueIdx + '] onto face ' + faceId + ' token=' + thisToken);
        return thisToken;
      }
      return -1;
    }
    
    // Prepare the current segment - load video and set state
    function prepareCurrentSegment() {
      const faceId = getFaceForQueueIndex(currentQueueIndex);
      const existingFace = faceVideoElements[faceId];
      
      // Check if correct video is already loaded on this face
      if (existingFace && existingFace.queueIndex === currentQueueIndex) {
        // Already loaded - just update segment state
        currentSegmentState = {
          queueIndex: currentQueueIndex,
          faceId: faceId,
          elementToken: existingFace.token,
          ready: false // Will be set by loadedmetadata if already fired
        };
        
        // Check if already ready
        const vid = existingFace.element;
        if (vid && vid.readyState >= 1 && vid.duration > 0 && isFinite(vid.duration)) {
          currentSegmentState.ready = true;
        }
      } else {
        // Need to load new video
        const token = loadVideoOnFace(faceId, currentQueueIndex);
        currentSegmentState = {
          queueIndex: currentQueueIndex,
          faceId: faceId,
          elementToken: token,
          ready: false
        };
      }
      
      console.log('Prepared segment: queue[' + currentQueueIndex + '] face=' + faceId + ' token=' + currentSegmentState.elementToken);
    }
    
    // Check if current segment is ready to play
    // CRITICAL: Check video element directly, don't rely only on ready flag
    function isCurrentSegmentReady() {
      const faceId = getFaceForQueueIndex(currentQueueIndex);
      const faceVideo = faceVideoElements[faceId];
      
      if (!faceVideo) return false;
      if (faceVideo.queueIndex !== currentQueueIndex) return false;
      if (!faceVideo.element) return false;
      
      const vid = faceVideo.element;
      const dur = vid.duration;
      
      // Video is ready if metadata is loaded (readyState >= 1) and duration is valid
      if (vid.readyState >= 1 && dur && isFinite(dur) && dur > 0) {
        // Update the ready flag for consistency
        if (currentSegmentState.queueIndex === currentQueueIndex) {
          currentSegmentState.ready = true;
        }
        return true;
      }
      
      return false;
    }
    
    // Start playing the current queue video
    // Called ONLY when segment starts AND video is already confirmed ready
    // IMPORTANT: Do NOT reload or change face content here - readiness already confirmed
    let videoPlaybackStarted = false;
    
    function startCurrentVideo() {
      if (currentQueueIndex >= fullVideoQueue.length) {
        console.log('All ' + fullVideoQueue.length + ' videos completed!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        stopAllVideos();
        animationStarted = false;
        return false;
      }
      
      const faceId = getFaceForQueueIndex(currentQueueIndex);
      let faceVideo = faceVideoElements[faceId];
      
      // Check if correct video is loaded, if not try to load it
      if (!faceVideo || !faceVideo.element || faceVideo.queueIndex !== currentQueueIndex) {
        console.log('Video not ready on face ' + faceId + ' for queue[' + currentQueueIndex + '], loading now');
        loadVideoOnFace(faceId, currentQueueIndex);
        faceVideo = faceVideoElements[faceId];
        if (!faceVideo || !faceVideo.element) {
          console.error('Failed to load video for queue[' + currentQueueIndex + ']');
          return false;
        }
      }
      
      // Stop all other videos
      stopAllVideos();
      
      // Start current video
      const video = faceVideo.element;
      video.muted = false;
      video.volume = 1;
      video.currentTime = 0;
      video.style.opacity = '1';
      video.play().catch(e => console.log('Play error: ' + e.message));
      
      // Hide thumbnail
      const faceEl = document.getElementById('face-' + faceId);
      if (faceEl) {
        const img = faceEl.querySelector('img');
        if (img) img.style.opacity = '0';
      }
      
      videoPlaybackStarted = true;
      console.log('Playing queue[' + currentQueueIndex + '/' + fullVideoQueue.length + '] on face ' + faceId);
      postMessage('videoStart', { faceId, queueIndex: currentQueueIndex });
      return true;
    }
    
    // Track rotation progress for segment completion
    let segmentRotationStart = -45;
    
    // Pending preloads - deferred until face is safely out of view
    let pendingPreloads = [];
    
    // Advance to next video in queue - called when segment completes
    function advanceToNextVideo() {
      // The face that just finished should get its NEXT video (if any)
      // It will get queue[currentQueueIndex + 6] (6-step cycle)
      const completedFaceId = getFaceForQueueIndex(currentQueueIndex);
      const nextVideoForThisFace = currentQueueIndex + ROTATION_PATH.length;
      
      // CRITICAL: Don't preload immediately - defer until face is safely out of view
      // The completed face is still visible during the transition, so we schedule
      // the preload for later (after 2 segments have passed)
      if (nextVideoForThisFace < fullVideoQueue.length) {
        pendingPreloads.push({
          faceId: completedFaceId,
          queueIndex: nextVideoForThisFace,
          triggerAfterSegment: currentQueueIndex + 2 // Wait for 2 more segments
        });
        console.log('Scheduled preload: queue[' + nextVideoForThisFace + '] on face ' + completedFaceId + ' after segment ' + (currentQueueIndex + 2));
      }
      
      // Move to next segment
      currentQueueIndex++;
      videoPlaybackStarted = false;
      
      console.log('Advancing to queue[' + currentQueueIndex + '], rotation starts at ' + segmentRotationStart + '°');
      
      // Process any pending preloads that are now safe
      processPendingPreloads();
      
      // Check if all videos done
      if (currentQueueIndex >= fullVideoQueue.length) {
        console.log('All ' + fullVideoQueue.length + ' videos completed!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        stopAllVideos();
        animationStarted = false;
        return false;
      }
      
      // Prepare the next segment (load if needed, set state)
      prepareCurrentSegment();
      
      return true; // Video will be started by animate() when ready
    }
    
    // Process deferred preloads - only when face is safely not in view
    function processPendingPreloads() {
      const currentFaceId = getFaceForQueueIndex(currentQueueIndex);
      const nextFaceId = getFaceForQueueIndex(currentQueueIndex + 1);
      
      const stillPending = [];
      for (const preload of pendingPreloads) {
        // Don't load if this face is current or next (still visible/transitioning)
        if (preload.faceId === currentFaceId || preload.faceId === nextFaceId) {
          stillPending.push(preload);
          continue;
        }
        
        // Only load if we've passed the trigger segment
        if (currentQueueIndex >= preload.triggerAfterSegment) {
          loadVideoOnFace(preload.faceId, preload.queueIndex);
          console.log('Executed preload: queue[' + preload.queueIndex + '] on face ' + preload.faceId);
        } else {
          stillPending.push(preload);
        }
      }
      pendingPreloads = stillPending;
    }
    
    // Enforce that only current face's video is playing (called every frame)
    function enforceCurrentVideoOnly() {
      const currentFaceId = getCurrentFaceId();
      VISIBLE_FACES.forEach(faceId => {
        const fv = faceVideoElements[faceId];
        if (!fv || !fv.element) return;
        
        if (faceId === currentFaceId) {
          // Current face's video should be unmuted
          if (fv.element.muted) {
            fv.element.muted = false;
            fv.element.volume = 1;
          }
        } else {
          // All other videos MUST be muted and paused
          if (!fv.element.muted || !fv.element.paused) {
            fv.element.muted = true;
            fv.element.volume = 0;
            fv.element.pause();
          }
        }
      });
    }
    
    // ANIMATION: Time-based rotation with video sync
    // Rotation driven by segment timer, video plays alongside
    // Each segment = 90° rotation over video duration
    // Segment starts ONLY when video is confirmed ready (loadedmetadata fired)
    let segmentStartTimestamp = 0;
    let currentSegmentDuration = DEFAULT_VIDEO_DURATION;
    let segmentDurationLocked = false;
    let waitingForVideo = true;
    let waitingStartTime = 0;
    const MAX_WAIT_TIME = 10000; // 10 second timeout for video to be ready
    
    function animate(timestamp) {
      if (!cycleStartTime) {
        cycleStartTime = timestamp;
        waitingStartTime = timestamp;
      }
      
      const elapsed = (timestamp - cycleStartTime) / 1000;
      const currentFaceId = getCurrentFaceId();
      
      // STATE: Waiting for video to be ready before segment starts
      if (waitingForVideo) {
        // Ensure segment is prepared (sets currentSegmentState)
        if (currentSegmentState.queueIndex !== currentQueueIndex) {
          prepareCurrentSegment();
          waitingStartTime = timestamp;
        }
        
        // Check if video is ready using token-verified state
        const isReady = isCurrentSegmentReady();
        const waitTime = timestamp - waitingStartTime;
        
        if (isReady) {
          // Video confirmed ready via loadedmetadata with correct token
          const faceVideo = faceVideoElements[currentSegmentState.faceId];
          const dur = faceVideo.element.duration;
          currentSegmentDuration = dur;
          segmentDurationLocked = true;
          segmentStartTimestamp = timestamp; // Segment starts NOW at 50% entry
          waitingForVideo = false;
          
          // Start video playback exactly at segment start
          startCurrentVideo();
          console.log('Segment started: queue[' + currentQueueIndex + '] duration=' + dur.toFixed(1) + 's');
        } else if (waitTime > MAX_WAIT_TIME) {
          // Timeout - NEVER start segment without confirmed loadedmetadata
          // Skip this video and try next one
          console.error('Video load timeout for queue[' + currentQueueIndex + '] on face ' + currentFaceId + ', skipping');
          postMessage('videoError', { queueIndex: currentQueueIndex, faceId: currentFaceId, error: 'load_timeout' });
          
          // Advance to next video (keeps rotation paused until next video ready)
          if (!advanceToNextVideo()) {
            return; // All done or all failed
          }
          waitingStartTime = timestamp; // Reset wait timer for next video
        }
        
        // While waiting, hold at current target rotation (with cycle offset)
        const cycleNumber = Math.floor(currentQueueIndex / ROTATION_PATH.length);
        const pathIndex = currentQueueIndex % ROTATION_PATH.length;
        const currentTarget = ROTATION_PATH[pathIndex];
        const rotX = currentTarget.rotX;
        const rotY = currentTarget.rotY - (cycleNumber * 360);
        const rotZ = 0;
        
        const spinWrapper = document.getElementById('spin-wrapper');
        if (spinWrapper) {
          spinWrapper.style.transform = 'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) rotateZ(' + rotZ + 'deg)';
        }
        
        enforceCurrentVideoOnly();
        animationId = requestAnimationFrame(animate);
        return;
      }
      
      // STATE: Segment is running - calculate progress based on TIME
      const segmentElapsed = (timestamp - segmentStartTimestamp) / 1000;
      let segmentProgress = Math.min(segmentElapsed / currentSegmentDuration, 1);
      
      // Check if segment completed
      if (segmentProgress >= 1) {
        console.log('Segment complete: queue[' + currentQueueIndex + '] after ' + segmentElapsed.toFixed(1) + 's');
        
        // Move to next segment
        if (!advanceToNextVideo()) {
          return; // All done
        }
        
        // Reset for next segment - will wait for video
        waitingForVideo = true;
        segmentDurationLocked = false;
        currentSegmentDuration = DEFAULT_VIDEO_DURATION;
        segmentProgress = 0;
      }
      
      // ========== FIXED ROTATION PATH WITH CYCLE OFFSET ==========
      // Calculate which cycle we're in (6 videos per cycle)
      const cycleNumber = Math.floor(currentQueueIndex / ROTATION_PATH.length);
      const pathIndex = currentQueueIndex % ROTATION_PATH.length;
      const nextCycleNumber = Math.floor((currentQueueIndex + 1) / ROTATION_PATH.length);
      const nextPathIndex = (currentQueueIndex + 1) % ROTATION_PATH.length;
      
      // Get base rotations from path
      const currentBase = ROTATION_PATH[pathIndex];
      const nextBase = ROTATION_PATH[nextPathIndex];
      
      // Apply cycle offset: each complete cycle adds 360° to Y rotation
      // This ensures smooth continuation when looping back to front
      const currentRotX = currentBase.rotX;
      const currentRotY = currentBase.rotY - (cycleNumber * 360);
      const nextRotX = nextBase.rotX;
      const nextRotY = nextBase.rotY - (nextCycleNumber * 360);
      
      // Interpolate between current and next rotation
      const rotX = currentRotX + (nextRotX - currentRotX) * segmentProgress;
      const rotY = currentRotY + (nextRotY - currentRotY) * segmentProgress;
      const rotZ = 0; // No Z rotation in fixed path
      
      // Float effects (original animation)
      const floatX = Math.sin(elapsed * 0.5) * 22 + 
                     Math.sin(elapsed * 0.3) * 13;
      const floatY = Math.sin(elapsed * 0.4 + 1) * 26 + 
                     Math.cos(elapsed * 0.25) * 16;
      const floatZ = Math.sin(elapsed * 0.35 + 2) * 38 + 
                     Math.cos(elapsed * 0.2) * 20;
      
      // Depth effects (original animation)
      const depthPhase1 = Math.sin(elapsed * 0.15) * 0.22;
      const depthPhase2 = Math.sin(elapsed * 0.4 + 1.5) * 0.11;
      const depthScale = 0.95 + depthPhase1 + depthPhase2;
      
      const depthTranslateZ = Math.sin(elapsed * 0.18 + 2) * 110 + 
                              Math.cos(elapsed * 0.12) * 70;
      
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
      
      // ENFORCE: Only current segment video plays (check every frame)
      enforceCurrentVideoOnly();
      
      // Track front face for logging
      const frontFace = getFrontFaceFromRotation(rotX, rotY);
      if (frontFace !== lastFrontFace) {
        lastFrontFace = frontFace;
        postMessage('faceChanged', { faceIndex: frontFace, queueIndex: currentQueueIndex });
      }
      
      animationId = requestAnimationFrame(animate);
    }
    
        
    function startAnimation() {
      if (animationStarted) return;
      
      const estimatedDuration = fullVideoQueue.length * DEFAULT_VIDEO_DURATION;
      console.log('Starting queue animation. ' + fullVideoQueue.length + ' videos (est: ' + estimatedDuration + 's)');
      postMessage('animationStarted', { videoCount: fullVideoQueue.length, estimatedDuration });
      
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
      
      // Reset all queue state
      currentQueueIndex = 0;
      segmentRotationStart = -45;
      lastFrontFace = -1;
      videoPlaybackStarted = false;
      waitingForVideo = true;
      waitingStartTime = 0;
      segmentDurationLocked = false;
      currentSegmentDuration = DEFAULT_VIDEO_DURATION;
      loadToken = 0;
      
      // Clear any existing face video elements
      faceVideoElements = {};
      currentSegmentState = { queueIndex: -1, faceId: -1, elementToken: -1, ready: false };
      
      console.log('Starting queue playback: ' + fullVideoQueue.length + ' videos');
      console.log('Face order (cycling): ' + VISIBLE_FACES.join(' → '));
      
      // Load first 6 videos onto all 6 faces
      for (let i = 0; i < Math.min(fullVideoQueue.length, ROTATION_PATH.length); i++) {
        const faceId = getFaceForQueueIndex(i);
        loadVideoOnFace(faceId, i);
      }
      
      // Prepare first segment state
      prepareCurrentSegment();
      
      // Start animation - video will start when ready in animate()
      startAnimation();
    }
    
    function tryStartAnimation() {
      // Ready when we have at least 1 video in the queue
      if (fullVideoQueue.length > 0) {
        isReady = true;
        console.log('Queue ready with ' + fullVideoQueue.length + ' videos. Waiting for play button click.');
        postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
        showPlayButton();
      }
    }
    
    function setFaceContent(faceId, face) {
      const el = document.getElementById('face-' + faceId);
      if (!el) return;
      
      // For queue system: only show thumbnails initially, no video preload
      // Videos are loaded via loadVideoOnFace when playback starts
      if (face && face.thumbnailUrl) {
        el.innerHTML = '<img src="' + face.thumbnailUrl + '" alt="Thumbnail" />';
      } else if (face && face.videoUrl) {
        // Just show gradient placeholder (no badge)
        el.innerHTML = '';
      } else {
        el.innerHTML = '<div class="placeholder"><span class="icon">🎬</span><span class="label">סרטון ' + (faceId + 1) + '</span></div>';
      }
    }
    
    // Legacy function - kept for compatibility, but queue system handles loading now
    function loadNewVideoOnFaceLegacy(faceId, videoData, videoIndex) {
      console.log('loadNewVideoOnFaceLegacy DEPRECATED - use loadVideoOnFace instead');
    }
    
    function init() {
      // Set up initial face content using ROTATION_PATH order
      // Each queue index maps to a specific physical face via getFaceForQueueIndex
      for (let queueIdx = 0; queueIdx < Math.min(fullVideoQueue.length, ROTATION_PATH.length); queueIdx++) {
        const faceId = getFaceForQueueIndex(queueIdx);
        const video = getQueueVideo(queueIdx);
        if (video) {
          setFaceContent(faceId, video);
          console.log('Init: queue[' + queueIdx + '] thumbnail on face ' + faceId);
        }
      }
      
      postMessage('cubeReady', { faceCount: fullVideoQueue.length });
      
      // Try to show play button immediately if queue has videos
      setTimeout(tryStartAnimation, 500);
    }
    
    window.updateFaces = function(newFaces) {
      // Update fullVideoQueue with new faces that have videos
      const validFaces = newFaces.filter(f => f && f.videoUrl);
      if (validFaces.length > fullVideoQueue.length) {
        fullVideoQueue = validFaces;
        totalVideosToPlay = fullVideoQueue.length;
        console.log('Queue updated: ' + totalVideosToPlay + ' videos');
      }
      
      // Check if we can start now
      if (!isReady && fullVideoQueue.length > 0) {
        tryStartAnimation();
      }
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
