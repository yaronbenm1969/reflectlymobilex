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
  isFullscreen = false,
  triggerAutoPlay = false,
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
    }
    .page {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      transition: transform 1.2s cubic-bezier(0.645, 0.045, 0.355, 1.000);
      border-radius: 4px 8px 8px 4px;
      overflow: hidden;
    }
    .page-front, .page-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 4px 8px 8px 4px;
      overflow: hidden;
      background: linear-gradient(145deg, #f5f0e8, #ebe4d8);
    }
    .page-front {
      z-index: 2;
      box-shadow: -3px 0 10px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15);
    }
    .page-back {
      transform: rotateY(-180deg);
      background: linear-gradient(145deg, #ebe4d8, #ddd6c8);
    }
    .page video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px 8px 8px 4px;
    }
    .page.flipped {
      transform: rotateY(180deg);
    }
    .book-cover {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: right center;
      transform-style: preserve-3d;
      transition: transform 1.8s cubic-bezier(0.645, 0.045, 0.355, 1.000);
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
      background: linear-gradient(145deg, #f5f0e8, #ebe4d8);
    }
    .book-cover.opened {
      transform: rotateY(180deg);
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
    let fullVideoQueue = faces.filter(f => f && f.videoUrl);
    let currentIndex = 0;
    let isPlaying = false;
    let isReady = false;
    let hasUserStarted = false;
    const pageVideos = {};
    
    console.log('📖 Flip Pages init: ' + fullVideoQueue.length + ' videos');
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function initPageVideos() {
      for (let i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        const frontEl = document.getElementById('front-' + i);
        if (frontEl && !pageVideos[i]) {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.preload = 'auto';
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          video.src = fullVideoQueue[i].videoUrl;
          frontEl.appendChild(video);
          pageVideos[i] = video;
          console.log('📄 Created video on page ' + i);
        }
      }
    }
    
    function flipPage(pageIndex) {
      const page = document.getElementById('page-' + pageIndex);
      if (page) {
        page.classList.add('flipped');
        page.style.zIndex = 1;
        console.log('📖 Flipped page ' + pageIndex);
      }
    }
    
    function resetAllPages() {
      for (let i = 0; i < 4; i++) {
        const page = document.getElementById('page-' + i);
        if (page) {
          page.classList.remove('flipped');
          page.style.zIndex = (4 - i) * 10;
        }
      }
    }
    
    window.addVideosToQueue = function(newVideos) {
      newVideos.forEach(function(v) {
        fullVideoQueue.push(v);
      });
      console.log('📖 Queue updated: now ' + fullVideoQueue.length + ' videos');
    };
    
    function preloadNextVideo() {
      const nextIdx = currentIndex + 1;
      if (nextIdx >= fullVideoQueue.length) return;
      
      const nextSlot = nextIdx % 4;
      const nextVideo = pageVideos[nextSlot];
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
      
      const pageSlot = currentIndex % 4;
      const video = pageVideos[pageSlot];
      if (!video) {
        advanceToNext();
        return;
      }
      
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
          console.log('⚡ Early flip at ' + remaining.toFixed(1) + 's remaining (video keeps playing)');
          flipPage(playingIndex % 4);
        }
      };
      
      video.onended = function() {
        video.ontimeupdate = null;
        if (!earlyFlipDone) {
          flipPage(playingIndex % 4);
        }
        console.log('🎬 Video ended naturally: ' + playingIndex);
        setTimeout(() => {
          if (currentIndex === playingIndex) advanceToNext();
        }, earlyFlipDone ? 100 : 600);
      };
      
      video.play().then(() => {
        console.log('▶️ Playing video ' + currentIndex + ' (unmuted)');
        postMessage('videoStart', { pageIndex: currentIndex });
        preloadNextVideo();
      }).catch(e => {
        console.log('❌ Play failed unmuted, trying muted: ' + e.message);
        video.muted = true;
        video.play().then(() => {
          postMessage('videoStart', { pageIndex: currentIndex });
          preloadNextVideo();
        }).catch(e2 => {
          console.log('❌ Play failed completely: ' + e2.message);
          setTimeout(() => advanceToNext(), 500);
        });
      });
    }
    
    function advanceToNext() {
      currentIndex++;
      if (currentIndex >= fullVideoQueue.length) {
        console.log('🏁 All videos complete!');
        postMessage('allVideosComplete', { playedCount: fullVideoQueue.length });
        isPlaying = false;
        showReplayButton();
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
      
      const cover = document.getElementById('book-cover');
      if (cover) {
        cover.classList.add('opened');
        setTimeout(() => {
          cover.style.display = 'none';
          currentIndex = 0;
          isPlaying = true;
          resetAllPages();
          postMessage('animationStarted', { videoCount: fullVideoQueue.length });
          playCurrentVideo();
        }, 1900);
      } else {
        currentIndex = 0;
        isPlaying = true;
        resetAllPages();
        postMessage('animationStarted', { videoCount: fullVideoQueue.length });
        playCurrentVideo();
      }
    }
    
    function handleReplayClick() {
      hideReplayButton();
      hasUserStarted = false;
      
      for (let i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        const video = pageVideos[i];
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
      
      const cover = document.getElementById('book-cover');
      if (cover) {
        cover.style.display = '';
        cover.classList.remove('opened');
      }
      
      setTimeout(() => {
        showPlayButton();
      }, 300);
    }
    
    function init() {
      initPageVideos();
      
      const preloadPromises = Object.values(pageVideos).map(video => {
        return new Promise(resolve => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.oncanplay = () => resolve();
            setTimeout(resolve, 5000);
          }
        });
      });
      
      Promise.all(preloadPromises).then(() => {
        console.log('✅ All videos preloaded');
        isReady = true;
        postMessage('cubeReady', { faceCount: fullVideoQueue.length });
        showPlayButton();
      });
    }
    
    init();
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

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📖 FlipPages message:', data.type);
      
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
      }
    } catch (e) {
      console.error('📖 Message parse error:', e);
    }
  }, [onReadyToPlay, onPlaybackStart, onVideoStart, onPlaybackComplete]);

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
