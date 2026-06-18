import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SW, height: SH } = Dimensions.get('window');

const SpotlightWebView = ({
  faces = [],
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
  musicUrl = null,
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitRef = useRef(false);
  const lastUrlsRef = useRef('');
  const recordingChunksRef = useRef([]);
  const recordingMetaRef = useRef(null);

  // Group faces by player
  const playerGroups = React.useMemo(() => {
    const map = {};
    faces.forEach(f => {
      if (!f?.videoUrl) return;
      const name = f.playerName || 'שחקן';
      if (!map[name]) map[name] = { name, clips: [], thumbnail: f.thumbnailUrl || null };
      map[name].clips.push(f.videoUrl);
    });
    return Object.values(map);
  }, [faces]);

  useEffect(() => {
    if (hasInitRef.current) return;
    if (playerGroups.length === 0) return;
    hasInitRef.current = true;
  }, [playerGroups]);

  useEffect(() => {
    if (!webViewRef.current || !hasInitRef.current) return;
    const sig = playerGroups.map(p => p.clips[0]).join('|');
    if (!sig || lastUrlsRef.current === sig) return;
    lastUrlsRef.current = sig;
    webViewRef.current.injectJavaScript(
      `window.updatePlayers && window.updatePlayers(${JSON.stringify(playerGroups)}); true;`
    );
  }, [playerGroups]);

  useEffect(() => {
    if (!triggerAutoPlay || !webViewRef.current || !hasInitRef.current) return;
    webViewRef.current.injectJavaScript(`window.startPlayback && window.startPlayback(); true;`);
  }, [triggerAutoPlay]);

  useEffect(() => {
    if (!webViewRef.current || !hasInitRef.current) return;
    if (recordNextPlayback) {
      webViewRef.current.injectJavaScript(`window.armRecording && window.armRecording(${JSON.stringify(musicUrl)}); true;`);
    }
  }, [recordNextPlayback, musicUrl]);

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'ready': onReadyToPlay?.(); break;
        case 'playbackStarted': onPlaybackStart?.(); break;
        case 'playbackComplete': onPlaybackComplete?.(); break;
        case 'recordingSupport': onRecordingSupport?.(msg.supported); break;
        case 'recordingChunk':
          recordingChunksRef.current.push(msg.data);
          onRecordingProgress?.(msg.progress || 0);
          break;
        case 'recordingComplete':
          recordingMetaRef.current = msg.meta;
          onRecordingComplete?.({
            chunks: recordingChunksRef.current,
            meta: msg.meta,
          });
          recordingChunksRef.current = [];
          break;
      }
    } catch {}
  };

  const html = React.useMemo(() => buildHTML(playerGroups, storyName, SW, SH), [playerGroups, storyName]);

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreen]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={handleMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
      />
    </View>
  );
};

function buildHTML(playerGroups, storyName, sw, sh) {
  const playersJson = JSON.stringify(playerGroups);
  const storyNameJson = JSON.stringify(storyName);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${sw}px; height:${sh}px; overflow:hidden; background:#0a0010; font-family:sans-serif; }

#stage { position:relative; width:100%; height:100%; }

#grid-bg {
  position:absolute; inset:0;
  background: radial-gradient(ellipse at center, #1a0040 0%, #0a0010 70%);
}

.cell {
  position:absolute;
  border-radius:12px;
  overflow:hidden;
  border:2px solid rgba(124,58,237,0.4);
  transition: transform 0.55s cubic-bezier(0.4,0,0.2,1),
              opacity 0.4s ease,
              border-color 0.3s ease;
  background:#111;
}
.cell video { width:100%; height:100%; object-fit:cover; display:block; }
.cell .name-tag {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(transparent,rgba(0,0,0,0.75));
  color:white; font-size:13px; padding:6px 8px 5px;
  text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.cell.dimmed { opacity:0.25; }
.cell.active { border-color:rgba(124,58,237,0.9); z-index:10; }

#story-title {
  position:absolute; top:60px; left:0; right:0;
  text-align:center; color:white;
  font-size:22px; font-weight:bold;
  text-shadow: 0 0 20px rgba(124,58,237,0.8);
  opacity:0; transition:opacity 0.8s ease;
  z-index:20;
}

#fade-overlay {
  position:absolute; inset:0;
  background:black; opacity:0;
  pointer-events:none; z-index:30;
  transition:opacity 0.8s ease;
}

#play-btn {
  position:absolute; inset:0; display:flex;
  align-items:center; justify-content:center; z-index:40;
  background:rgba(0,0,0,0.3);
}
#play-btn-inner {
  width:72px; height:72px; border-radius:36px;
  background:rgba(124,58,237,0.85);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 0 30px rgba(124,58,237,0.6);
}
#play-btn-inner::after {
  content:''; border-style:solid;
  border-width:14px 0 14px 24px;
  border-color:transparent transparent transparent white;
  margin-left:6px;
}
</style>
</head>
<body>
<div id="stage">
  <div id="grid-bg"></div>
  <div id="story-title"></div>
  <div id="fade-overlay"></div>
  <div id="play-btn"><div id="play-btn-inner"></div></div>
</div>

<script>
(function() {
  var PLAYERS = ${playersJson};
  var STORY_NAME = ${storyNameJson};
  var SW = ${sw}, SH = ${sh};
  var GRID_INTRO_MS = 3500;
  var SPOTLIGHT_PAUSE_MS = 600;
  var FINALE_MS = 3000;

  var cells = [];
  var videoEls = [];
  var gridRects = [];
  var started = false;

  // ── Grid layout calculator ──────────────────────────────
  function calcGrid(n) {
    var cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 3;
    var rows = Math.ceil(n / cols);
    var pad = 16, gap = 10;
    var cw = (SW - pad*2 - gap*(cols-1)) / cols;
    var ch = cw * 1.25;
    var totalH = rows*ch + gap*(rows-1);
    var startY = (SH - totalH) / 2;
    var rects = [];
    for (var i=0; i<n; i++) {
      var r = Math.floor(i/cols), c = i%cols;
      var rowCount = (r === rows-1) ? (n - r*cols) : cols;
      var rowW = rowCount*cw + (rowCount-1)*gap;
      var startX = (SW - rowW)/2;
      rects.push({
        x: startX + c*( cw+gap),
        y: startY + r*(ch+gap),
        w: cw, h: ch
      });
    }
    return rects;
  }

  // ── Build cells ─────────────────────────────────────────
  function buildCells() {
    var stage = document.getElementById('stage');
    var n = PLAYERS.length;
    gridRects = calcGrid(n);

    PLAYERS.forEach(function(p, i) {
      var rect = gridRects[i];
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = 'cell-'+i;
      cell.style.cssText = 'left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.w+'px;height:'+rect.h+'px;';

      var vid = document.createElement('video');
      vid.src = p.clips[0] || '';
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      cell.appendChild(vid);

      var tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.textContent = p.name;
      cell.appendChild(tag);

      stage.insertBefore(cell, document.getElementById('story-title'));
      cells.push(cell);
      videoEls.push(vid);
    });
  }

  // ── Spotlight animation for one player ─────────────────
  function spotlightPlayer(idx, done) {
    var cell = cells[idx];
    var rect = gridRects[idx];
    var p = PLAYERS[idx];

    // Dim others
    cells.forEach(function(c,i){ if(i!==idx) c.classList.add('dimmed'); });
    cell.classList.add('active');

    // Calc full-screen transform
    var scaleX = SW / rect.w;
    var scaleY = SH / rect.h;
    var scale = Math.min(scaleX, scaleY) * 0.95;
    var cx = rect.x + rect.w/2;
    var cy = rect.y + rect.h/2;
    var tx = SW/2 - cx;
    var ty = SH/2 - cy;
    cell.style.transform = 'translate('+tx+'px,'+ty+'px) scale('+scale+')';
    cell.style.zIndex = '10';
    cell.style.borderColor = 'rgba(124,58,237,0.9)';

    // Play clips sequentially
    setTimeout(function() {
      var clipIdx = 0;
      var vid = videoEls[idx];

      function playNext() {
        if (clipIdx >= p.clips.length) {
          // Shrink back
          cell.style.transform = '';
          cell.style.zIndex = '';
          cells.forEach(function(c){ c.classList.remove('dimmed','active'); });
          setTimeout(done, SPOTLIGHT_PAUSE_MS);
          return;
        }
        vid.src = p.clips[clipIdx];
        vid.muted = false;
        vid.volume = 1;
        vid.play().catch(function(){});
        vid.onended = function() { clipIdx++; playNext(); };
        clipIdx++;
        // Override onended — set it fresh each clip
        vid.onended = null;
        vid.addEventListener('ended', function onEnd() {
          vid.removeEventListener('ended', onEnd);
          clipIdx++;
          playNext();
        });
      }
      clipIdx = 0;
      playNext();
    }, 580);
  }

  // ── Main playback sequence ──────────────────────────────
  function runSequence() {
    // Phase 1: grid intro
    setTimeout(function() {
      // Phase 2: spotlight each player
      var i = 0;
      function nextPlayer() {
        if (i >= PLAYERS.length) {
          // Phase 3: finale
          var titleEl = document.getElementById('story-title');
          titleEl.textContent = STORY_NAME;
          titleEl.style.opacity = '1';
          setTimeout(function() {
            var overlay = document.getElementById('fade-overlay');
            overlay.style.opacity = '1';
            setTimeout(function() {
              post({ type:'playbackComplete' });
            }, 900);
          }, FINALE_MS - 900);
          return;
        }
        spotlightPlayer(i, function() { i++; nextPlayer(); });
      }
      nextPlayer();
    }, GRID_INTRO_MS);
  }

  // ── Recording module ────────────────────────────────────
  var _rec = null;
  var _recChunks = [];
  var _recArmed = false;
  var _musicBlobUrl = null;

  window.armRecording = function(musicUrl) {
    _recArmed = true;
    if (musicUrl) {
      fetch(musicUrl).then(function(r){ return r.blob(); }).then(function(b){
        _musicBlobUrl = URL.createObjectURL(b);
      }).catch(function(){});
    }
  };

  function startRecording() {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = SW; canvas.height = SH;
      var ctx = canvas.getContext('2d');
      var stage = document.getElementById('stage');

      var stream = canvas.captureStream(30);
      var ac = new AudioContext();
      var dest = ac.createMediaStreamDestination();

      // Add music if available
      if (_musicBlobUrl) {
        var musicEl = new Audio(_musicBlobUrl);
        musicEl.loop = true;
        var src = ac.createMediaElementSource(musicEl);
        src.connect(dest);
        musicEl.play().catch(function(){});
      }

      stream.addTrack(dest.stream.getAudioTracks()[0]);

      _rec = new MediaRecorder(stream, { mimeType:'video/webm;codecs=vp8,opus' });
      _rec.ondataavailable = function(e) {
        if (e.data.size > 0) {
          var reader = new FileReader();
          reader.onload = function() {
            _recChunks.push(reader.result.split(',')[1]);
            post({ type:'recordingChunk', data:reader.result.split(',')[1], progress:0.5 });
          };
          reader.readAsDataURL(e.data);
        }
      };
      _rec.onstop = function() {
        post({ type:'recordingComplete', meta:{ mimeType:'video/webm', hasMusic:!!_musicBlobUrl } });
      };

      // Render loop
      function render() {
        if (!_rec || _rec.state === 'inactive') return;
        ctx.drawImage(stage, 0, 0, SW, SH);
        requestAnimationFrame(render);
      }
      _rec.start(1000);
      render();
    } catch(e) {
      post({ type:'recordingSupport', supported:false });
    }
  }

  // ── Init ────────────────────────────────────────────────
  function post(obj) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  window.updatePlayers = function(newPlayers) {
    PLAYERS = newPlayers;
  };

  window.startPlayback = function() {
    if (started) return;
    started = true;
    document.getElementById('play-btn').style.display = 'none';
    post({ type:'playbackStarted' });
    if (_recArmed) { startRecording(); post({ type:'recordingSupport', supported:true }); }
    runSequence();
  };

  document.getElementById('play-btn').addEventListener('click', window.startPlayback);

  buildCells();
  post({ type:'ready' });
})();
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0010' },
  fullscreen: { position: 'absolute', inset: 0 },
  webview: { flex: 1 },
});

export { SpotlightWebView };
