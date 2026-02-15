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
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  onPlaybackStart,
  onPlaybackComplete,
  onReadyToPlay,
  isFullscreen = false,
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

  const flipHTML = useMemo(() => {
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
      background: #1a1a2e;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .scene {
      perspective: 1800px;
      perspective-origin: 50% 50%;
    }
    .book-wrapper {
      transform-style: preserve-3d;
      transform: rotateX(8deg) rotateY(-12deg);
      position: relative;
    }
    .book-container {
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      position: relative;
      transform-style: preserve-3d;
    }
    .book-spine {
      position: absolute;
      right: -15px;
      top: -4px;
      width: 16px;
      height: calc(100% + 8px);
      background: linear-gradient(90deg, #8B4513, #A0522D, #8B4513);
      transform: rotateY(90deg) translateZ(0px);
      transform-origin: left center;
      border-radius: 2px 0 0 2px;
      box-shadow: inset 0 0 8px rgba(0,0,0,0.4);
      z-index: 0;
    }
    .book-cover-back {
      position: absolute;
      width: calc(100% + 4px);
      height: calc(100% + 8px);
      top: -4px;
      right: -2px;
      background: linear-gradient(145deg, #6B3410, #4A2508);
      border-radius: 4px 10px 10px 4px;
      box-shadow: 4px 6px 20px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.2);
      z-index: -1;
      transform: translateZ(-16px);
    }
    .book-cover-front {
      position: absolute;
      width: calc(100% + 4px);
      height: calc(100% + 8px);
      top: -4px;
      right: -2px;
      background: linear-gradient(145deg, #8B4513, #6B3410);
      border-radius: 4px 10px 10px 4px;
      box-shadow: 2px 3px 12px rgba(0,0,0,0.4), inset 0 0 15px rgba(139,69,19,0.3);
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s;
    }
    .page-edges {
      position: absolute;
      right: -2px;
      top: 2px;
      width: 14px;
      height: calc(100% - 4px);
      background: repeating-linear-gradient(
        180deg,
        #f5f0e8 0px, #f5f0e8 1px,
        #e8e0d4 1px, #e8e0d4 2px
      );
      transform: rotateY(90deg) translateZ(-1px);
      transform-origin: left center;
      border-radius: 0 1px 1px 0;
      z-index: 0;
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
      box-shadow: -2px 0 8px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1);
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
    .page-shadow-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 3;
      opacity: 0;
      transition: opacity 0.6s;
      background: linear-gradient(to right, 
        rgba(0,0,0,0.3) 0%, 
        rgba(0,0,0,0.05) 15%, 
        transparent 50%
      );
      border-radius: 4px 8px 8px 4px;
    }
    .page.flipped .page-shadow-overlay {
      opacity: 0;
    }
    .book-shadow {
      position: absolute;
      bottom: -20px;
      right: 10%;
      width: 80%;
      height: 20px;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, transparent 70%);
      filter: blur(8px);
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
  
  <div class="scene">
    <div class="book-wrapper">
      <div class="book-container" id="book">
        <div class="book-cover-back"></div>
        <div class="book-spine"></div>
        <div class="page-edges"></div>
        <div class="page" id="page-3" style="z-index:10;">
          <div class="page-front" id="front-3"></div>
          <div class="page-back" id="back-3"></div>
          <div class="page-shadow-overlay"></div>
        </div>
        <div class="page" id="page-2" style="z-index:20;">
          <div class="page-front" id="front-2"></div>
          <div class="page-back" id="back-2"></div>
          <div class="page-shadow-overlay"></div>
        </div>
        <div class="page" id="page-1" style="z-index:30;">
          <div class="page-front" id="front-1"></div>
          <div class="page-back" id="back-1"></div>
          <div class="page-shadow-overlay"></div>
        </div>
        <div class="page" id="page-0" style="z-index:40;">
          <div class="page-front" id="front-0"></div>
          <div class="page-back" id="back-0"></div>
          <div class="page-shadow-overlay"></div>
        </div>
        <div class="book-cover-front" id="book-cover-front"></div>
      </div>
      <div class="book-shadow"></div>
    </div>
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
      
      currentIndex = 0;
      isPlaying = true;
      resetAllPages();
      
      postMessage('animationStarted', { videoCount: fullVideoQueue.length });
      playCurrentVideo();
    }
    
    function handleReplayClick() {
      hideReplayButton();
      currentIndex = 0;
      isPlaying = true;
      resetAllPages();
      
      for (let i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        const video = pageVideos[i];
        if (video && fullVideoQueue[i]) {
          video.muted = true;
          video.currentTime = 0;
          video.src = fullVideoQueue[i].videoUrl;
          video.load();
        }
      }
      
      setTimeout(() => {
        postMessage('replayStarted', { videoCount: fullVideoQueue.length });
        playCurrentVideo();
      }, 500);
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
  }, [initialFaces]);

  useEffect(() => {
    if (!flipHTML) return;
    
    const saveHTMLToFile = async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(FLIP_HTML_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(FLIP_HTML_DIR, { intermediates: true });
        }
        
        const filePath = FLIP_HTML_DIR + 'flip_' + Date.now() + '.html';
        await FileSystem.writeAsStringAsync(filePath, flipHTML, { encoding: FileSystem.EncodingType.UTF8 });
        
        console.log('📖 Flip pages HTML saved to:', filePath);
        setHtmlFilePath(filePath);
        setIsLoading(false);
      } catch (err) {
        console.error('❌ Failed to save flip HTML:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    saveHTMLToFile();
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
        source={{ uri: htmlFilePath }}
        style={styles.webView}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
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
