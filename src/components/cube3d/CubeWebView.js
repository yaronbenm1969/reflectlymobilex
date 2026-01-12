import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

const CubeWebView = ({
  faces = [],
  autoRotate = true,
  rotationSpeed = 15000,
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  currentPlayingFaceIndex = -1,
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
    .cube-container { 
      width: ${CUBE_SIZE}px; 
      height: ${CUBE_SIZE}px; 
      perspective: 1200px;
    }
    .cube {
      width: 100%; 
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      animation: rotateCube ${rotationSpeed}ms infinite linear;
      animation-play-state: ${autoRotate ? 'running' : 'paused'};
    }
    .cube.paused { animation-play-state: paused; }
    .cube-face {
      position: absolute;
      width: ${CUBE_SIZE}px; 
      height: ${CUBE_SIZE}px;
      border: 4px solid rgba(255,255,255,0.6);
      border-radius: 20px;
      overflow: hidden;
      background: linear-gradient(145deg, rgba(255,107,157,0.95), rgba(192,111,187,0.95));
      backface-visibility: hidden;
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
    @keyframes rotateCube {
      0%   { transform: rotateX(-12deg) rotateY(0deg); }
      100% { transform: rotateX(-12deg) rotateY(360deg); }
    }
  </style>
</head>
<body>
  <div class="cube-container">
    <div class="cube" id="cube">
      <div class="cube-face front" id="face-0"></div>
      <div class="cube-face back" id="face-1"></div>
      <div class="cube-face right" id="face-2"></div>
      <div class="cube-face left" id="face-3"></div>
      <div class="cube-face top" id="face-4"></div>
      <div class="cube-face bottom" id="face-5"></div>
    </div>
  </div>
  <script>
    const faces = ${facesJSON};
    let currentFace = 0;
    let videos = [];
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }
    
    function setFaceContent(faceId, face) {
      const el = document.getElementById('face-' + faceId);
      if (!el) return;
      
      if (face.thumbnailUrl || face.videoUrl) {
        let html = '';
        
        if (face.thumbnailUrl) {
          html += '<img src="' + face.thumbnailUrl + '" alt="Thumbnail" />';
        }
        
        if (face.videoUrl) {
          html += '<video src="' + face.videoUrl + '" muted loop playsinline preload="auto" style="' + (face.thumbnailUrl ? 'opacity:0' : '') + '"></video>';
        }
        
        html += '<div class="player-badge">' + (face.playerName || 'סרטון') + '</div>';
        el.innerHTML = html;
        
        const video = el.querySelector('video');
        if (video) {
          videos.push({ element: video, faceId });
          video.addEventListener('loadeddata', () => {
            postMessage('videoLoaded', { faceId });
          });
          video.addEventListener('play', () => {
            video.style.opacity = '1';
            postMessage('videoStart', { faceId });
          });
          video.addEventListener('ended', () => {
            postMessage('videoEnd', { faceId });
          });
          video.play().catch(() => {});
        }
      } else {
        el.innerHTML = '<div class="placeholder"><span class="icon">🎬</span><span class="label">סרטון ' + (faceId + 1) + '</span></div>';
      }
    }
    
    function detectCurrentFace() {
      const cube = document.getElementById('cube');
      const style = window.getComputedStyle(cube);
      const transform = style.transform;
      
      postMessage('cubeReady', {});
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
      document.getElementById('cube').classList.add('paused');
    };
    
    window.resumeCube = function() {
      document.getElementById('cube').classList.remove('paused');
    };
    
    window.setRotationSpeed = function(ms) {
      document.getElementById('cube').style.animationDuration = ms + 'ms';
    };
    
    init();
  </script>
</body>
</html>
    `;
  }, [faces, autoRotate, rotationSpeed]);

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

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: cubeHTML }}
        style={styles.webView}
        onMessage={onMessage}
        onError={(e) => setError(e.nativeEvent.description)}
        onLoad={() => setIsLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
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
