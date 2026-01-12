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
      0%, 100% { 
        transform: translate3d(0, 0, 0);
      }
      25% { 
        transform: translate3d(8px, -12px, 15px);
      }
      50% { 
        transform: translate3d(-5px, -8px, -10px);
      }
      75% { 
        transform: translate3d(-10px, -15px, 8px);
      }
    }
    @keyframes spin {
      0% { 
        transform: rotateX(-15deg) rotateY(0deg) rotateZ(0deg);
      }
      25% { 
        transform: rotateX(-8deg) rotateY(90deg) rotateZ(3deg);
      }
      50% { 
        transform: rotateX(-20deg) rotateY(180deg) rotateZ(-2deg);
      }
      75% { 
        transform: rotateX(-5deg) rotateY(270deg) rotateZ(4deg);
      }
      100% { 
        transform: rotateX(-15deg) rotateY(360deg) rotateZ(0deg);
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
      animation: spin 12s infinite linear;
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
    
    function postMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
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
          videos.push({ element: video, faceId });
          
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
    
    let lastFrontFace = -1;
    
    function detectFrontFace() {
      const spinWrapper = document.getElementById('spin-wrapper');
      const style = window.getComputedStyle(spinWrapper);
      const matrix = style.transform;
      
      if (matrix === 'none') return 0;
      
      const values = matrix.match(/matrix3d\\((.+)\\)/);
      if (!values) return 0;
      
      const m = values[1].split(',').map(parseFloat);
      
      const faceNormals = [
        [0, 0, 1],
        [0, 0, -1],
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0]
      ];
      
      let bestFace = 0;
      let maxZ = -Infinity;
      
      for (let i = 0; i < 4; i++) {
        const [nx, ny, nz] = faceNormals[i];
        const tz = nx * m[2] + ny * m[6] + nz * m[10];
        if (tz > maxZ) {
          maxZ = tz;
          bestFace = i;
        }
      }
      
      return bestFace;
    }
    
    function updateAudioForFrontFace() {
      const frontFace = detectFrontFace();
      
      if (frontFace !== lastFrontFace) {
        lastFrontFace = frontFace;
        
        videos.forEach(v => {
          if (v.faceId === frontFace) {
            v.element.muted = false;
            v.element.volume = 1.0;
          } else {
            v.element.muted = true;
          }
        });
        
        postMessage('faceChange', { faceId: frontFace });
      }
    }
    
    setInterval(updateAudioForFrontFace, 200);
    
    function init() {
      faces.forEach((face, index) => {
        setFaceContent(index, face);
      });
      
      setTimeout(updateAudioForFrontFace, 500);
      
      postMessage('cubeReady', { faceCount: faces.filter(f => f.videoUrl).length });
    }
    
    window.updateFaces = function(newFaces) {
      newFaces.forEach((face, index) => {
        setFaceContent(index, face);
      });
    };
    
    window.pauseCube = function() {
      document.getElementById('spin-wrapper').style.animationPlayState = 'paused';
      document.querySelector('.float-wrapper').style.animationPlayState = 'paused';
    };
    
    window.resumeCube = function() {
      document.getElementById('spin-wrapper').style.animationPlayState = 'running';
      document.querySelector('.float-wrapper').style.animationPlayState = 'running';
    };
    
    window.setRotationSpeed = function(ms) {
      document.getElementById('spin-wrapper').style.animationDuration = ms + 'ms';
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
