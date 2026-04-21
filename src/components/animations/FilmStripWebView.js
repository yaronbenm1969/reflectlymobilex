import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_W = Math.min(SCREEN_WIDTH * 0.88, 380);
const FRAME_H = FRAME_W * 1.3;
const FRAME_GAP = 28;

const FilmStripWebView = ({
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
  storyName = '',
  triggerAutoPlay = false,
  recordNextPlayback = false,
  backgroundUrl = null,
  backgroundMediaType = 'video',
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialFaces, setInitialFaces] = useState(null);
  const hasInitializedRef = useRef(false);
  const webViewKeyRef = useRef(Date.now());
  const injectedThumbsRef = useRef({});
  const lastVideoUrlsRef = useRef('');

  useEffect(() => {
    if (hasInitializedRef.current) return;
    const minRequired = Math.min(4, faces.length);
    const readyCount = faces.slice(0, minRequired).filter(f => f?.videoUrl).length;
    if (minRequired > 0 && readyCount >= minRequired) {
      hasInitializedRef.current = true;
      setInitialFaces([...faces]);
    }
  }, [faces]);

  useEffect(() => {
    if (!webViewRef.current || !hasInitializedRef.current) return;
    faces.forEach((face, index) => {
      if (face?.thumbnailUrl && injectedThumbsRef.current[index] !== face.thumbnailUrl) {
        injectedThumbsRef.current[index] = face.thumbnailUrl;
        webViewRef.current.injectJavaScript(
          `if(window.setFrameThumbnail)window.setFrameThumbnail(${index},${JSON.stringify(face.thumbnailUrl)});true;`
        );
      }
    });
  }, [faces]);

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
      `window.updateFrames && window.updateFrames(${JSON.stringify(facesData)}); true;`
    );
  }, [faces]);

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

  const filmHTML = useMemo(() => {
    if (!initialFaces || initialFaces.length === 0) return null;

    const N = initialFaces.length;
    const STEP = FRAME_W + FRAME_GAP;

    const facesJSON = JSON.stringify(initialFaces.map((face, index) => ({
      index,
      videoUrl: face?.videoUrl || null,
      playerName: face?.playerName || `סרטון ${index + 1}`,
      thumbnailUrl: face?.thumbnailUrl || null,
    })));

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #0d0d0d;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font-family: -apple-system, sans-serif;
  }

  /* Film strip container — centered viewport */
  .viewport {
    width: 100vw;
    height: ${FRAME_H + 80}px;
    position: relative;
    perspective: 900px;
    perspective-origin: 50% 50%;
    overflow: hidden;
  }

  /* The actual strip that moves */
  .strip {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    display: flex;
    align-items: center;
    transform-style: preserve-3d;
    /* translateX driven by rAF */
  }

  /* Sprocket rails — live inside .strip so they scroll with it */
  .sprocket-rail {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
    background: repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 10px,
      #1a1a1a 10px,
      #1a1a1a 14px,
      #333 14px,
      #333 26px,
      #1a1a1a 26px,
      #1a1a1a 30px,
      transparent 30px,
      transparent 40px
    );
    z-index: 6;
    pointer-events: none;
  }
  .sprocket-rail.top { top: 8px; }
  .sprocket-rail.bot { bottom: 8px; }

  /* Each film frame */
  .frame {
    position: relative;
    width: ${FRAME_W}px;
    height: ${FRAME_H}px;
    flex-shrink: 0;
    margin: 0 ${FRAME_GAP / 2}px;
    border-radius: 4px;
    overflow: hidden;
    background: #111;
    border: 2px solid #2a2a2a;
    box-shadow: 0 0 30px rgba(0,0,0,0.8);
  }

  .frame img.frame-thumb {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 0;
  }

  .frame video {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 1;
    background: #000;
  }

  /* Vignette on each frame */
  .frame::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%);
    z-index: 2;
    pointer-events: none;
  }

  /* Frame number badge */
  .frame-num {
    position: absolute;
    bottom: 6px;
    right: 8px;
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    font-family: monospace;
    letter-spacing: 1px;
    z-index: 3;
  }

  /* Play button */
  #play-btn {
    position: fixed;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.12);
    border: 2px solid rgba(255,255,255,0.55);
    border-radius: 50px;
    color: white;
    font-size: 16px;
    font-weight: 700;
    padding: 13px 34px;
    cursor: pointer;
    z-index: 20;
    backdrop-filter: blur(8px);
    letter-spacing: 1px;
  }
  #play-btn:active { opacity: 0.7; }

  /* Film grain overlay */
  .grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 128px 128px;
  }

  /* ─── INTRO OVERLAY ─── */
  #intro-overlay {
    position: fixed; inset: 0; background: #000; z-index: 100;
    display: none; flex-direction: column; align-items: center;
    justify-content: center; overflow: hidden;
  }
  #intro-flash {
    position: absolute; inset: 0;
    animation: filmFlash 1.2s ease-out forwards;
  }
  @keyframes filmFlash {
    0%   { background: #000; }
    8%   { background: #fff; }
    18%  { background: #000; }
    30%  { background: #fff; }
    42%  { background: #000; }
    52%  { background: #f5f0dc; }
    65%  { background: #000; }
    100% { background: #000; }
  }
  #intro-title-wrap {
    position: relative; z-index: 2; text-align: center;
    animation: titleReveal 1s ease-out 1.4s both;
  }
  @keyframes titleReveal {
    from { opacity: 0; transform: scale(1.06); }
    to   { opacity: 1; transform: scale(1); }
  }
  .intro-tag {
    color: rgba(255,255,255,0.4); font-size: 10px; letter-spacing: 6px;
    text-transform: uppercase; font-family: monospace; margin-bottom: 18px;
    animation: titleReveal 0.8s ease-out 1.7s both;
  }
  #intro-title-text {
    color: #fff; font-size: 26px; font-weight: 700; letter-spacing: 5px;
    text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;
    text-shadow: 0 0 60px rgba(255,255,200,0.35), 0 2px 10px rgba(0,0,0,0.9);
    padding: 0 24px; line-height: 1.3;
  }
  .intro-line {
    height: 1px; background: rgba(255,255,255,0.3);
    margin: 18px auto 0;
    animation: lineGrow 0.8s ease-out 1.9s both;
  }
  @keyframes lineGrow {
    from { width: 0; }
    to   { width: 70px; }
  }
  .intro-fade-out {
    animation: overlayOut 0.7s ease-in forwards !important;
  }
  @keyframes overlayOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* ─── OUTRO OVERLAY ─── */
  #outro-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.94); z-index: 100;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; opacity: 0; pointer-events: none;
    transition: opacity 1.5s ease;
  }
  #outro-overlay.show { opacity: 1; pointer-events: all; }
  #outro-title {
    color: rgba(255,255,255,0.85); font-size: 20px; font-weight: 300;
    letter-spacing: 8px; text-transform: uppercase;
    font-family: Georgia, serif; text-align: center; padding: 0 30px;
    opacity: 0; transform: translateY(14px);
    transition: opacity 1.2s ease 0.7s, transform 1.2s ease 0.7s;
  }
  #outro-overlay.show #outro-title { opacity: 1; transform: translateY(0); }
  .outro-line {
    width: 50px; height: 1px; background: rgba(255,255,255,0.25);
    margin: 16px auto 0; opacity: 0; transition: opacity 1s ease 1.2s;
  }
  #outro-overlay.show .outro-line { opacity: 1; }
  #replay-btn {
    margin-top: 36px; background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.35); border-radius: 50px;
    color: white; font-size: 14px; padding: 11px 28px; cursor: pointer;
    opacity: 0; transition: opacity 1s ease 1.8s; letter-spacing: 1px;
  }
  #outro-overlay.show #replay-btn { opacity: 1; }
</style>
</head>
<body>

${bgHtml}
<div class="grain"></div>

<!-- Intro: Hollywood-style flash + title -->
<div id="intro-overlay">
  <div id="intro-flash"></div>
  <div id="intro-title-wrap">
    <div class="intro-tag">◈ הסרט שלך ◈</div>
    <div id="intro-title-text">${storyName}</div>
    <div class="intro-line"></div>
  </div>
</div>

<!-- Outro: end credits -->
<div id="outro-overlay">
  <div id="outro-title">${storyName}</div>
  <div class="outro-line"></div>
  <button id="replay-btn" onclick="replayPlayback()">↺ הקרן שוב</button>
</div>

<div class="viewport">
  <div class="strip" id="strip"></div>
</div>

<button id="play-btn" onclick="startPlayback()">▶ הקרן</button>

<script>
  // ─── CONFIG ───────────────────────────────────────────
  const N           = ${N};
  const STEP        = ${STEP};     // frame width + gap
  const INIT_X      = ${Math.round(SCREEN_WIDTH / 2 - STEP / 2)};  // translateX to center frame 0
  const STORY_NAME  = ${JSON.stringify(storyName)};
  const MAX_VIDEO_DURATION = 45;

  // ─── STATE ────────────────────────────────────────────
  let fullVideoQueue = ${facesJSON};
  let frameElements  = {};  // index -> { el, video }
  let currentIndex   = 0;
  let isPlaying      = false;
  let videoTimeoutId = null;

  // ─── SCROLL SYNC (video-time-driven) ──────────────────
  const HALF_STEP  = STEP / 2;
  let currentX     = 0;      // live strip translateX
  let scrollFromX  = 0;
  let scrollToX    = 0;
  let activeVideo  = null;
  let animFrameId  = null;
  let animStart    = 0;

  // ─── BUILD FRAMES ─────────────────────────────────────
  function buildFrames() {
    var strip = document.getElementById('strip');
    strip.innerHTML = '';
    frameElements = {};

    // Sprocket rails (absolute, stay inside strip, scroll with it)
    var sTop = document.createElement('div');
    sTop.className = 'sprocket-rail top';
    strip.appendChild(sTop);
    var sBot = document.createElement('div');
    sBot.className = 'sprocket-rail bot';
    strip.appendChild(sBot);

    for (var i = 0; i < N; i++) {
      var face = fullVideoQueue[i] || {};

      var frame = document.createElement('div');
      frame.className = 'frame';
      frame.id = 'frame-' + i;

      // Thumbnail
      if (face.thumbnailUrl) {
        var thumb = document.createElement('img');
        thumb.className = 'frame-thumb';
        thumb.src = face.thumbnailUrl;
        frame.appendChild(thumb);
      }

      // Video
      var video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.opacity = '0';
      video.style.cssText += 'width:100%;height:100%;object-fit:cover;opacity:0;';
      frame.appendChild(video);

      // Frame number
      var num = document.createElement('div');
      num.className = 'frame-num';
      num.textContent = String(i + 1).padStart(2, '0');
      frame.appendChild(num);

      strip.appendChild(frame);
      frameElements[i] = { el: frame, video: video };

      if (face.videoUrl) loadVideo(i, face.videoUrl);
    }

    // Center strip: strip left edge is at 50vw, first frame center = 0
    // So initial translateX = 0 means frame 0 is centered
    currentX = 0;
    applyTransform();
  }

  // ─── APPLY TRANSFORM ──────────────────────────────────
  function applyTransform(floatY, curveX) {
    var fy = floatY || 0;
    var cx = curveX || 0;
    var strip = document.getElementById('strip');
    if (strip) {
      strip.style.transform =
        'translateX(' + (INIT_X - currentX) + 'px) translateY(' + fy + 'px) rotateX(' + cx + 'deg)';
    }
  }

  // ─── LOAD VIDEO ───────────────────────────────────────
  function loadVideo(frameIdx, url) {
    var entry = frameElements[frameIdx % N];
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

  // ─── ANIMATION LOOP ───────────────────────────────────
  function animLoop(ts) {
    if (!isPlaying) return;
    if (!animStart) animStart = ts;
    var elapsed = (ts - animStart) / 1000;

    var floatY = Math.sin(elapsed * 0.5) * 6;
    var curveX = Math.sin(elapsed * 0.4) * 1.5;   // gentle film-bend illusion

    if (activeVideo) {
      var dur = activeVideo.duration;
      var cur = activeVideo.currentTime;
      if (dur && isFinite(dur) && dur > 0) {
        var t = Math.min(cur / dur, 1);
        var ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        currentX = scrollFromX + (scrollToX - scrollFromX) * ease;
      }
    }

    applyTransform(floatY, curveX);
    animFrameId = requestAnimationFrame(animLoop);
  }

  function startAnimLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animStart = 0;
    animFrameId = requestAnimationFrame(animLoop);
  }

  function stopAnimLoop() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    activeVideo = null;
  }

  function setupScrollSync(video, idx) {
    // Enter from right (+HALF_STEP from center), exit to left (-HALF_STEP)
    var centerX = STEP * idx;
    scrollFromX = centerX - HALF_STEP;
    scrollToX   = centerX + HALF_STEP;
    currentX    = scrollFromX;
    activeVideo = video;
  }

  // ─── PLAY FRAME ───────────────────────────────────────
  function playFrame(idx) {
    if (idx >= fullVideoQueue.length) {
      stopAnimLoop();
      isPlaying = false;
      // Show outro, then send complete after fade
      var outroEl = document.getElementById('outro-overlay');
      if (outroEl) {
        setTimeout(function() {
          outroEl.classList.add('show');
          setTimeout(function() { postMessage('playbackComplete', {}); }, 1800);
        }, 300);
      } else {
        document.getElementById('play-btn').style.display = 'block';
        postMessage('playbackComplete', {});
      }
      return;
    }

    currentIndex = idx;
    postMessage('faceChange', { faceIndex: idx });

    var entry = frameElements[idx % N];
    if (!entry) { advanceToNext(); return; }

    var video = entry.video;
    var data  = fullVideoQueue[idx];

    // Pause all others
    for (var k in frameElements) {
      if (parseInt(k) !== (idx % N)) {
        frameElements[k].video.pause();
        frameElements[k].video.muted = true;
      }
    }

    if (data && data.videoUrl && video._loadedUrl !== data.videoUrl) {
      loadVideo(idx % N, data.videoUrl);
    }

    video.muted  = false;
    video.volume = 1;

    var stallTimer = null;
    function clearStall() { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } }
    function resetStallTimer() {
      clearStall();
      stallTimer = setTimeout(function() { clearStall(); advanceToNext(); }, 7000);
    }

    function doPlay() {
      video.currentTime = 0;
      video.onerror = function() { clearStall(); if (videoTimeoutId) clearTimeout(videoTimeoutId); advanceToNext(); };
      video.onwaiting = resetStallTimer;
      video.onstalled = resetStallTimer;
      video.ontimeupdate = function() { clearStall(); };

      video.play().then(function() {
        postMessage('videoStart', { faceId: idx % N, queueIndex: idx });
        setupScrollSync(video, idx);
        resetStallTimer();

        var dur = video.duration;
        var timeout = (dur && isFinite(dur) && dur > 0)
          ? (dur + 2) * 1000
          : MAX_VIDEO_DURATION * 1000;

        videoTimeoutId = setTimeout(function() { clearStall(); advanceToNext(); }, timeout);
        preloadNext(idx);

      }).catch(function() { clearStall(); advanceToNext(); });
    }

    video.onended = function() {
      clearStall();
      if (videoTimeoutId) clearTimeout(videoTimeoutId);
      videoTimeoutId = null;
      advanceToNext();
    };

    if (video.readyState >= 2) {
      doPlay();
    } else {
      var t = setTimeout(doPlay, 3000);
      video.oncanplay = function() {
        video.oncanplay = null;
        video.style.opacity = '1';
        clearTimeout(t);
        doPlay();
      };
    }
  }

  // ─── PRELOAD ──────────────────────────────────────────
  function preloadNext(fromIdx) {
    for (var ahead = 1; ahead <= 2; ahead++) {
      var nIdx = fromIdx + ahead;
      if (nIdx >= fullVideoQueue.length) break;
      var data = fullVideoQueue[nIdx];
      if (data && data.videoUrl) loadVideo(nIdx % N, data.videoUrl);
    }
  }

  // ─── ADVANCE ──────────────────────────────────────────
  function advanceToNext() {
    if (videoTimeoutId) { clearTimeout(videoTimeoutId); videoTimeoutId = null; }
    postMessage('videoEnd', { faceId: currentIndex % N });
    playFrame(currentIndex + 1);
  }

  // ─── PUBLIC API ───────────────────────────────────────
  window.startPlayback = function() {
    if (isPlaying) return;
    isPlaying = true;
    document.getElementById('play-btn').style.display = 'none';
    var bgVid = document.getElementById('custom-bg');
    if (bgVid && bgVid.tagName === 'VIDEO') bgVid.play();
    postMessage('playbackStart', {});
    var introEl = document.getElementById('intro-overlay');
    if (introEl && STORY_NAME) {
      introEl.style.display = 'flex';   // show now → CSS animations restart from 0
      // flash 1.2s → title shown 2.3s → fade out 0.7s → play
      setTimeout(function() {
        introEl.classList.add('intro-fade-out');
        setTimeout(function() {
          introEl.style.display = 'none';
          startAnimLoop();
          playFrame(0);
        }, 700);
      }, 3500);
    } else {
      if (introEl) introEl.style.display = 'none';
      startAnimLoop();
      playFrame(0);
    }
  };

  window.replayPlayback = function() {
    var outroEl = document.getElementById('outro-overlay');
    if (outroEl) outroEl.classList.remove('show');
    isPlaying = false;
    currentIndex = 0;
    currentX = 0;
    applyTransform();
    // Small delay so outro fades out before restarting
    setTimeout(function() { window.startPlayback(); }, 500);
  };

  window.updateFrames = function(facesData) {
    facesData.forEach(function(face) {
      if (!fullVideoQueue[face.index] || !fullVideoQueue[face.index].videoUrl) {
        fullVideoQueue[face.index] = face;
      }
      if (face.videoUrl) {
        var entry = frameElements[face.index % N];
        if (entry && entry.video._loadedUrl !== face.videoUrl) {
          loadVideo(face.index % N, face.videoUrl);
        }
      }
    });
  };

  window.setFrameThumbnail = function(queueIdx, dataUri) {
    var entry = frameElements[queueIdx % N];
    if (!entry) return;
    var existing = entry.el.querySelector('img.frame-thumb');
    if (existing) { existing.src = dataUri; return; }
    var img = document.createElement('img');
    img.className = 'frame-thumb';
    img.src = dataUri;
    entry.el.insertBefore(img, entry.el.firstChild);
  };

  // ─── MESSAGES ─────────────────────────────────────────
  function postMessage(type, data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data)));
    }
  }

  // ─── INIT ─────────────────────────────────────────────
  buildFrames();
  postMessage('readyToPlay', { videoCount: fullVideoQueue.length });
</script>
</body>
</html>`;
  }, [initialFaces, storyName, backgroundUrl, backgroundMediaType]);

  useEffect(() => {
    if (!filmHTML) return;
    setIsLoading(false);
  }, [filmHTML]);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'readyToPlay':      onReadyToPlay?.(); break;
        case 'playbackStart':    onPlaybackStart?.(); break;
        case 'playbackComplete': onPlaybackComplete?.(); break;
        case 'faceChange':       onFaceChange?.(data.faceIndex); break;
        case 'videoStart':       onVideoStart?.(data.faceId); break;
        case 'videoEnd':         onVideoEnd?.(data.faceId); break;
      }
    } catch (e) {}
  }, [onReadyToPlay, onPlaybackStart, onPlaybackComplete, onFaceChange, onVideoStart, onVideoEnd]);

  if (error) return <View style={styles.container}><View style={styles.errorBox} /></View>;

  if (isLoading || !filmHTML) {
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
        source={{ html: filmHTML, baseUrl: Platform.OS === 'ios' ? FileSystem.cacheDirectory : undefined }}
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
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#0d0d0d',
  },
  errorBox: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: '#ff4444',
  },
});

export default FilmStripWebView;
export { FilmStripWebView };
