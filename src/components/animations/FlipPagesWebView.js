import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 340);
const PAGE_HEIGHT = PAGE_WIDTH * 1.4;

const FLIP_HTML_DIR = FileSystem.cacheDirectory + 'flip_pages_v1/';

const FlipPagesWebView = ({
  faces = [],
  storyName = '',
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
  
  console.log('📖 FlipPagesWebView received faces:', faces.length, 'hasInitialized:', hasInitializedRef.current);
  faces.forEach((f, i) => {
    console.log(`📖 Face ${i}: videoUrl=${f?.videoUrl ? 'exists' : 'MISSING'}, playerName=${f?.playerName}`);
  });
  
  useEffect(() => {
    if (hasInitializedRef.current) return;
    const minRequired = Math.min(4, faces.length);
    const readyCount = faces.slice(0, 4).filter(f => f?.videoUrl).length;
    
    console.log(`📖 FlipPages check: minRequired=${minRequired}, readyCount=${readyCount}, faces.length=${faces.length}`);
    
    if (minRequired > 0 && readyCount >= minRequired) {
      console.log(`📖 All ${minRequired} initial videos ready - initializing flip pages`);
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
      console.log(`📖 Sending ${newVideos.length} additional videos to WebView`);
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
      console.log('📖 Auto-play triggered via prop');
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
      console.log('📖 Recording next playback requested');
      webViewRef.current.injectJavaScript(`
        shouldRecordNext = true;
        true;
      `);
    }
  }, [recordNextPlayback]);

  const flipHTML = useMemo(() => {
    if (!initialFaces || initialFaces.length === 0) return null;
    
    const facesJSON = JSON.stringify(initialFaces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
    })));
    const safeStoryName = (storyName || 'הסיפור שלי').replace(/'/g, "\\'").replace(/"/g, '&quot;');

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
      background: #1a1a2e;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .book-container {
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      position: relative;
      perspective: 1500px;
    }
    .book-spine {
      position: absolute;
      right: -10px;
      top: -3px;
      width: 12px;
      height: calc(100% + 6px);
      background: linear-gradient(90deg, #6B3410, #8B4513, #6B3410);
      border-radius: 2px 0 0 2px;
      box-shadow: inset 0 0 6px rgba(0,0,0,0.5), 2px 0 6px rgba(0,0,0,0.3);
      z-index: 50;
    }
    .book-cover-back {
      position: absolute;
      width: calc(100% + 6px);
      height: calc(100% + 6px);
      top: -3px;
      right: -12px;
      background: linear-gradient(145deg, #5C2D0E, #3A1A06);
      border-radius: 4px 10px 10px 4px;
      box-shadow: 4px 6px 20px rgba(0,0,0,0.6), inset 0 0 15px rgba(0,0,0,0.2);
      z-index: -1;
    }
    .page-stack-right {
      position: absolute;
      right: -4px;
      top: 4px;
      width: 6px;
      height: calc(100% - 8px);
      z-index: 5;
      pointer-events: none;
      transition: height 0.8s ease;
    }
    .page-stack-line {
      position: absolute;
      right: 0;
      width: 100%;
      height: 1px;
      border-radius: 0 1px 1px 0;
    }
    .page-edges {
      position: absolute;
      bottom: -3px;
      right: 0;
      width: 90%;
      height: 8px;
      background: repeating-linear-gradient(
        90deg,
        #f5f0e8 0px, #f5f0e8 2px,
        #e0d8cc 2px, #e0d8cc 3px
      );
      border-radius: 0 0 4px 4px;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      z-index: -1;
      transition: width 0.8s ease;
    }
    .page {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      border-radius: 4px 8px 8px 4px;
      overflow: visible;
    }
    .page-front, .page-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 4px 8px 8px 4px;
      overflow: hidden;
    }
    .page-front {
      z-index: 2;
      background: linear-gradient(145deg, #f5f0e8, #ebe4d8);
      box-shadow: -3px 0 10px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15);
    }
    .page-back {
      transform: rotateY(-180deg);
      background: linear-gradient(145deg, #d4c9b8, #c7b9a5);
      box-shadow: inset 0 0 30px rgba(0,0,0,0.08);
    }
    .page-back-pattern {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0.15;
      background: 
        repeating-linear-gradient(0deg, transparent, transparent 12px, rgba(139,69,19,0.08) 12px, rgba(139,69,19,0.08) 13px),
        repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(139,69,19,0.05) 12px, rgba(139,69,19,0.05) 13px);
    }
    .page-back-label {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      text-align: center;
      color: rgba(139,69,19,0.25);
      font-size: 14px;
      font-style: italic;
      letter-spacing: 2px;
    }
    .page video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px 8px 8px 4px;
    }
    .book-cover {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      z-index: 100;
      border-radius: 4px 10px 10px 4px;
      cursor: pointer;
    }
    .book-cover-face {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 4px 10px 10px 4px;
      overflow: hidden;
    }
    .book-cover-front-face {
      background: linear-gradient(160deg, #8B4513 0%, #654321 30%, #5C3317 50%, #8B4513 70%, #A0522D 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 3px 4px 15px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.15);
      border: 2px solid rgba(139,69,19,0.4);
    }
    .cover-border {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      bottom: 12px;
      border: 1px solid rgba(212,175,55,0.35);
      border-radius: 4px;
      pointer-events: none;
    }
    .cover-border-inner {
      position: absolute;
      top: 18px;
      left: 18px;
      right: 18px;
      bottom: 18px;
      border: 1px solid rgba(212,175,55,0.2);
      border-radius: 2px;
      pointer-events: none;
    }
    .cover-title {
      color: #D4AF37;
      font-size: 26px;
      font-weight: bold;
      text-align: center;
      padding: 0 30px;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.4;
      letter-spacing: 1px;
      z-index: 2;
    }
    .cover-ornament {
      width: 60px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #D4AF37, transparent);
      margin: 16px auto;
      z-index: 2;
    }
    .cover-subtitle {
      color: rgba(212,175,55,0.6);
      font-size: 13px;
      text-align: center;
      letter-spacing: 3px;
      text-transform: uppercase;
      z-index: 2;
    }
    .cover-icon {
      font-size: 40px;
      margin-bottom: 20px;
      z-index: 2;
      opacity: 0.8;
    }
    .book-cover-inside {
      transform: rotateY(-180deg);
      background: linear-gradient(145deg, #c7b9a5, #b8a890);
    }
    .book-shadow {
      position: absolute;
      bottom: -15px;
      right: 5%;
      width: 90%;
      height: 15px;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, transparent 70%);
      filter: blur(6px);
      z-index: -2;
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
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .play-button .play-icon {
      width: 0;
      height: 0;
      border-left: 28px solid #FF6B9D;
      border-top: 18px solid transparent;
      border-bottom: 18px solid transparent;
      margin-left: 6px;
    }
    .play-button.hidden, .replay-button.hidden { display: none; }
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
    }
    .replay-button .replay-icon {
      font-size: 36px;
      color: #FF6B9D;
    }
  </style>
</head>
<body>
  <button class="play-button hidden" id="play-button" onclick="handlePlayClick()">
    <div class="play-icon"></div>
  </button>
  <button class="replay-button hidden" id="replay-button" onclick="handleReplayClick()">
    <div class="replay-icon">↻</div>
  </button>
  
  <div class="book-container" id="book">
    <div class="book-cover-back"></div>
    <div class="book-spine"></div>
    <div class="page-stack-right" id="page-stack-right"></div>
    <div class="page-edges" id="page-edges-bottom"></div>
    <div class="page" id="page-3" style="z-index:10;transform:rotateY(0deg);">
      <div class="page-front" id="front-3"></div>
      <div class="page-back" id="back-3"><div class="page-back-pattern"></div><div class="page-back-label"></div></div>
    </div>
    <div class="page" id="page-2" style="z-index:20;transform:rotateY(0deg);">
      <div class="page-front" id="front-2"></div>
      <div class="page-back" id="back-2"><div class="page-back-pattern"></div><div class="page-back-label"></div></div>
    </div>
    <div class="page" id="page-1" style="z-index:30;transform:rotateY(0deg);">
      <div class="page-front" id="front-1"></div>
      <div class="page-back" id="back-1"><div class="page-back-pattern"></div><div class="page-back-label"></div></div>
    </div>
    <div class="page" id="page-0" style="z-index:40;transform:rotateY(0deg);">
      <div class="page-front" id="front-0"></div>
      <div class="page-back" id="back-0"><div class="page-back-pattern"></div><div class="page-back-label"></div></div>
    </div>
    <div class="book-cover" id="book-cover" style="transform:rotateY(0deg);">
      <div class="book-cover-face book-cover-front-face">
        <div class="cover-border"></div>
        <div class="cover-border-inner"></div>
        <div class="cover-icon">📖</div>
        <div class="cover-title">${safeStoryName}</div>
        <div class="cover-ornament"></div>
        <div class="cover-subtitle">Reflectly</div>
      </div>
      <div class="book-cover-face book-cover-inside"><div class="page-back-pattern" style="opacity:0.1;"></div></div>
    </div>
    <div class="book-shadow"></div>
  </div>
  
  <script>
    const faces = ${facesJSON};
    let fullVideoQueue = faces.filter(f => f && f.videoUrl);
    let currentIndex = 0;
    let isPlaying = false;
    let isReady = false;
    let hasUserStarted = false;
    const pageVideos = {};
    let totalPages = fullVideoQueue.length;
    let flippedCount = 0;
    
    console.log('📖 Flip Pages init: ' + fullVideoQueue.length + ' videos');
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function buildPageStack() {
      var stackEl = document.getElementById('page-stack-right');
      if (!stackEl) return;
      stackEl.innerHTML = '';
      var remaining = Math.max(0, totalPages - flippedCount - 1);
      var maxLines = Math.min(remaining, 8);
      var stackHeight = stackEl.offsetHeight || 400;
      for (var i = 0; i < maxLines; i++) {
        var line = document.createElement('div');
        line.className = 'page-stack-line';
        var spacing = stackHeight / (maxLines + 1);
        line.style.top = (spacing * (i + 1)) + 'px';
        var shade = Math.round(220 - i * 8);
        line.style.background = 'rgb(' + shade + ',' + (shade - 10) + ',' + (shade - 20) + ')';
        line.style.boxShadow = '1px 0 2px rgba(0,0,0,0.15)';
        stackEl.appendChild(line);
      }
      var edgesEl = document.getElementById('page-edges-bottom');
      if (edgesEl) {
        var edgeWidth = Math.max(20, 90 - (flippedCount / totalPages) * 60);
        edgesEl.style.width = edgeWidth + '%';
      }
    }
    
    function initPageVideos() {
      for (var i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        var frontEl = document.getElementById('front-' + i);
        if (frontEl && !pageVideos[i]) {
          var video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('crossorigin', 'anonymous');
          video.crossOrigin = 'anonymous';
          video.preload = 'auto';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          video.src = fullVideoQueue[i].videoUrl;
          frontEl.appendChild(video);
          pageVideos[i] = video;
          console.log('📄 Created video on page ' + i);
        }
      }
    }
    
    var activeFlipAnim = null;
    
    var activeFlipElement = null;
    
    function animateFlip(element, duration, onComplete) {
      var start = performance.now();
      if (activeFlipAnim) {
        cancelAnimationFrame(activeFlipAnim);
        if (activeFlipElement) {
          activeFlipElement.style.transform = 'rotateY(180deg)';
          activeFlipElement.style.zIndex = 1;
        }
        activeFlipAnim = null;
      }
      
      activeFlipElement = element;
      var pageSlot = parseInt(element.id.split('-')[1]);
      element.style.zIndex = 200;
      
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        var rotateY = ease * 180;
        
        var liftAmount = Math.sin(t * Math.PI) * 15;
        
        var bendPhase = Math.sin(t * Math.PI);
        var skewAmount;
        if (t < 0.3) {
          skewAmount = bendPhase * 6;
        } else if (t < 0.5) {
          skewAmount = bendPhase * 4;
        } else if (t < 0.7) {
          skewAmount = -bendPhase * 5;
        } else {
          skewAmount = -bendPhase * 3;
        }
        
        var perspShift = Math.sin(t * Math.PI) * 3;
        
        element.style.transform = 
          'perspective(800px) ' +
          'rotateY(' + rotateY + 'deg) ' +
          'translateZ(' + liftAmount + 'px) ' +
          'translateY(' + (-perspShift) + 'px) ' +
          'skewY(' + skewAmount + 'deg)';
        
        if (t < 1) {
          activeFlipAnim = requestAnimationFrame(frame);
        } else {
          element.style.transform = 'rotateY(180deg)';
          element.style.zIndex = 1;
          activeFlipAnim = null;
          activeFlipElement = null;
          if (onComplete) onComplete();
        }
      }
      activeFlipAnim = requestAnimationFrame(frame);
    }
    
    function animateCoverOpen(onComplete) {
      var cover = document.getElementById('book-cover');
      if (!cover) { if (onComplete) onComplete(); return; }
      
      var start = performance.now();
      var duration = 1800;
      
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        var rotateY = ease * 180;
        var lift = Math.sin(t * Math.PI) * 5;
        
        cover.style.transform = 'rotateY(' + rotateY + 'deg) translateZ(' + lift + 'px)';
        
        if (t >= 0.7 && cover.style.zIndex !== '0') {
          cover.style.zIndex = '0';
        }
        
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          cover.style.transform = 'rotateY(180deg)';
          cover.style.zIndex = '0';
          cover.style.pointerEvents = 'none';
          if (onComplete) onComplete();
        }
      }
      requestAnimationFrame(frame);
    }
    
    var nextBatchPrepared = false;
    
    function prepareNextBatchBehindLastPage() {
      var nextBatchStart = currentIndex + 1;
      if (nextBatchStart >= fullVideoQueue.length) return;
      if ((currentIndex + 1) % 4 !== 0) return;
      if (nextBatchPrepared) return;
      nextBatchPrepared = true;
      
      console.log('📖 Pre-loading next batch behind page-3');
      
      var lastPageSlot = currentIndex % 4;
      var lastPage = document.getElementById('page-' + lastPageSlot);
      if (lastPage) {
        lastPage.style.zIndex = 200;
      }
      
      for (var i = 0; i < 4; i++) {
        if (i === lastPageSlot) continue;
        var page = document.getElementById('page-' + i);
        if (page) {
          page.style.transition = 'none';
          page.style.transform = 'rotateY(0deg)';
          page.style.zIndex = (4 - i) * 10;
        }
      }
      
      var batchStart = nextBatchStart;
      for (var i = 0; i < Math.min(4, fullVideoQueue.length - batchStart); i++) {
        if (i === lastPageSlot) continue;
        var video = pageVideos[i];
        if (video && fullVideoQueue[batchStart + i]) {
          video.muted = true;
          video.src = fullVideoQueue[batchStart + i].videoUrl;
          video.load();
        }
      }
    }
    
    function finishBatchTransition(batchStartIdx) {
      nextBatchPrepared = false;
      
      var lastPageSlot = (batchStartIdx - 1) % 4;
      var lastPage = document.getElementById('page-' + lastPageSlot);
      if (lastPage) {
        lastPage.style.transition = 'none';
        lastPage.style.transform = 'rotateY(0deg)';
        lastPage.style.zIndex = (4 - lastPageSlot) * 10;
      }
      
      var slotForFirst = 0;
      var firstVideo = pageVideos[slotForFirst];
      if (firstVideo && fullVideoQueue[batchStartIdx]) {
        firstVideo.muted = true;
        firstVideo.src = fullVideoQueue[batchStartIdx].videoUrl;
        firstVideo.load();
      }
      
      if (lastPageSlot !== 0) {
        for (var i = 0; i < Math.min(4, fullVideoQueue.length - batchStartIdx); i++) {
          var video = pageVideos[i];
          if (video && fullVideoQueue[batchStartIdx + i]) {
            video.muted = true;
            if (video.src !== fullVideoQueue[batchStartIdx + i].videoUrl) {
              video.src = fullVideoQueue[batchStartIdx + i].videoUrl;
              video.load();
            }
          }
        }
      }
      
      flippedCount = batchStartIdx;
      buildPageStack();
      
      playCurrentVideo();
    }
    
    function flipPage(pageIndex, onComplete) {
      var page = document.getElementById('page-' + (pageIndex % 4));
      if (page) {
        flippedCount++;
        buildPageStack();
        console.log('📖 Flipping page ' + pageIndex + ' (flipped: ' + flippedCount + '/' + totalPages + ')');
        animateFlip(page, 1200, onComplete);
      } else {
        if (onComplete) onComplete();
      }
    }
    
    function resetAllPages() {
      if (activeFlipAnim) { cancelAnimationFrame(activeFlipAnim); activeFlipAnim = null; activeFlipElement = null; }
      for (var i = 0; i < 4; i++) {
        var page = document.getElementById('page-' + i);
        if (page) {
          page.style.transform = 'rotateY(0deg)';
          page.style.zIndex = (4 - i) * 10;
        }
      }
      flippedCount = 0;
      buildPageStack();
    }
    
    window.addVideosToQueue = function(newVideos) {
      newVideos.forEach(function(v) {
        fullVideoQueue.push(v);
      });
      totalPages = fullVideoQueue.length;
      buildPageStack();
      console.log('📖 Queue updated: now ' + fullVideoQueue.length + ' videos');
    };
    
    function preloadNextVideo() {
      var nextIdx = currentIndex + 1;
      if (nextIdx >= fullVideoQueue.length) return;
      
      var nextSlot = nextIdx % 4;
      var nextVideo = pageVideos[nextSlot];
      if (nextVideo && fullVideoQueue[nextIdx]) {
        nextVideo.muted = true;
        nextVideo.src = fullVideoQueue[nextIdx].videoUrl;
        nextVideo.load();
        console.log('🔮 Preloaded next video ' + nextIdx + ' on slot ' + nextSlot);
      }
    }
    
    function playCurrentVideo() {
      if (currentIndex >= fullVideoQueue.length) {
        console.log('🏁 All videos complete!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        isPlaying = false;
        showReplayButton();
        return;
      }
      
      var pageSlot = currentIndex % 4;
      var video = pageVideos[pageSlot];
      if (!video) {
        advanceToNext();
        return;
      }
      
      var playingIndex = currentIndex;
      
      Object.values(pageVideos).forEach(function(v) { if (v !== video) v.pause(); });
      
      video.muted = false;
      video.currentTime = 0;
      
      var earlyFlipDone = false;
      
      if ((playingIndex + 1) % 4 === 0 && (playingIndex + 1) < fullVideoQueue.length) {
        prepareNextBatchBehindLastPage();
      }
      
      video.ontimeupdate = function() {
        if (earlyFlipDone) return;
        var remaining = video.duration - video.currentTime;
        if (remaining <= 1.8 && video.duration > 2) {
          earlyFlipDone = true;
          console.log('⚡ Early flip at ' + remaining.toFixed(1) + 's remaining');
          flipPage(playingIndex, null);
        }
      };
      
      video.onended = function() {
        video.ontimeupdate = null;
        if (!earlyFlipDone) {
          flipPage(playingIndex, function() {
            console.log('🎬 Video ended: ' + playingIndex);
            if (currentIndex === playingIndex) advanceToNext();
          });
          return;
        }
        console.log('🎬 Video ended: ' + playingIndex);
        setTimeout(function() {
          if (currentIndex === playingIndex) advanceToNext();
        }, 100);
      };
      
      video.play().then(function() {
        console.log('▶️ Playing video ' + currentIndex + ' (unmuted)');
        postMessage('videoStart', { pageIndex: currentIndex });
        preloadNextVideo();
      }).catch(function(e) {
        console.log('❌ Play failed unmuted, trying muted: ' + e.message);
        video.muted = true;
        video.play().then(function() {
          postMessage('videoStart', { pageIndex: currentIndex });
          preloadNextVideo();
        }).catch(function(e2) {
          console.log('❌ Play failed completely: ' + e2.message);
          setTimeout(function() { advanceToNext(); }, 500);
        });
      });
    }
    
    function advanceToNext() {
      var prevIdx = currentIndex;
      if (isRecording && typeof notifyFlipStarted === 'function') {
        notifyFlipStarted(prevIdx);
      }
      currentIndex++;
      if (currentIndex >= fullVideoQueue.length) {
        console.log('🏁 All videos complete!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        isPlaying = false;
        showReplayButton();
        return;
      }
      
      if (currentIndex % 4 === 0) {
        finishBatchTransition(currentIndex);
      } else {
        playCurrentVideo();
      }
    }
    
    function showPlayButton() {
      if (hasUserStarted || isPlaying) return;
      document.getElementById('play-button')?.classList.remove('hidden');
    }
    
    function hidePlayButton() {
      document.getElementById('play-button')?.classList.add('hidden');
    }
    
    function showReplayButton() {
      document.getElementById('replay-button')?.classList.remove('hidden');
    }
    
    function hideReplayButton() {
      document.getElementById('replay-button')?.classList.add('hidden');
    }
    
    function handlePlayClick() {
      if (!isReady || isPlaying || hasUserStarted) return;
      hasUserStarted = true;
      hidePlayButton();
      
      postMessage('animationStarted', { videoCount: fullVideoQueue.length });
      
      animateCoverOpen(function() {
        currentIndex = 0;
        isPlaying = true;
        buildPageStack();
        playCurrentVideo();
      });
    }
    
    function handleReplayClick() {
      hideReplayButton();
      hasUserStarted = false;
      
      for (var i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        var video = pageVideos[i];
        if (video && fullVideoQueue[i]) {
          video.muted = true;
          video.currentTime = 0;
          video.src = fullVideoQueue[i].videoUrl;
          video.load();
        }
      }
      
      currentIndex = 0;
      isPlaying = false;
      resetAllPages();
      
      var cover = document.getElementById('book-cover');
      if (cover) {
        cover.style.transform = 'rotateY(0deg)';
        cover.style.zIndex = '100';
        cover.style.pointerEvents = '';
      }
      
      setTimeout(function() {
        showPlayButton();
      }, 300);
    }
    
    function init() {
      initPageVideos();
      buildPageStack();
      
      var preloadPromises = Object.values(pageVideos).map(function(video) {
        return new Promise(function(resolve) {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.oncanplay = function() { resolve(); };
            setTimeout(resolve, 5000);
          }
        });
      });
      
      Promise.all(preloadPromises).then(function() {
        console.log('✅ All videos preloaded');
        isReady = true;
        postMessage('cubeReady', { faceCount: fullVideoQueue.length });
        showPlayButton();
      });
    }
    
    // ===== RECORDING MODULE =====
    let recordingCanvas = null;
    let recordingCtx = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let shouldRecordNext = false;
    let recordingAnimFrame = null;
    const REC_W = 720, REC_H = 1280;
    
    function initRecording() {
      const supported = !!(HTMLCanvasElement.prototype.captureStream && typeof MediaRecorder !== 'undefined');
      postMessage('recordingSupport', { supported: supported });
      if (!supported) return;
      
      recordingCanvas = document.createElement('canvas');
      recordingCanvas.width = REC_W;
      recordingCanvas.height = REC_H;
      recordingCtx = recordingCanvas.getContext('2d');
    }
    
    let flipTransitionProgress = -1;
    let flipTransitionStart = 0;
    let prevVideoSlot = -1;
    const FLIP_DURATION = 1200;
    
    function notifyFlipStarted(fromIndex) {
      flipTransitionProgress = 0;
      flipTransitionStart = performance.now();
      prevVideoSlot = fromIndex % 4;
    }
    
    let recCoverProgress = -1;
    let recCoverStart = 0;
    var recCoverDuration = 1800;
    
    function drawRecordingFrame() {
      if (!recordingCtx || !isRecording) return;
      var ctx = recordingCtx;
      var now = performance.now();
      
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, REC_W, REC_H);
      
      var bookW = REC_W * 0.75;
      var bookH = bookW * 1.4;
      var bookX = (REC_W - bookW) / 2;
      var bookY = (REC_H - bookH) / 2;
      var spineW = 14;
      var spineX = bookX + bookW;
      
      if (flipTransitionProgress >= 0) {
        flipTransitionProgress = Math.min(1, (now - flipTransitionStart) / FLIP_DURATION);
      }
      
      function drawVideoOnPage(videoSlot, x, y, w, h, alpha) {
        var video = pageVideos[videoSlot];
        if (!video || video.readyState < 2) {
          ctx.fillStyle = '#f5f0e8';
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, [4, 8, 8, 4]);
          ctx.fill();
          return;
        }
        var vw = video.videoWidth || w;
        var vh = video.videoHeight || h;
        var scale = Math.max(w / vw, h / vh);
        var sw = vw * scale;
        var sh = vh * scale;
        var svx = x + (w - sw) / 2;
        var svy = y + (h - sh) / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, [4, 8, 8, 4]);
        ctx.clip();
        ctx.drawImage(video, svx, svy, sw, sh);
        ctx.restore();
      }
      
      function drawBookShell() {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#3A1A06';
        ctx.beginPath();
        ctx.roundRect(bookX - 4, bookY - 4, bookW + spineW + 8, bookH + 8, [4, 10, 10, 4]);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.restore();
        
        var backGrad = ctx.createLinearGradient(bookX, bookY, bookX + bookW, bookY + bookH);
        backGrad.addColorStop(0, '#5C2D0E');
        backGrad.addColorStop(0.5, '#4A2209');
        backGrad.addColorStop(1, '#3A1A06');
        ctx.fillStyle = backGrad;
        ctx.beginPath();
        ctx.roundRect(bookX - 2, bookY - 2, bookW + 4, bookH + 4, [4, 0, 0, 4]);
        ctx.fill();
        
        var spGrad = ctx.createLinearGradient(spineX, bookY, spineX + spineW, bookY);
        spGrad.addColorStop(0, '#5C2D0E');
        spGrad.addColorStop(0.3, '#8B4513');
        spGrad.addColorStop(0.5, '#A0522D');
        spGrad.addColorStop(0.7, '#8B4513');
        spGrad.addColorStop(1, '#6B3410');
        ctx.fillStyle = spGrad;
        ctx.fillRect(spineX, bookY - 4, spineW, bookH + 8);
        
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(spineX, bookY - 4);
        ctx.lineTo(spineX, bookY + bookH + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(spineX + spineW, bookY - 4);
        ctx.lineTo(spineX + spineW, bookY + bookH + 4);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(160,82,45,0.2)';
        ctx.fillRect(spineX + 3, bookY + 20, spineW - 6, 2);
        ctx.fillRect(spineX + 3, bookY + bookH - 22, spineW - 6, 2);
      }
      
      function drawPageStack() {
        var remaining = Math.max(0, totalPages - flippedCount - 1);
        var stackCount = Math.min(remaining, 8);
        if (stackCount <= 0) return;
        
        var stackThickness = Math.min(stackCount * 2, 12);
        
        for (var i = stackCount - 1; i >= 0; i--) {
          var offset = (i + 1) * (stackThickness / stackCount);
          var shade = Math.round(240 - i * 6);
          ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 8) + ',' + (shade - 18) + ')';
          ctx.beginPath();
          ctx.roundRect(bookX - offset, bookY + 1, bookW + offset, bookH - 2, [4, 0, 0, 4]);
          ctx.fill();
        }
        
        var edgeGrad = ctx.createLinearGradient(bookX - stackThickness, bookY, bookX - stackThickness + 4, bookY);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
        edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(bookX - stackThickness, bookY + 2, 4, bookH - 4);
        
        var bottomRemaining = Math.max(20, 90 - (flippedCount / Math.max(1, totalPages)) * 60);
        var bottomW = bookW * bottomRemaining / 100;
        var bottomX = bookX + (bookW - bottomW) / 2;
        for (var b = 0; b < Math.min(stackCount, 5); b++) {
          var bShade = Math.round(235 - b * 8);
          ctx.fillStyle = 'rgb(' + bShade + ',' + (bShade - 8) + ',' + (bShade - 16) + ')';
          ctx.fillRect(bottomX + b, bookY + bookH + b, bottomW - b * 2, 2);
        }
      }
      
      function drawPageBorder() {
        ctx.strokeStyle = 'rgba(139,69,19,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bookX, bookY, bookW, bookH, [4, 8, 8, 4]);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bookX + bookW - 1, bookY + 4);
        ctx.lineTo(bookX + bookW - 1, bookY + bookH - 4);
        ctx.stroke();
      }
      
      function drawFlippingPage(t, eased) {
        if (prevVideoSlot < 0) return;
        
        var flipProgress = eased;
        var pageW = bookW * Math.abs(Math.cos(flipProgress * Math.PI));
        if (pageW < 2) return;
        
        var isFirstHalf = t < 0.5;
        var pageX;
        
        if (isFirstHalf) {
          pageX = bookX + bookW - pageW;
        } else {
          pageX = bookX - pageW + bookW;
          pageX = bookX + bookW - pageW;
        }
        
        var liftY = Math.sin(t * Math.PI) * 4;
        
        ctx.save();
        
        if (isFirstHalf) {
          ctx.beginPath();
          ctx.moveTo(pageX, bookY - liftY);
          ctx.lineTo(pageX + pageW, bookY);
          ctx.lineTo(pageX + pageW, bookY + bookH);
          ctx.lineTo(pageX, bookY + bookH + liftY);
          ctx.closePath();
          ctx.clip();
          
          var scaleRatio = pageW / bookW;
          ctx.save();
          ctx.translate(pageX + pageW, bookY);
          ctx.scale(-scaleRatio, 1);
          ctx.translate(0, 0);
          var prevVideo = pageVideos[prevVideoSlot];
          if (prevVideo && prevVideo.readyState >= 2) {
            var vw = prevVideo.videoWidth || bookW;
            var vh = prevVideo.videoHeight || bookH;
            var sc = Math.max(bookW / vw, bookH / vh);
            ctx.drawImage(prevVideo, (bookW - vw * sc) / 2, (bookH - vh * sc) / 2, vw * sc, vh * sc);
          } else {
            ctx.fillStyle = '#f5f0e8';
            ctx.fillRect(0, 0, bookW, bookH);
          }
          ctx.restore();
          
          ctx.fillStyle = 'rgba(0,0,0,' + (t * 0.3) + ')';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(pageX, bookY);
          ctx.lineTo(pageX + pageW, bookY - liftY);
          ctx.lineTo(pageX + pageW, bookY + bookH + liftY);
          ctx.lineTo(pageX, bookY + bookH);
          ctx.closePath();
          ctx.clip();
          
          var backGrad2 = ctx.createLinearGradient(pageX, bookY, pageX + pageW, bookY);
          backGrad2.addColorStop(0, '#d4c9b8');
          backGrad2.addColorStop(0.3, '#c7b9a5');
          backGrad2.addColorStop(1, '#bfae98');
          ctx.fillStyle = backGrad2;
          ctx.fillRect(pageX, bookY - liftY, pageW, bookH + liftY * 2);
          
          for (var ln = 0; ln < 8; ln++) {
            var ly = bookY + (bookH / 9) * (ln + 1);
            ctx.strokeStyle = 'rgba(139,69,19,0.06)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(pageX + 8, ly);
            ctx.lineTo(pageX + pageW - 8, ly);
            ctx.stroke();
          }
          
          ctx.fillStyle = 'rgba(0,0,0,' + ((1 - t) * 0.15) + ')';
          ctx.fill();
        }
        
        ctx.restore();
        
        ctx.strokeStyle = 'rgba(100,60,20,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pageX, bookY - liftY);
        ctx.lineTo(pageX, bookY + bookH + liftY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pageX + pageW, bookY - liftY);
        ctx.lineTo(pageX + pageW, bookY + bookH + liftY);
        ctx.stroke();
      }
      
      drawBookShell();
      drawPageStack();
      
      if (recCoverProgress >= 0 && recCoverProgress < 1) {
        recCoverProgress = Math.min(1, (now - recCoverStart) / recCoverDuration);
        var ct = recCoverProgress;
        var cEase = ct < 0.5 ? 2 * ct * ct : -1 + (4 - 2 * ct) * ct;
        
        if (ct > 0.3) {
          drawVideoOnPage(0, bookX, bookY, bookW, bookH, 1);
          drawPageBorder();
        }
        
        var coverPageW = bookW * Math.abs(Math.cos(cEase * Math.PI / 2));
        if (coverPageW > 1) {
          var coverX = bookX + bookW - coverPageW;
          var coverLift = Math.sin(ct * Math.PI) * 3;
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(coverX, bookY - coverLift);
          ctx.lineTo(coverX + coverPageW, bookY);
          ctx.lineTo(coverX + coverPageW, bookY + bookH);
          ctx.lineTo(coverX, bookY + bookH + coverLift);
          ctx.closePath();
          ctx.clip();
          
          if (ct < 0.5) {
            var coverGrad = ctx.createLinearGradient(coverX, bookY, coverX + coverPageW, bookY + bookH);
            coverGrad.addColorStop(0, '#8B4513');
            coverGrad.addColorStop(0.3, '#654321');
            coverGrad.addColorStop(0.7, '#8B4513');
            coverGrad.addColorStop(1, '#A0522D');
            ctx.fillStyle = coverGrad;
            ctx.fillRect(coverX, bookY - coverLift, coverPageW, bookH + coverLift * 2);
            
            ctx.strokeStyle = 'rgba(212,175,55,0.3)';
            ctx.lineWidth = 1;
            var inset = 10 * (coverPageW / bookW);
            ctx.strokeRect(coverX + inset, bookY + 10, coverPageW - inset * 2, bookH - 20);
            
            var textScale = coverPageW / bookW;
            if (textScale > 0.3) {
              ctx.fillStyle = '#D4AF37';
              ctx.font = 'bold ' + Math.round(22 * textScale) + 'px -apple-system, sans-serif';
              ctx.textAlign = 'center';
              ctx.globalAlpha = textScale;
              ctx.fillText('${safeStoryName}', coverX + coverPageW / 2, bookY + bookH / 2);
              ctx.globalAlpha = 1;
            }
          } else {
            var insideGrad = ctx.createLinearGradient(coverX, bookY, coverX + coverPageW, bookY);
            insideGrad.addColorStop(0, '#c7b9a5');
            insideGrad.addColorStop(1, '#b8a890');
            ctx.fillStyle = insideGrad;
            ctx.fillRect(coverX, bookY - coverLift, coverPageW, bookH + coverLift * 2);
            
            ctx.fillStyle = 'rgba(0,0,0,' + ((ct - 0.5) * 0.2) + ')';
            ctx.fillRect(coverX, bookY - coverLift, coverPageW, bookH + coverLift * 2);
          }
          
          ctx.restore();
        }
        
        if (recCoverProgress >= 1) {
          recCoverProgress = -1;
        }
      } else if (flipTransitionProgress >= 0 && flipTransitionProgress < 1) {
        var t = flipTransitionProgress;
        var eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        var slot = currentIndex % 4;
        drawVideoOnPage(slot, bookX, bookY, bookW, bookH, 1);
        drawPageBorder();
        
        drawFlippingPage(t, eased);
        
        if (flipTransitionProgress >= 1) {
          flipTransitionProgress = -1;
          prevVideoSlot = -1;
        }
      } else {
        var cslot = currentIndex % 4;
        drawVideoOnPage(cslot, bookX, bookY, bookW, bookH, 1);
        drawPageBorder();
      }
      
      if (recCoverProgress < 0) {
        var counterText = (currentIndex + 1) + ' / ' + fullVideoQueue.length;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(counterText, REC_W / 2, bookY + bookH + 50);
      }
      
      recordingAnimFrame = requestAnimationFrame(drawRecordingFrame);
    }
    
    function setupFlipAudioCapture(stream) {
      try {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var dest = audioCtx.createMediaStreamDestination();
        var count = 0;
        
        Object.values(pageVideos).forEach(function(video) {
          if (video) {
            try {
              var source = audioCtx.createMediaElementSource(video);
              var gain = audioCtx.createGain();
              gain.gain.value = 1.0;
              source.connect(gain);
              gain.connect(dest);
              gain.connect(audioCtx.destination);
              count++;
            } catch(e) {
              console.warn('📹 Audio source error:', e.message);
            }
          }
        });
        
        dest.stream.getAudioTracks().forEach(function(track) {
          stream.addTrack(track);
        });
        console.log('🔊 FlipPages audio capture: ' + count + ' sources');
        window._flipAudioCtx = audioCtx;
        return true;
      } catch(e) {
        console.warn('🔇 FlipPages audio capture failed:', e.message);
        return false;
      }
    }
    
    function startRecording() {
      if (!recordingCanvas || isRecording) return;
      console.log('📹 FlipPages recording started');
      isRecording = true;
      recordedChunks = [];
      
      const stream = recordingCanvas.captureStream(30);
      setupFlipAudioCapture(stream);
      
      var mimeType = '';
      ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'].some(function(m) {
        if (MediaRecorder.isTypeSupported(m)) { mimeType = m; return true; }
      });
      if (!mimeType) {
        console.log('📹 No supported recording format');
        postMessage('recordingProgress', { phase: 'error' });
        return;
      }
      console.log('📹 FlipPages recording mimeType:', mimeType);
      
      mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
      
      mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = function() {
        console.log('📹 FlipPages MediaRecorder stopped, chunks: ' + recordedChunks.length);
        isRecording = false;
        if (recordingAnimFrame) cancelAnimationFrame(recordingAnimFrame);
        
        const blob = new Blob(recordedChunks, { type: mimeType });
        console.log('📹 Blob size: ' + (blob.size / 1024 / 1024).toFixed(2) + 'MB (' + blob.size + ' bytes)');
        
        if (blob.size < 50000) {
          console.warn('📹 Recording too small (' + blob.size + 'b) - captureStream not working');
          postMessage('recordingFailed', { error: 'Recording too small', sizeBytes: blob.size });
          return;
        }
        
        postMessage('recordingProgress', { phase: 'transferring', progress: 0 });
        
        const reader = new FileReader();
        reader.onload = function() {
          const b64Marker = ';base64,';
          const b64Idx = reader.result.indexOf(b64Marker);
          const base64 = b64Idx >= 0 ? reader.result.substring(b64Idx + b64Marker.length) : reader.result.split(',').slice(1).join(',');
          console.log('📹 FlipPages base64 length: ' + base64.length + ' chars');
          const CHUNK = 512 * 1024;
          const totalChunks = Math.ceil(base64.length / CHUNK);
          
          for (let i = 0; i < totalChunks; i++) {
            const chunk = base64.substring(i * CHUNK, (i + 1) * CHUNK);
            postMessage('recordingData', {
              chunk: chunk,
              chunkIndex: i,
              totalChunks: totalChunks,
              isLast: i === totalChunks - 1,
              mimeType: mimeType
            });
            postMessage('recordingProgress', { 
              phase: 'transferring', 
              progress: Math.round(((i + 1) / totalChunks) * 100)
            });
          }
        };
        reader.readAsDataURL(blob);
      };
      
      mediaRecorder.start(1000);
      drawRecordingFrame();
    }
    
    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('📹 Stopping FlipPages recording');
        mediaRecorder.stop();
      }
      if (window._flipAudioCtx) {
        try { window._flipAudioCtx.close(); } catch(e) {}
        window._flipAudioCtx = null;
      }
    }
    
    var origPostMessage = postMessage;
    postMessage = function(type, data) {
      origPostMessage(type, data);
      if (type === 'animationStarted' && shouldRecordNext) {
        shouldRecordNext = false;
        startRecording();
        recCoverProgress = 0;
        recCoverStart = performance.now();
      }
      if (type === 'allVideosComplete' && isRecording) {
        setTimeout(stopRecording, 500);
      }
    };
    // ===== END RECORDING MODULE =====
    
    init();
    initRecording();
  </script>
</body>
</html>`;
  }, [initialFaces, storyName]);

  useEffect(() => {
    if (!flipHTML) return;
    console.log('📖 Flip pages HTML ready, using inline source with baseUrl');
    setHtmlFilePath('ready');
    setIsLoading(false);
  }, [flipHTML]);

  const recordingChunksRef = useRef([]);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== 'recordingData' && data.type !== 'recordingProgress') {
        console.log('📖 FlipPages message:', data.type);
      }
      
      switch (data.type) {
        case 'cubeReady':
          onReadyToPlay?.();
          break;
        case 'animationStarted':
          onPlaybackStart?.();
          break;
        case 'videoStart':
          onVideoStart?.(data.pageIndex);
          break;
        case 'allVideosComplete':
          onPlaybackComplete?.();
          break;
        case 'recordingSupport':
          onRecordingSupport?.(data.supported);
          break;
        case 'recordingProgress':
          onRecordingProgress?.(data);
          break;
        case 'recordingData':
          if (data.chunkIndex === 0) recordingChunksRef.current = [];
          recordingChunksRef.current.push(data.chunk);
          if (data.isLast) {
            const fullBase64 = recordingChunksRef.current.join('');
            recordingChunksRef.current = [];
            saveRecordingToFile(fullBase64, data.mimeType || '');
          }
          break;
        case 'recordingFailed':
          console.warn('📖 Recording failed (too small):', data.sizeBytes, 'bytes');
          onRecordingComplete?.(null);
          break;
      }
    } catch (e) {
      console.error('📖 Message parse error:', e);
    }
  }, [onReadyToPlay, onPlaybackStart, onVideoStart, onPlaybackComplete, onRecordingSupport, onRecordingProgress, onRecordingComplete]);

  const saveRecordingToFile = useCallback(async (base64Data, mimeType = '') => {
    try {
      onRecordingProgress?.({ phase: 'saving' });
      const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
      console.log('📖 Recording mimeType:', mimeType, 'extension:', ext);
      const fileUri = FileSystem.cacheDirectory + `flip_recording_${Date.now()}${ext}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('📖 Recording saved to:', fileUri);
      onRecordingComplete?.(fileUri);
    } catch (err) {
      console.error('📖 Error saving recording:', err);
      onRecordingComplete?.(null);
    }
  }, [onRecordingComplete, onRecordingProgress]);

  const webViewSource = useMemo(() => {
    if (flipHTML) {
      return { 
        html: flipHTML, 
        baseUrl: Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined 
      };
    }
    return { html: '<html><body></body></html>' };
  }, [flipHTML]);

  if (!initialFaces || initialFaces.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={styles.loadingText}>טוען דפים...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>שגיאה: {error}</Text>
      </View>
    );
  }

  if (isLoading || !htmlFilePath) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={styles.loadingText}>מכין דפים מתהפכים...</Text>
      </View>
    );
  }

  console.log('📖 FlipPagesWebView rendering, isFullscreen:', isFullscreen, 'htmlFilePath:', htmlFilePath ? 'exists' : 'null');
  
  return (
    <View style={[styles.container, isFullscreen && styles.fullscreen]}>
      <WebView
        key={webViewKeyRef.current}
        ref={webViewRef}
        source={webViewSource}
        style={styles.webView}
        originWhitelist={['*', 'file://*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        allowingReadAccessToURL={Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined}
        onMessage={handleMessage}
        onError={(e) => setError(e.nativeEvent.description)}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        useWebKit={true}
        mixedContentMode="always"
        cacheEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    height: SCREEN_HEIGHT * 0.65,
    width: SCREEN_WIDTH,
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1000,
  },
  webView: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#FF6B9D',
    fontSize: 16,
  },
});

export { FlipPagesWebView };
