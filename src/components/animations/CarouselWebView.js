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
  const recordingChunksRef = useRef([]);
  const recordingMetaRef = useRef(null);

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

  // Enable recording before next playback
  useEffect(() => {
    if (recordNextPlayback && webViewRef.current) {
      console.log('📹 [Carousel] Enabling recording for next playback');
      webViewRef.current.injectJavaScript(`window._recEnabled = true; true;`);
    }
  }, [recordNextPlayback]);

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
  const MAX_VIDEO_DURATION = 30; // seconds — last-resort fallback (ontimeupdate handles normal end)

  // ─── STATE ────────────────────────────────────────────
  let fullVideoQueue  = ${facesJSON};
  let panelElements   = {};   // index -> { el, video }
  let currentIndex    = 0;
  let isPlaying       = false;
  let videoTimeoutId  = null;
  let stallTimerId    = null;

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

  // ─── CLEANUP VIDEO LISTENERS ─────────────────────────
  function cleanupVideoListeners(video) {
    video.ontimeupdate = null;
    video.onended      = null;
    video.onwaiting    = null;
    video.onplaying    = null;
    video.oncanplay    = null;
  }

  function clearStallTimer() {
    if (stallTimerId) { clearTimeout(stallTimerId); stallTimerId = null; }
  }

  function armStallTimer(video, capturedIdx) {
    clearStallTimer();
    var stallAt = video.currentTime;
    stallTimerId = setTimeout(function() {
      if (currentIndex !== capturedIdx) return; // already advanced past this panel
      if (video.currentTime > stallAt + 0.1) return; // false alarm — video did progress
      console.log('⚠️ Stall at ' + video.currentTime.toFixed(1) + 's — skipping panel ' + capturedIdx);
      cleanupVideoListeners(video);
      advanceToNext();
    }, 4000);
  }

  // ─── PLAY PANEL ───────────────────────────────────────
  function playPanel(idx) {
    if (idx >= fullVideoQueue.length) {
      fadeOutAndComplete();
      return;
    }

    currentIndex = idx;
    rotateTo(idx);

    var entry = panelElements[idx % N];
    if (!entry) { advanceToNext(); return; }

    var video = entry.video;
    var data  = fullVideoQueue[idx];

    // Pause all other panels and clear their listeners
    for (var k in panelElements) {
      if (parseInt(k) !== (idx % N)) {
        var other = panelElements[k].video;
        cleanupVideoListeners(other);
        other.pause();
        other.muted = true;
      }
    }
    clearStallTimer();
    if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }

    // Ensure correct video is loaded
    if (data && data.videoUrl && video._loadedUrl !== data.videoUrl) {
      loadVideo(idx % N, data.videoUrl);
    }

    video.muted  = false;
    video.volume = 1;

    var capturedIdx = idx; // for stale-callback guard

    function doAdvanceFromPanel() {
      if (currentIndex !== capturedIdx) return;
      cleanupVideoListeners(video);
      clearStallTimer();
      if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
      advanceToNext();
    }

    function doPlay() {
      video.style.opacity = '1'; // ensure visible even if oncanplay already fired during load
      video.currentTime = 0;
      video.play().then(function() {
        if (currentIndex !== capturedIdx) return; // advanced while play() was resolving
        postMessage('videoStart', { faceId: idx % N, queueIndex: idx });

        // Start rotation sync with video time
        setupRotationSync(video, idx);

        var dur = video.duration;
        var timeout = (dur && isFinite(dur) && dur > 0)
          ? (dur + 5) * 1000          // dur + 5s safety buffer
          : MAX_VIDEO_DURATION * 1000;

        videoTimeoutId = setTimeout(function() {
          if (currentIndex !== capturedIdx) return;
          doAdvanceFromPanel();
        }, timeout);

        // ontimeupdate: reliable end detection on iOS WKWebView (onended is unreliable)
        video.ontimeupdate = function() {
          if (currentIndex !== capturedIdx) { video.ontimeupdate = null; return; }
          if (video.duration > 0 && video.currentTime >= video.duration - 0.3) {
            doAdvanceFromPanel();
          }
        };

        // Stall detection: arm when buffering, clear when playing
        video.onwaiting = function() { armStallTimer(video, capturedIdx); };
        video.onplaying = function() { clearStallTimer(); };

        // onended: backup (for platforms where ontimeupdate may miss the very end)
        video.onended = function() { doAdvanceFromPanel(); };

        // Preload next
        preloadNext(idx);

      }).catch(function(e) {
        console.log('Play failed: ' + e);
        if (currentIndex === capturedIdx) advanceToNext();
      });
    }

    if (video.readyState >= 2) {
      doPlay();
    } else {
      var waitTimeout = setTimeout(function() {
        video.oncanplay = null;
        doPlay(); // attempt even if not fully ready
      }, 3000);
      video.oncanplay = function() {
        video.oncanplay = null;
        video.style.opacity = '1';
        clearTimeout(waitTimeout);
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

  // ─── FADE OUT ─────────────────────────────────────────
  function fadeOutAndComplete() {
    var fade = document.createElement('div');
    fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;z-index:9999;transition:opacity 1.5s ease;pointer-events:none;';
    document.body.appendChild(fade);
    requestAnimationFrame(function() { requestAnimationFrame(function() {
      fade.style.opacity = '1';
      setTimeout(function() {
        if (_recModule.isRec()) _recModule.stop();
        postMessage('playbackComplete', {});
      }, 1500);
    }); });
  }

  // ─── ADVANCE ──────────────────────────────────────────
  function advanceToNext() {
    if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
    clearStallTimer();
    postMessage('videoEnd', { faceId: currentIndex % N });
    var next = currentIndex + 1;
    if (next >= fullVideoQueue.length) {
      stopAnimLoop();
      isPlaying = false;
      fadeOutAndComplete();
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
    if (window._recEnabled) {
      window._recEnabled = false;
      _recModule.start();
    }
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

  // ─── RECORDING MODULE ─────────────────────────────────
  window._recEnabled = false;
  var _recModule = (function() {
    var hasRecorder = typeof MediaRecorder !== 'undefined';
    var hasCapture = !!(HTMLCanvasElement.prototype &&
                        typeof HTMLCanvasElement.prototype.captureStream === 'function');
    var supported = hasRecorder && hasCapture;

    setTimeout(function() {
      postMessage('recordingSupport', { supported: supported });
    }, 200);

    if (!supported) {
      console.log('📹 [Carousel] Recording not supported');
      return { supported: false, start: function(){}, stop: function(){}, isRec: function(){ return false; } };
    }

    console.log('📹 [Carousel] Client-side recording available');

    var RW = 720, RH = 1280;
    var cvs = document.createElement('canvas');
    cvs.width = RW; cvs.height = RH;
    var ctx = cvs.getContext('2d');

    var recorder = null;
    var chunks = [];
    var recAnimId = null;
    var recState = 'idle';

    function roundedRectPath(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function renderRecFrame() {
      if (recState !== 'recording') return;

      // Dark background
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, RW, RH);

      // Draw active video panel
      if (activeVideo && activeVideo.readyState >= 2) {
        var vw = activeVideo.videoWidth || 720;
        var vh = activeVideo.videoHeight || 1280;
        var pad = 32;
        var panW = RW - pad * 2;
        var panH = RH - pad * 2;
        var scale = Math.max(panW / vw, panH / vh);
        var dw = vw * scale;
        var dh = vh * scale;
        var dx = pad + (panW - dw) / 2;
        var dy = pad + (panH - dh) / 2;

        ctx.save();
        roundedRectPath(pad, pad, panW, panH, 20);
        ctx.clip();
        try { ctx.drawImage(activeVideo, dx, dy, dw, dh); } catch(e) {}
        ctx.restore();

        // Panel border
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.save();
        roundedRectPath(pad, pad, panW, panH, 20);
        ctx.stroke();
        ctx.restore();
      }

      // Player name label
      var face = fullVideoQueue[currentIndex];
      if (face && face.playerName) {
        var labelH = 120;
        var grad = ctx.createLinearGradient(0, RH - 32 - labelH, 0, RH - 32);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(32, RH - 32 - labelH, RW - 64, labelH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(face.playerName, RW / 2, RH - 32 - labelH / 2.8);
      }

      recAnimId = requestAnimationFrame(renderRecFrame);
    }

    function startRec() {
      if (recState !== 'idle') return;
      recState = 'recording';
      chunks = [];

      var stream = cvs.captureStream(30);

      var mimeType = '';
      ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].some(function(m) {
        if (MediaRecorder.isTypeSupported(m)) { mimeType = m; return true; }
      });
      if (!mimeType) {
        postMessage('recordingError', { error: 'No supported format' });
        recState = 'idle'; return;
      }

      recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
      recorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = function() {
        recState = 'processing';
        var blob = new Blob(chunks, { type: mimeType });
        var sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        console.log('📹 [Carousel] Recording blob: ' + sizeMB + 'MB (' + chunks.length + ' chunks)');
        if (blob.size < 50000) {
          postMessage('recordingFailed', { error: 'Recording too small', sizeBytes: blob.size });
          recState = 'idle'; return;
        }
        postMessage('recordingProcessing', { sizeBytes: blob.size });

        var reader = new FileReader();
        reader.onloadend = function() {
          var b64Marker = ';base64,';
          var b64Idx = reader.result.indexOf(b64Marker);
          var b64 = b64Idx >= 0 ? reader.result.substring(b64Idx + b64Marker.length) : reader.result.split(',').slice(1).join(',');
          var CHUNK = 64 * 1024;
          var total = Math.ceil(b64.length / CHUNK);
          postMessage('recordingMeta', { totalChunks: total, sizeBytes: blob.size, mimeType: mimeType });

          var sendIdx = 0;
          function sendNext() {
            if (sendIdx >= total) {
              postMessage('recordingComplete', { totalChunks: total, sizeBytes: blob.size });
              recState = 'idle'; return;
            }
            var chunk = b64.substring(sendIdx * CHUNK, (sendIdx + 1) * CHUNK);
            postMessage('recordingChunk', { index: sendIdx, data: chunk, total: total });
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
      console.log('📹 [Carousel] Recording started: ' + mimeType);
    }

    function stopRec() {
      if (recState !== 'recording' || !recorder) return;
      console.log('📹 [Carousel] Stopping recording...');
      if (recAnimId) { cancelAnimationFrame(recAnimId); recAnimId = null; }
      recorder.stop();
    }

    return {
      supported: true,
      start: startRec,
      stop: stopRec,
      isRec: function() { return recState === 'recording'; }
    };
  })();

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
        case 'recordingSupport':
          console.log('📹 [Carousel] Recording support:', data.supported);
          onRecordingSupport?.(data.supported);
          break;
        case 'recordingStarted':
          console.log('📹 [Carousel] Recording started in WebView');
          break;
        case 'recordingProcessing':
          onRecordingProgress?.({ phase: 'processing', progress: 0 });
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
        case 'recordingComplete': {
          console.log('📹 [Carousel] All chunks received:', data.totalChunks);
          onRecordingProgress?.({ phase: 'saving', progress: 90 });
          const base64Data = recordingChunksRef.current.join('');
          const recMime = recordingMetaRef.current?.mimeType || '';
          const recExt = recMime.includes('mp4') ? '.mp4' : '.webm';
          const fileUri = FileSystem.cacheDirectory + 'carousel_recording_' + Date.now() + recExt;
          FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          }).then(() => {
            console.log('📹 [Carousel] Recording saved:', fileUri);
            onRecordingComplete?.(fileUri);
            recordingChunksRef.current = [];
            recordingMetaRef.current = null;
          }).catch(err => {
            console.error('📹 [Carousel] Failed to save recording:', err);
            onRecordingComplete?.(null);
          });
          break;
        }
        case 'recordingFailed':
          console.warn('📹 [Carousel] Recording failed (too small):', data.sizeBytes, 'bytes');
          onRecordingComplete?.(null);
          break;
        case 'recordingError':
          console.error('📹 [Carousel] Recording error:', data.error);
          onRecordingComplete?.(null);
          break;
      }
    } catch (e) {}
  }, [onReadyToPlay, onPlaybackStart, onPlaybackComplete, onFaceChange, onVideoStart, onVideoEnd, onRecordingSupport, onRecordingComplete, onRecordingProgress]);

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
