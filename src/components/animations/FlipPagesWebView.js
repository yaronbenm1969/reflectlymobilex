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
      setInitialFaces(faces);
    }
  }, [faces]);

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
    .book-container {
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      position: relative;
      perspective: 1500px;
    }
    .page {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition: transform 1.2s ease-in-out;
      border-radius: 8px;
      overflow: hidden;
    }
    .page-front, .page-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 8px;
      overflow: hidden;
      background: linear-gradient(145deg, #2a2a4a, #1a1a2e);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .page-front {
      z-index: 2;
    }
    .page-back {
      transform: rotateY(180deg);
    }
    .page video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .page.flipped {
      transform: rotateY(-180deg);
    }
    .page-shadow {
      position: absolute;
      top: 0;
      right: 0;
      width: 50px;
      height: 100%;
      background: linear-gradient(to left, rgba(0,0,0,0.3), transparent);
      pointer-events: none;
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
    <div class="page" id="page-0">
      <div class="page-front" id="front-0"></div>
      <div class="page-back" id="back-0"></div>
      <div class="page-shadow"></div>
    </div>
    <div class="page" id="page-1">
      <div class="page-front" id="front-1"></div>
      <div class="page-back" id="back-1"></div>
      <div class="page-shadow"></div>
    </div>
    <div class="page" id="page-2">
      <div class="page-front" id="front-2"></div>
      <div class="page-back" id="back-2"></div>
      <div class="page-shadow"></div>
    </div>
    <div class="page" id="page-3">
      <div class="page-front" id="front-3"></div>
      <div class="page-back" id="back-3"></div>
      <div class="page-shadow"></div>
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
        console.log('📖 Flipped page ' + pageIndex);
      }
    }
    
    function resetAllPages() {
      for (let i = 0; i < 4; i++) {
        const page = document.getElementById('page-' + i);
        if (page) page.classList.remove('flipped');
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
      
      const video = pageVideos[currentIndex % 4];
      if (!video) {
        advanceToNext();
        return;
      }
      
      const playingIndex = currentIndex;
      
      video.onended = function() {
        console.log('🎬 Video ended: ' + playingIndex);
        flipPage(playingIndex % 4);
        setTimeout(() => advanceToNext(), 600);
      };
      
      video.currentTime = 0;
      video.play().then(() => {
        console.log('▶️ Playing video ' + currentIndex);
        postMessage('videoStart', { pageIndex: currentIndex });
      }).catch(e => {
        console.log('❌ Play failed: ' + e.message);
        setTimeout(() => advanceToNext(), 500);
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
      
      Object.values(pageVideos).forEach(v => {
        if (v) v.currentTime = 0;
      });
      
      for (let i = 0; i < Math.min(4, fullVideoQueue.length); i++) {
        const video = pageVideos[i];
        if (video && fullVideoQueue[i]) {
          video.src = fullVideoQueue[i].videoUrl;
          video.load();
        }
      }
      
      setTimeout(() => {
        postMessage('replayStarted', { videoCount: fullVideoQueue.length });
        playCurrentVideo();
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
