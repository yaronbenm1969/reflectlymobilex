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
  storyName = '',
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
        : `<video id="custom-bg" crossorigin="anonymous" src="${safeBgUrl}" autoplay loop muted playsinline style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;"></video>`)
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
  const PW          = ${Math.round(PANEL_WIDTH)};
  const PH          = ${Math.round(PANEL_HEIGHT)};
  const SW          = ${Math.round(SCREEN_WIDTH)};  // screen width for canvas scale
  const STORY_NAME  = ${JSON.stringify(storyName)};
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
  var _floatY         = 0;       // shared float offset (recording reads this)

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
      video.crossOrigin = 'anonymous';
      video.setAttribute('crossorigin', 'anonymous');
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
    _floatY = floatY; // share with recording canvas

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
    for (var ahead = 1; ahead <= 3; ahead++) {
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
    // Signal recording to show title card (it stops itself after ~2.5s)
    if (_recModule.isRec()) _recModule.showTitleCard();
    var fade = document.createElement('div');
    fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;z-index:9999;transition:opacity 2s ease;pointer-events:none;';
    document.body.appendChild(fade);
    // Delay CSS fade to let title card show first
    setTimeout(function() {
      requestAnimationFrame(function() { requestAnimationFrame(function() {
        fade.style.opacity = '1';
        setTimeout(function() {
          postMessage('playbackComplete', {});
        }, 2000);
      }); });
    }, 1000);
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
    // Must be in DOM for captureStream to work on iOS WKWebView
    cvs.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(cvs);
    var ctx = cvs.getContext('2d');

    var recorder = null;
    var chunks = [];
    var recAnimId = null;
    var recState = 'idle';
    var _titlePhase = false;
    var _titleFrames = 0;
    var TITLE_FRAMES = 75; // ~2.5s at 30fps

    // ─── 3D RECORDING PROJECTION ─────────────────────────
    var DRAW_GRID = 10; // 10×10 cells per panel — smoother affine approximation
    var SEAM_PX   = 1.0; // expand each cell clip by 1px to hide seam gaps
    var REC_FOCAL = 1200; // exact match to CSS perspective:1200px

    // CSS: front panel at translateZ(+RADIUS) appears LARGER (closer to viewer)
    // Scale = REC_FOCAL / (REC_FOCAL - RADIUS)  — matches CSS perspective formula
    // _csScale maps canvas pixels to CSS pixels: RW/SW
    var _front_proj_w = PW * REC_FOCAL / (REC_FOCAL - RADIUS);
    var _csScale = RW / SW;

    // Bilinear interpolation between 4 projected screen-space corners
    function biLerp3D(tl, tr, bl, br, u, v) {
      return {
        x: (1-v)*((1-u)*tl.x + u*tr.x) + v*((1-u)*bl.x + u*br.x),
        y: (1-v)*((1-u)*tl.y + u*tr.y) + v*((1-u)*bl.y + u*br.y)
      };
    }

    // Project a CSS-space 3D point onto the recording canvas
    // Matches CSS perspective: translateZ(+z) = closer to viewer = appears LARGER
    // Formula: scale = REC_FOCAL / (REC_FOCAL - z)
    function projPt(x, y, z) {
      var dz = REC_FOCAL - z;
      if (dz < 1) return null;
      var s = (REC_FOCAL * _csScale) / dz;
      return { x: RW/2 + x*s, y: RH/2 + y*s };
    }

    // Expand a screen-space point outward from cell center by SEAM_PX
    function seamExpand(p, ccx, ccy) {
      var dx = p.x - ccx, dy = p.y - ccy;
      var d = Math.sqrt(dx*dx + dy*dy) || 1;
      return { x: p.x + dx/d * SEAM_PX, y: p.y + dy/d * SEAM_PX };
    }

    // Draw a video into a projected 3D quad using bilinear-subdivided affine mapping
    function drawPanel3D(video, tl, tr, bl, br) {
      if (!tl || !tr || !bl || !br) return;
      var vw = video.videoWidth  || 720;
      var vh = video.videoHeight || 1280;
      // Clip to full panel boundary once — prevents bleed beyond panel edges
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
      ctx.closePath(); ctx.clip();
      for (var gy = 0; gy < DRAW_GRID; gy++) {
        for (var gx = 0; gx < DRAW_GRID; gx++) {
          var u0 = gx/DRAW_GRID,     u1 = (gx+1)/DRAW_GRID;
          var v0 = gy/DRAW_GRID,     v1 = (gy+1)/DRAW_GRID;
          var p00 = biLerp3D(tl, tr, bl, br, u0, v0);
          var p10 = biLerp3D(tl, tr, bl, br, u1, v0);
          var p11 = biLerp3D(tl, tr, bl, br, u1, v1);
          var p01 = biLerp3D(tl, tr, bl, br, u0, v1);
          var sw  = (u1-u0)*vw, sh = (v1-v0)*vh;
          var sx0 = u0*vw,      sy0 = v0*vh;
          var fax = (p10.x-p00.x)/sw, fay = (p10.y-p00.y)/sw;
          var fcx = (p01.x-p00.x)/sh, fcy = (p01.y-p00.y)/sh;
          // Expand clip by SEAM_PX from cell center to hide inter-cell gaps
          var ccx = (p00.x+p10.x+p11.x+p01.x)/4;
          var ccy = (p00.y+p10.y+p11.y+p01.y)/4;
          var e00 = seamExpand(p00,ccx,ccy), e10 = seamExpand(p10,ccx,ccy);
          var e11 = seamExpand(p11,ccx,ccy), e01 = seamExpand(p01,ccx,ccy);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(e00.x, e00.y); ctx.lineTo(e10.x, e10.y);
          ctx.lineTo(e11.x, e11.y); ctx.lineTo(e01.x, e01.y);
          ctx.closePath(); ctx.clip();
          ctx.setTransform(fax, fay, fcx, fcy,
            p00.x - fax*sx0 - fcx*sy0,
            p00.y - fay*sx0 - fcy*sy0);
          try { ctx.drawImage(video, 0, 0, vw, vh); } catch(e){}
          ctx.restore();
        }
      }
      ctx.restore(); // restore panel boundary clip
    }

    function renderRecFrame() {
      if (recState !== 'recording') return;

      // ── Title card phase (after all panels done) ──────
      if (_titlePhase) {
        _titleFrames++;
        ctx.globalAlpha = 1.0;
        // Dark overlay on background
        var bgElT = document.getElementById('custom-bg');
        if (bgElT && bgElT.readyState >= 2) {
          try { ctx.drawImage(bgElT, 0, 0, RW, RH); } catch(e) { ctx.fillStyle='#0a0a1a'; ctx.fillRect(0,0,RW,RH); }
        } else { ctx.fillStyle='#0a0a1a'; ctx.fillRect(0,0,RW,RH); }
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, RW, RH);
        // Story name — always draw if available
        var titleText = STORY_NAME || '';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 58px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 16;
        if (titleText) ctx.fillText(titleText, RW/2, RH/2);
        ctx.shadowBlur = 0;
        if (_titleFrames >= TITLE_FRAMES) { stopRec(); return; }
        recAnimId = requestAnimationFrame(renderRecFrame);
        return;
      }

      // Solid fill first — ensures no transparent frames
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, RW, RH);

      // Background
      var bgEl = document.getElementById('custom-bg');
      if (bgEl && bgEl.readyState >= 2) {
        try { ctx.drawImage(bgEl, 0, 0, RW, RH); } catch(e) {
          ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, RW, RH);
        }
      } else {
        ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, RW, RH);
      }

      // Compute visible panels (front hemisphere only), sort back-to-front
      var visiblePanels = [];
      for (var pi = 0; pi < N; pi++) {
        var alpha = (ANGLE_STEP * pi + currentAngleY) * Math.PI / 180;
        var cz3 = RADIUS * Math.cos(alpha);
        if (cz3 <= 0) continue; // backface cull
        var cx3 = RADIUS * Math.sin(alpha);
        var cy3 = _floatY;
        var hw = PW / 2, hh = PH / 2;
        var pax = Math.cos(alpha), paz = -Math.sin(alpha); // panel X-axis in world
        var c_tl = projPt(cx3 - hw*pax, cy3 - hh, cz3 - hw*paz);
        var c_tr = projPt(cx3 + hw*pax, cy3 - hh, cz3 + hw*paz);
        var c_bl = projPt(cx3 - hw*pax, cy3 + hh, cz3 - hw*paz);
        var c_br = projPt(cx3 + hw*pax, cy3 + hh, cz3 + hw*paz);
        if (!c_tl || !c_tr || !c_bl || !c_br) continue;
        visiblePanels.push({ z: cz3, tl: c_tl, tr: c_tr, bl: c_bl, br: c_br,
                             entry: panelElements[pi], panelIdx: pi });
      }
      visiblePanels.sort(function(a, b) { return a.z - b.z; }); // back-to-front

      visiblePanels.forEach(function(p) {
        var entry = p.entry;
        if (!entry) return;
        var video = entry.video;
        var isActive = (currentIndex % N === p.panelIdx);
        // Always draw at full opacity — partial opacity causes visible grid seams
        ctx.globalAlpha = 1.0;
        if (video && video.readyState >= 2) {
          drawPanel3D(video, p.tl, p.tr, p.bl, p.br);
        } else {
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.moveTo(p.tl.x, p.tl.y); ctx.lineTo(p.tr.x, p.tr.y);
          ctx.lineTo(p.br.x, p.br.y); ctx.lineTo(p.bl.x, p.bl.y);
          ctx.closePath(); ctx.fill();
        }
        // Dim non-active panels with a dark overlay (no seam artifacts)
        if (!isActive) {
          ctx.globalAlpha = 0.60;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.moveTo(p.tl.x, p.tl.y); ctx.lineTo(p.tr.x, p.tr.y);
          ctx.lineTo(p.br.x, p.br.y); ctx.lineTo(p.bl.x, p.bl.y);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      });

      // Player name label
      var face = fullVideoQueue[currentIndex];
      if (face && face.playerName) {
        var labelH = 110;
        var grad = ctx.createLinearGradient(0, RH - labelH, 0, RH);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, RH - labelH, RW, labelH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(face.playerName, RW/2, RH - labelH/2);
      }

      recAnimId = requestAnimationFrame(renderRecFrame);
    }

    function startRec() {
      if (recState !== 'idle') return;
      recState = 'recording';
      chunks = [];

      var stream = cvs.captureStream(30);

      // Capture audio from panel videos (same approach as CubeWebView)
      try {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var dest = audioCtx.createMediaStreamDestination();
        var audioSources = new Set();
        Object.values(panelElements).forEach(function(entry) {
          if (entry && entry.video && !audioSources.has(entry.video)) {
            try {
              var src = audioCtx.createMediaElementSource(entry.video);
              src.connect(dest);
              src.connect(audioCtx.destination);
              audioSources.add(entry.video);
            } catch(e) {}
          }
        });
        dest.stream.getAudioTracks().forEach(function(t) { stream.addTrack(t); });
        console.log('🔊 [Carousel] Audio capture: ' + audioSources.size + ' sources');
      } catch(e) {
        console.warn('🔊 [Carousel] Audio capture failed:', e.message);
      }

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
      isRec: function() { return recState === 'recording'; },
      showTitleCard: function() { _titlePhase = true; _titleFrames = 0; }
    };
  })();

  // ─── INIT ─────────────────────────────────────────────
  buildPanels();
  postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
</script>
</body>
</html>`;
  }, [initialFaces, backgroundUrl, backgroundMediaType, storyName]);

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
