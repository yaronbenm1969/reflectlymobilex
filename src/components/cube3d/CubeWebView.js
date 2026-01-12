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
      background: transparent;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .scene {
      width: ${CUBE_SIZE}px; 
      height: ${CUBE_SIZE}px; 
      perspective: 800px;
      perspective-origin: 50% 50%;
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
      animation: float 8s infinite ease-in-out;
    }
    .spin-wrapper {
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      animation: spin 20s infinite linear;
    }
  </style>
</head>
<body>
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
    let currentFace = 0;
    let videos = [];
    let videoDurations = [];
    let animationStarted = false;
    let animationId = null;
    
    const faceRotations = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 180, z: 0 },
      { x: 0, y: -90, z: 0 },
      { x: 0, y: 90, z: 0 },
      { x: -90, y: 0, z: 0 },
      { x: 90, y: 0, z: 0 }
    ];
    
    const TRANSITION_DURATION = 1.2;
    const DEFAULT_HOLD_DURATION = 5;
    
    let rotationSchedule = [];
    let totalCycleDuration = 0;
    let cycleStartTime = 0;
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function buildRotationSchedule() {
      rotationSchedule = [];
      let time = 0;
      
      const faceOrder = [0, 2, 1, 3, 4, 5];
      
      for (let i = 0; i < faceOrder.length; i++) {
        const faceIdx = faceOrder[i];
        const holdDuration = videoDurations[faceIdx] || DEFAULT_HOLD_DURATION;
        const nextFaceIdx = faceOrder[(i + 1) % faceOrder.length];
        
        rotationSchedule.push({
          type: 'hold',
          faceIndex: faceIdx,
          startTime: time,
          duration: holdDuration,
          rotation: faceRotations[faceIdx]
        });
        time += holdDuration;
        
        rotationSchedule.push({
          type: 'transition',
          fromFace: faceIdx,
          toFace: nextFaceIdx,
          startTime: time,
          duration: TRANSITION_DURATION,
          fromRotation: faceRotations[faceIdx],
          toRotation: faceRotations[nextFaceIdx]
        });
        time += TRANSITION_DURATION;
      }
      
      totalCycleDuration = time;
      console.log('Rotation schedule built: ' + totalCycleDuration + 's cycle with ' + faceOrder.length + ' faces');
      postMessage('scheduleBuilt', { cycleDuration: totalCycleDuration, faceCount: faceOrder.length });
    }
    
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    
    function shortestAngleDiff(from, to) {
      let diff = ((to - from + 180) % 360) - 180;
      return diff < -180 ? diff + 360 : diff;
    }
    
    function lerpAngle(from, to, t) {
      return from + shortestAngleDiff(from, to) * t;
    }
    
    function getFloatOffset(time) {
      const floatSpeed = 0.15;
      const floatAmplitude = { x: 20, y: 25, z: 40 };
      
      return {
        x: Math.sin(time * floatSpeed * 1.3) * floatAmplitude.x + 
           Math.sin(time * floatSpeed * 0.7) * floatAmplitude.x * 0.5,
        y: Math.sin(time * floatSpeed * 1.1 + 1) * floatAmplitude.y + 
           Math.cos(time * floatSpeed * 0.5) * floatAmplitude.y * 0.3,
        z: Math.sin(time * floatSpeed * 0.9 + 2) * floatAmplitude.z +
           Math.cos(time * floatSpeed * 0.4) * floatAmplitude.z * 0.4
      };
    }
    
    function getWobble(time) {
      const wobbleSpeed = 0.8;
      const wobbleAmplitude = { x: 8, y: 5, z: 6 };
      
      return {
        x: Math.sin(time * wobbleSpeed * 2.1) * wobbleAmplitude.x,
        y: Math.sin(time * wobbleSpeed * 1.7 + 0.5) * wobbleAmplitude.y,
        z: Math.sin(time * wobbleSpeed * 1.3 + 1) * wobbleAmplitude.z
      };
    }
    
    let lastFrontFace = -1;
    
    function animate(timestamp) {
      if (!cycleStartTime) cycleStartTime = timestamp;
      
      const elapsed = (timestamp - cycleStartTime) / 1000;
      const cycleTime = elapsed % totalCycleDuration;
      const globalTime = elapsed;
      
      let currentRotation = { x: 0, y: 0, z: 0 };
      let activeFace = 0;
      
      for (const segment of rotationSchedule) {
        const segmentEnd = segment.startTime + segment.duration;
        
        if (cycleTime >= segment.startTime && cycleTime < segmentEnd) {
          const segmentProgress = (cycleTime - segment.startTime) / segment.duration;
          
          if (segment.type === 'hold') {
            activeFace = segment.faceIndex;
            currentRotation = { ...segment.rotation };
          } else {
            const easedProgress = easeInOutCubic(segmentProgress);
            currentRotation = {
              x: lerpAngle(segment.fromRotation.x, segment.toRotation.x, easedProgress),
              y: lerpAngle(segment.fromRotation.y, segment.toRotation.y, easedProgress),
              z: lerpAngle(segment.fromRotation.z, segment.toRotation.z, easedProgress)
            };
            activeFace = segmentProgress < 0.5 ? segment.fromFace : segment.toFace;
          }
          break;
        }
      }
      
      const wobble = getWobble(globalTime);
      const floatOffset = getFloatOffset(globalTime);
      
      const finalRotation = {
        x: currentRotation.x + wobble.x,
        y: currentRotation.y + wobble.y,
        z: currentRotation.z + wobble.z
      };
      
      const spinWrapper = document.getElementById('spin-wrapper');
      const floatWrapper = document.querySelector('.float-wrapper');
      
      if (spinWrapper) {
        spinWrapper.style.transform = 
          'rotateX(' + finalRotation.x + 'deg) ' +
          'rotateY(' + finalRotation.y + 'deg) ' +
          'rotateZ(' + finalRotation.z + 'deg)';
      }
      
      if (floatWrapper) {
        floatWrapper.style.transform = 
          'translate3d(' + floatOffset.x + 'px, ' + floatOffset.y + 'px, ' + floatOffset.z + 'px)';
      }
      
      if (activeFace !== lastFrontFace) {
        lastFrontFace = activeFace;
        updateAudioForFace(activeFace);
        postMessage('faceChanged', { faceIndex: activeFace });
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
      
      buildRotationSchedule();
      animationStarted = true;
      cycleStartTime = 0;
      animationId = requestAnimationFrame(animate);
      console.log('Animation started with video-synced rotation');
    }
    
    function tryStartAnimation() {
      const validDurations = videoDurations.filter(d => d > 0);
      if (validDurations.length >= Math.min(faces.length, 4)) {
        startAnimation();
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
          html += '<video muted loop playsinline preload="auto" style="opacity:0"></video>';
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
            tryPlay();
          });
          
          video.addEventListener('canplay', () => {
            tryPlay();
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
            postMessage('videoEnd', { faceId });
          });
          
          video.src = face.videoUrl;
          video.load();
        }
      } else {
        el.innerHTML = '<div class="placeholder"><span class="icon">🎬</span><span class="label">סרטון ' + (faceId + 1) + '</span></div>';
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
          onFaceChange?.(data.faceId);
          break;
        case 'videoStart':
          onVideoStart?.(data.faceId);
          break;
        case 'videoEnd':
          onVideoEnd?.(data.faceId);
          break;
      }
    } catch (e) {
      console.warn('WebView message parse error:', e);
    }
  }, [onFaceChange, onVideoStart, onVideoEnd]);

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
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={styles.webView}
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
  webView: {
    width: CUBE_SIZE + 40,
    height: CUBE_SIZE + 40,
    backgroundColor: 'transparent',
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
