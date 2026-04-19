import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH  = Math.min(SCREEN_WIDTH * 0.72, 300);
const PANEL_HEIGHT = PANEL_WIDTH * 1.35;

const CAROUSEL_HTML_DIR = FileSystem.cacheDirectory + 'carousel_v1/';

const CarouselWebView = ({
  faces = [],
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
  backgroundUrl = null,
  backgroundMediaType = 'video',
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlFilePath, setHtmlFilePath] = useState(null);
  const [initialFaces, setInitialFaces] = useState(null);
  const hasInitializedRef = useRef(false);
  const webViewKeyRef = useRef(Date.now());
  const injectedThumbsRef = useRef({});
  const lastVideoUrlsRef = useRef('');

  // Wait until first batch of videos is ready before mounting WebView
  useEffect(() => {
    if (hasInitializedRef.current) return;
    const minRequired = Math.min(4, faces.length);
    const readyCount = faces.slice(0, minRequired).filter(f => f?.videoUrl).length;
    if (minRequired > 0 && readyCount >= minRequired) {
      hasInitializedRef.current = true;
      setInitialFaces([...faces]);
    }
  }, [faces]);

  // Inject thumbnails as they become available
  useEffect(() => {
    if (!webViewRef.current || !hasInitializedRef.current) return;
    faces.forEach((face, index) => {
      if (face?.thumbnailUrl && injectedThumbsRef.current[index] !== face.thumbnailUrl) {
        injectedThumbsRef.current[index] = face.thumbnailUrl;
        webViewRef.current.injectJavaScript(
          `if(window.setPanelThumbnail)window.setPanelThumbnail(${index},${JSON.stringify(face.thumbnailUrl)});true;`
        );
      }
    });
  }, [faces]);

  // Push new video URLs without reloading WebView
  useEffect(() => {
    if (!webViewRef.current || !hasInitializedRef.current) return;
    const urlSignature = faces.filter(f => f?.videoUrl).map(f => f.videoUrl).join('|');
    if (!urlSignature || lastVideoUrlsRef.current === urlSignature) return;
    lastVideoUrlsRef.current = urlSignature;
    const facesData = faces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
      thumbnailUrl: face?.thumbnailUrl || null,
    }));
    webViewRef.current.injectJavaScript(
      `window.updatePanels && window.updatePanels(${JSON.stringify(facesData)}); true;`
    );
  }, [faces]);

  // Trigger autoplay
  useEffect(() => {
    if (!triggerAutoPlay || !webViewRef.current || !hasInitializedRef.current) return;
    webViewRef.current.injectJavaScript(`window.startPlayback && window.startPlayback(); true;`);
  }, [triggerAutoPlay]);

  // Background HTML
  const safeBgUrl = (backgroundUrl || '').replace(/'/g, '');
  const bgHtml = safeBgUrl
    ? (backgroundMediaType === 'image'
        ? `<img id="custom-bg" src="${safeBgUrl}" style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;" />`
        : `<video id="custom-bg" src="${safeBgUrl}" autoplay loop muted playsinline style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;"></video>`)
    : '';

  // Generate HTML
  const carouselHTML = useMemo(() => {
    if (!initialFaces || initialFaces.length === 0) return null;

    const N = Math.min(initialFaces.length, 8); // max 8 panels in circle
    const ANGLE_STEP = 360 / N;
    // radius so panels don't overlap: panel_width / (2 * tan(π/N))
    const RADIUS = Math.round((PANEL_WIDTH / 2) / Math.tan(Math.PI / N));

    const facesJSON = JSON.stringify(initialFaces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
      thumbnailUrl: face?.thumbnailUrl || null,
    })));

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #0a0a1a;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  /* Stars background */
  .stars {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 0;
  }
  .star {
    position: absolute;
    background: white;
    border-radius: 50%;
    animation: twinkle 3s infinite alternate;
  }

  @keyframes twinkle {
    0%   { opacity: 0.2; }
    100% { opacity: 1; }
  }

  /* Scene */
  .scene {
    position: relative;
    width: ${PANEL_WIDTH}px;
    height: ${PANEL_HEIGHT}px;
    perspective: 1200px;
    perspective-origin: 50% 50%;
    z-index: 1;
  }

  .carousel-track {
    width: 100%;
    height: 100%;
    position: absolute;
    transform-style: preserve-3d;
    /* No CSS transition — rotation driven by rAF in sync with video */
  }

  .panel {
    position: absolute;
    width: ${PANEL_WIDTH}px;
    height: ${PANEL_HEIGHT}px;
    border-radius: 18px;
    overflow: hidden;
    border: 3px solid rgba(255,255,255,0.25);
    background: #111;
    box-shadow: 0 0 40px rgba(0,0,0,0.6), 0 0 15px rgba(100,120,255,0.15);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .panel img.panel-thumb {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 0;
  }

  .panel video {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 1;
    background: #000;
  }

  .panel .label {
    position: absolute;
    bottom: 0;
    left: 0; right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
    color: white;
    font-size: 14px;
    font-weight: 600;
    padding: 20px 12px 10px;
    text-align: center;
    z-index: 2;
    direction: rtl;
    font-family: -apple-system, sans-serif;
  }

  /* Play button */
  #play-btn {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.15);
    border: 2px solid rgba(255,255,255,0.6);
    border-radius: 50px;
    color: white;
    font-size: 16px;
    font-weight: 700;
    padding: 14px 36px;
    cursor: pointer;
    z-index: 10;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    letter-spacing: 1px;
  }

  #play-btn:active { opacity: 0.7; }
</style>
</head>
<body>

${bgHtml || '<div class="stars" id="stars"></div>'}

<div class="scene">
  <div class="carousel-track" id="track"></div>
</div>

<button id="play-btn" onclick="startPlayback()">▶ הפעל</button>

<script>
  // ─── CONFIG ───────────────────────────────────────────
  const N           = ${N};
  const ANGLE_STEP  = ${ANGLE_STEP};
  const RADIUS      = ${RADIUS};
  const MAX_VIDEO_DURATION = 45; // seconds

  // ─── STATE ────────────────────────────────────────────
  let fullVideoQueue  = ${facesJSON};
  let panelElements   = {};   // index -> { el, video }
  let currentIndex    = 0;
  let isPlaying       = false;
  let videoTimeoutId  = null;

  // ─── ROTATION SYNC (video-time-driven, like cube) ─────
  const HALF_STEP     = ${ANGLE_STEP} / 2; // half panel step for enter/exit
  let currentAngleY   = 0;       // live carousel Y angle
  let rotFromY        = 0;       // angle at video start
  let rotToY          = 0;       // angle at video end
  let activeVideo     = null;    // video element driving rotation
  let animFrameId     = null;    // rAF handle
  let animStartTime   = 0;       // timestamp when loop started (for float)

  // ─── STARS ────────────────────────────────────────────
  (function createStars() {
    var container = document.getElementById('stars');
    if (!container) return; // custom background replaces stars
    for (var i = 0; i < 80; i++) {
      var s = document.createElement('div');
      s.className = 'star';
      var size = Math.random() * 2.5 + 0.5;
      s.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'top:' + Math.random() * 100 + '%',
        'left:' + Math.random() * 100 + '%',
        'animation-delay:' + (Math.random() * 3) + 's',
        'animation-duration:' + (2 + Math.random() * 3) + 's'
      ].join(';');
      container.appendChild(s);
    }
  })();

  // ─── BUILD PANELS ─────────────────────────────────────
  function buildPanels() {
    var track = document.getElementById('track');
    track.innerHTML = '';
    panelElements = {};

    for (var i = 0; i < N; i++) {
      var angle = ANGLE_STEP * i;
      var face  = fullVideoQueue[i] || {};

      var panel = document.createElement('div');
      panel.className = 'panel';
      panel.id = 'panel-' + i;
      panel.style.transform = 'rotateY(' + angle + 'deg) translateZ(' + RADIUS + 'px)';

      // Thumbnail
      if (face.thumbnailUrl) {
        var thumb = document.createElement('img');
        thumb.className = 'panel-thumb';
        thumb.src = face.thumbnailUrl;
        panel.appendChild(thumb);
      }

      // Video
      var video = document.createElement('video');
      video.muted  = true;
      video.preload = 'auto';
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.opacity = '0';
      video.style.cssText += 'width:100%;height:100%;object-fit:cover;opacity:0;';
      panel.appendChild(video);

      // Label
      if (face.playerName) {
        var lbl = document.createElement('div');
        lbl.className = 'label';
        lbl.textContent = face.playerName;
        panel.appendChild(lbl);
      }

      track.appendChild(panel);
      panelElements[i] = { el: panel, video: video };

      if (face.videoUrl) {
        loadVideo(i, face.videoUrl);
      }
    }
  }

  // ─── LOAD VIDEO ───────────────────────────────────────
  function loadVideo(panelIdx, url) {
    var entry = panelElements[panelIdx];
    if (!entry) return;
    var video = entry.video;
    if (video._loadedUrl === url) return;
    video._loadedUrl = url;
    video.src = url;
    video.load();
    video.style.opacity = '0';
    video.oncanplay = function() {
      video.oncanplay = null;
      video.style.opacity = '1';
    };
  }

  // ─── ANIMATION LOOP (rAF, video-time-driven) ──────────
  function animLoop(timestamp) {
    if (!isPlaying) return;
    if (!animStartTime) animStartTime = timestamp;
    var elapsed = (timestamp - animStartTime) / 1000;

    // Float: gentle up-down bob
    var floatY = Math.sin(elapsed * 0.6) * 8;

    // Rotation: interpolate based on video progress
    if (activeVideo) {
      var dur  = activeVideo.duration;
      var cur  = activeVideo.currentTime;
      if (dur && isFinite(dur) && dur > 0) {
        var t    = Math.min(cur / dur, 1);
        // Ease in-out quad
        var ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        currentAngleY = rotFromY + (rotToY - rotFromY) * ease;
      }
    }

    var track = document.getElementById('track');
    if (track) {
      track.style.transform =
        'translateY(' + floatY + 'px) rotateY(' + currentAngleY + 'deg)';
    }

    animFrameId = requestAnimationFrame(animLoop);
  }

  function startAnimLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animStartTime = 0;
    animFrameId = requestAnimationFrame(animLoop);
  }

  function stopAnimLoop() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    activeVideo = null;
  }

  function setupRotationSync(video, idx) {
    // Enter from +HALF_STEP, sweep through center, exit at -HALF_STEP (like cube)
    rotFromY    = -(ANGLE_STEP * idx) + HALF_STEP;
    rotToY      = -(ANGLE_STEP * idx) - HALF_STEP;
    currentAngleY = rotFromY;
    activeVideo = video;
  }

  // ─── ROTATE TO PANEL (instant snap, used before anim takes over) ──
  function rotateTo(idx) {
    currentAngleY = -(ANGLE_STEP * idx);
    var track = document.getElementById('track');
    if (track) track.style.transform = 'rotateY(' + currentAngleY + 'deg)';
    postMessage('faceChange', { faceIndex: idx });
  }

  // ─── PLAY PANEL ───────────────────────────────────────
  function playPanel(idx) {
    if (idx >= fullVideoQueue.length) {
      postMessage('playbackComplete', {});
      return;
    }

    currentIndex = idx;
    rotateTo(idx);

    var entry = panelElements[idx % N];
    if (!entry) { advanceToNext(); return; }

    var video = entry.video;
    var data  = fullVideoQueue[idx];

    // Pause all other panels
    for (var k in panelElements) {
      if (parseInt(k) !== (idx % N)) {
        panelElements[k].video.pause();
        panelElements[k].video.muted = true;
      }
    }

    // Ensure correct video is loaded
    if (data && data.videoUrl && video._loadedUrl !== data.videoUrl) {
      loadVideo(idx % N, data.videoUrl);
    }

    video.muted  = false;
    video.volume = 1;

    function doPlay() {
      video.currentTime = 0;
      video.play().then(function() {
        postMessage('videoStart', { faceId: idx % N, queueIndex: idx });

        // Start rotation sync with video time
        setupRotationSync(video, idx);

        var dur = video.duration;
        var timeout = (dur && isFinite(dur) && dur > 0)
          ? (dur + 2) * 1000
          : MAX_VIDEO_DURATION * 1000;

        videoTimeoutId = setTimeout(function() {
          advanceToNext();
        }, timeout);

        // Preload next
        preloadNext(idx);

      }).catch(function(e) {
        console.log('Play failed: ' + e);
        advanceToNext();
      });
    }

    video.onended = function() {
      if (videoTimeoutId) clearTimeout(videoTimeoutId);
      videoTimeoutId = null;
      advanceToNext();
    };

    if (video.readyState >= 2) {
      doPlay();
    } else {
      var timeout = setTimeout(function() {
        doPlay();
      }, 3000);
      video.oncanplay = function() {
        video.oncanplay = null;
        video.style.opacity = '1';
        clearTimeout(timeout);
        doPlay();
      };
    }
  }

  // ─── PRELOAD NEXT ─────────────────────────────────────
  function preloadNext(fromIdx) {
    for (var ahead = 1; ahead <= 2; ahead++) {
      var nextIdx  = fromIdx + ahead;
      if (nextIdx >= fullVideoQueue.length) break;
      var panelIdx = nextIdx % N;
      var data     = fullVideoQueue[nextIdx];
      if (data && data.videoUrl) {
        loadVideo(panelIdx, data.videoUrl);
      }
    }
  }

  // ─── ADVANCE ──────────────────────────────────────────
  function advanceToNext() {
    if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
    postMessage('videoEnd', { faceId: currentIndex % N });
    var next = currentIndex + 1;
    if (next >= fullVideoQueue.length) {
      stopAnimLoop();
      postMessage('playbackComplete', {});
      document.getElementById('play-btn').style.display = 'block';
      isPlaying = false;
      return;
    }
    playPanel(next);
  }

  // ─── PUBLIC API ───────────────────────────────────────
  window.startPlayback = function() {
    if (isPlaying) return;
    isPlaying = true;
    document.getElementById('play-btn').style.display = 'none';
    var bgVid = document.getElementById('custom-bg');
    if (bgVid && bgVid.tagName === 'VIDEO') bgVid.play();
    postMessage('playbackStart', {});
    startAnimLoop();
    playPanel(0);
  };

  window.updatePanels = function(facesData) {
    facesData.forEach(function(face) {
      if (face.videoUrl) {
        var entry = panelElements[face.index % N];
        if (entry && entry.video._loadedUrl !== face.videoUrl) {
          loadVideo(face.index % N, face.videoUrl);
        }
        // Extend queue
        if (!fullVideoQueue[face.index] || !fullVideoQueue[face.index].videoUrl) {
          fullVideoQueue[face.index] = face;
        }
      }
    });
  };

  window.setPanelThumbnail = function(queueIdx, dataUri) {
    var panelIdx = queueIdx % N;
    var entry = panelElements[panelIdx];
    if (!entry) return;
    var existing = entry.el.querySelector('img.panel-thumb');
    if (existing) {
      existing.src = dataUri;
    } else {
      var img = document.createElement('img');
      img.className = 'panel-thumb';
      img.src = dataUri;
      entry.el.insertBefore(img, entry.el.firstChild);
    }
    console.log('🖼️ Thumbnail set on panel ' + panelIdx);
  };

  // ─── MESSAGES ─────────────────────────────────────────
  function postMessage(type, data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data)));
    }
  }

  // ─── INIT ─────────────────────────────────────────────
  buildPanels();
  postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
</script>
</body>
</html>`;
  }, [initialFaces, backgroundUrl, backgroundMediaType]);

  // Mark ready when HTML is generated (no file writing needed - use inline HTML)
  useEffect(() => {
    if (!carouselHTML) return;
    setIsLoading(false);
  }, [carouselHTML]);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'readyToPlay':   onReadyToPlay?.(); break;
        case 'playbackStart': onPlaybackStart?.(); break;
        case 'playbackComplete': onPlaybackComplete?.(); break;
        case 'faceChange':    onFaceChange?.(data.faceIndex); break;
        case 'videoStart':    onVideoStart?.(data.faceId); break;
        case 'videoEnd':      onVideoEnd?.(data.faceId); break;
      }
    } catch (e) {}
  }, [onReadyToPlay, onPlaybackStart, onPlaybackComplete, onFaceChange, onVideoStart, onVideoEnd]);

  if (error) return <View style={styles.container}><View style={styles.errorBox} /></View>;

  if (isLoading || !carouselHTML) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKeyRef.current}
        ref={webViewRef}
        source={{ html: carouselHTML, baseUrl: Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined }}
        style={styles.webview}
        originWhitelist={['*', 'file://*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        useWebKit
        cacheEnabled={false}
        onMessage={handleMessage}
        onError={(e) => setError(e.nativeEvent.description)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#0a0a1a',
  },
  errorBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff4444',
  },
});

export default CarouselWebView;
export { CarouselWebView };
