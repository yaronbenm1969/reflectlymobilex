import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { Video3DPlayer } from '../components/Video3DPlayer';
import CubeWebView from '../components/cube3d/CubeWebView';
import { AnimationPlayer } from '../components/animations';
import { VideoFactoryWaiting } from '../components/VideoFactoryWaiting';
import { useReflectionAssets } from '../hooks/useReflectionAssets';
import { storageService } from '../services/storageService';
import Constants from 'expo-constants';
import { storiesService } from '../services/storiesService';
import { backgroundsService } from '../services/backgroundsService';
import { analyticsService } from '../services/analyticsService';
import theme from '../theme/theme';

const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const MUSIC_BASE_URL = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library`;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VIDEO_CONVERTER_URL = process.env.EXPO_PUBLIC_API_URL || 'https://reflectlymobilex.onrender.com';
const SERVER_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  ...(process.env.EXPO_PUBLIC_ACCESS_CODE ? { 'x-app-access-code': process.env.EXPO_PUBLIC_ACCESS_CODE } : {}),
};

// Set false to revert to client-side canvas recording for cube-3d
const USE_SERVER_CUBE_RENDER = true;

const convertedUrlCache = new Map();

export const FinalVideoScreen = () => {
  const { t } = useTranslation();
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const privacySettings = useAppState((state) => state.privacySettings);
  const resetStory = useAppState((state) => state.resetStory);
  const finalVideoUri = useAppState((state) => state.finalVideoUri);
  const reflections = useAppState((state) => state.reflections);
  const videoFormat = useAppState((state) => state.videoFormat);
  const keyStoryUri = useAppState((state) => state.keyStoryUri);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const generatedMusicUrl = useAppState((state) => state.generatedMusicUrl);
  const setGeneratedMusicUrl = useAppState((state) => state.setGeneratedMusicUrl);
  const preferredMusicEngine = useAppState((state) => state.preferredMusicEngine);
  const lockedSet = useAppState((state) => state.lockedSet);
  const navigationParams = useAppState((state) => state.navigationParams);
  const fromProjects = navigationParams?.fromProjects || false;
  const backgroundVideoUrl = useAppState((state) => state.backgroundVideoUrl);
  const backgroundMediaType = useAppState((state) => state.backgroundMediaType);
  const setBackgroundVideoUrl = useAppState((state) => state.setBackgroundVideoUrl);
  const setBackgroundMediaType = useAppState((state) => state.setBackgroundMediaType);

  const [performanceMusicTrack, setPerformanceMusicTrack] = useState(null); // { url, offsets }
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [activeFaceIndex, setActiveFaceIndex] = useState(-1);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState('');
  const [videoHasPlayed, setVideoHasPlayed] = useState(false);
  const videoPlaybackEndedRef = useRef(false);
  const [isCubeFullscreen, setIsCubeFullscreen] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [animationPlayerKey, setAnimationPlayerKey] = useState(0);
  const [showRecordGuide, setShowRecordGuide] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [triggerAutoPlay, setTriggerAutoPlay] = useState(false);
  const [clientRecordingSupported, setClientRecordingSupported] = useState(false);
  const [recordNextPlayback, setRecordNextPlayback] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgPickerList, setBgPickerList] = useState([]);
  const [clientRecordingInProgress, setClientRecordingInProgress] = useState(false);
  const [cachedRecordingUri, setCachedRecordingUri] = useState(null);
  const [recordingFirebaseUrl, setRecordingFirebaseUrl] = useState(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [conversionSucceeded, setConversionSucceeded] = useState(false);
  const [videoReadyForShare, setVideoReadyForShare] = useState(false);
  const [renderStage, setRenderStage] = useState(null);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [musicTimedOut, setMusicTimedOut] = useState(false);
  const [musicServerDown, setMusicServerDown] = useState(false);
  const [musicRetryTrigger, setMusicRetryTrigger] = useState(0);
  const [isRemixingMusic, setIsRemixingMusic] = useState(false);
  const [musicHint, setMusicHint] = useState('');
  const [musicEngine, setMusicEngine] = useState('suno'); // 'suno' | 'musicgen'
  const [serverRenderJobId, setServerRenderJobId] = useState(null);
  const [serverRenderError, setServerRenderError] = useState(null);
  const [clipsExpireAt, setClipsExpireAt] = useState(null);
  const [clipsDeleted, setClipsDeleted] = useState(false);
  const [hdVideoUrl, setHdVideoUrl] = useState(null);
  const [hdRenderStatus, setHdRenderStatus] = useState('idle');
  const [showHdModal, setShowHdModal] = useState(false);
  const [isDownloadingHd, setIsDownloadingHd] = useState(false);
  const clientRecordingResolveRef = useRef(null);
  const autoRecordTriggeredRef = useRef(false);
  const videoReadyForShareRef = useRef(false); // mirrors videoReadyForShare — readable inside closures
  const initialCheckDoneRef = useRef(false); // prevents auto-record race: wait for Firestore check before allowing
  const isUploadingRef = useRef(false);
  const cachedRecordingRef = useRef(null);
  const firebaseUrlRef = useRef(null);
  const clientRecordingSupportedRef = useRef(false);
  const cubeRef = useRef(null);
  const ambientSoundRef = useRef(null);
  const ambientPhaseIndexRef = useRef(0);
  const aiMusicSoundRef = useRef(null);
  const generatedMusicUrlRef = useRef(generatedMusicUrl);
  // Ref (not state) so it's never stale inside the generatedMusicUrl effect closure.
  const pendingMusicStartRef = useRef(false);
  useEffect(() => {
    generatedMusicUrlRef.current = generatedMusicUrl;
    if (!generatedMusicUrl) return;
    if (pendingMusicStartRef.current) {
      // Animation already playing (including during auto-recording) — start music now.
      // Canvas captureStream() does NOT capture expo-av audio, so no double-music in recording.
      stopAmbientMusic().then(() => startAiMusic());
    } else if (!aiMusicSoundRef.current) {
      // Animation not started yet — preload so it plays instantly on onPlaybackStart
      preloadAiMusic();
    }
  }, [generatedMusicUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const musicTimedOutRef = useRef(false);
  useEffect(() => { musicTimedOutRef.current = musicTimedOut; }, [musicTimedOut]);
  const firestoreVideoUrlRef = useRef(null); // videoUrl/finalVideoUrl loaded from Firestore

  // Load generatedMusicUrl from Firestore — retries up to 5× in case PlayerRecordScreen
  // hasn't finished writing yet when this screen mounts.
  // If all retries fail (e.g. cube-3d skips ProcessingScreen), generate music here.
  // musicRetryTrigger is incremented when user presses retry — re-runs the effect.
  useEffect(() => {
    if (!currentStoryId || generatedMusicUrl) return;
    // Skip AI music generation if clips were recorded in performance mode (music already in audio)
    const hasPerformanceClips = reflections.some(r => r.hasMusicInRecording === true);
    if (hasPerformanceClips) {
      console.log('🎵 Skipping AI music — clips contain performance recordings with music already mixed in');
      return;
    }
    let cancelled = false;
    // On explicit retry (trigger > 0), skip Firestore poll and go straight to generation
    let attempts = musicRetryTrigger > 0 ? 5 : 0;
    const generateMusicInBackground = async () => {
      try {
        // Interleave by player so music order matches cube playback order
        const interleaved = (() => {
          const groups = {};
          reflections.forEach(r => {
            const key = r.playerName || r.participantName || 'default';
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
          });
          Object.values(groups).forEach(g => g.sort((a, b) => (a.clipNumber || 0) - (b.clipNumber || 0)));
          const players = Object.values(groups);
          const result = [];
          const maxLen = Math.max(...players.map(p => p.length));
          for (let i = 0; i < maxLen; i++) {
            players.forEach(group => { if (i < group.length) result.push(group[i]); });
          }
          return result;
        })();
        const reflectionUrls = interleaved.map(r => r.videoUrl).filter(Boolean);
        const urlsForMusic = reflectionUrls.length > 0 ? reflectionUrls : (keyStoryUri ? [keyStoryUri] : []);
        if (urlsForMusic.length === 0) return;
        console.log(`🎵 Generating AI music in FinalVideoScreen (${urlsForMusic.length} clips, server: ${VIDEO_CONVERTER_URL})...`);
        let transcriptionSegments = null;
        let totalDuration = 60;
        try {
          const transcribeRes = await fetch(`${VIDEO_CONVERTER_URL}/api/transcribe-from-urls`, {
            method: 'POST', headers: SERVER_HEADERS,
            body: JSON.stringify({ clipUrls: urlsForMusic }),
          });
          if (!transcribeRes.ok) { console.warn('Transcription HTTP error:', transcribeRes.status); }
          const transcribeJson = await transcribeRes.json();
          if (transcribeJson.success && transcribeJson.segments?.length > 0) {
            transcriptionSegments = transcribeJson.segments;
            totalDuration = transcribeJson.totalDuration || totalDuration;
          }
        } catch (e) { console.warn('Transcription failed:', e.message); }
        console.log('🎵 Calling /api/generate-music...');
        const genRes = await fetch(`${VIDEO_CONVERTER_URL}/api/generate-music`, {
          method: 'POST', headers: SERVER_HEADERS,
          body: JSON.stringify({ storyId: currentStoryId, totalDuration, numClips: urlsForMusic.length, ...(selectedMusic && { style: selectedMusic }), musicEngine: preferredMusicEngine || 'suno', ...(transcriptionSegments && { transcriptionSegments }), ...(lockedSet != null && { lockedSet }) }),
        });
        if (!genRes.ok) {
          const errText = await genRes.text().catch(() => genRes.status);
          console.warn('⚠️ /api/generate-music HTTP error:', genRes.status, String(errText).substring(0, 200));
          setMusicServerDown(true);
          return;
        }
        const genJson = await genRes.json();
        const musicJobId = genJson.jobId;
        if (!musicJobId) { console.warn('No music jobId, response:', JSON.stringify(genJson)); setMusicServerDown(true); return; }
        console.log('🎵 Music job started:', musicJobId);
        for (let i = 0; i < 100; i++) {
          if (cancelled) return;
          await new Promise(r => setTimeout(r, 3000));
          try {
            const statusRes = await fetch(`${VIDEO_CONVERTER_URL}/api/music-status/${musicJobId}`, { headers: SERVER_HEADERS });
            const statusJson = await statusRes.json();
            if (i % 10 === 0) console.log(`🎵 Music status [${i * 3}s]:`, statusJson.status);
            if (statusJson.status === 'completed' && statusJson.musicUrl) {
              setGeneratedMusicUrl(statusJson.musicUrl);
              generatedMusicUrlRef.current = statusJson.musicUrl;
              storiesService.updateStory(currentStoryId, { generatedMusicUrl: statusJson.musicUrl }).catch(() => {});
              console.log('✅ AI music generated in FinalVideoScreen:', statusJson.musicUrl.substring(0, 60));
              return;
            }
            if (statusJson.status === 'failed') { console.warn('⚠️ Music job failed:', statusJson.error); setMusicServerDown(true); return; }
          } catch (e) { console.warn('Music status poll error:', e.message); }
        }
        console.warn('⏱️ Music polling exhausted (100 × 3s)');
        setMusicServerDown(true);
      } catch (err) {
        console.warn('FinalVideoScreen music generation error:', err.message);
        setMusicServerDown(true);
      }
    };
    let bgLoaded = !!backgroundVideoUrl; // don't reload if already in Zustand
    const tryLoad = async () => {
      if (cancelled || generatedMusicUrlRef.current) return;
      try {
        const res = await storiesService.getStory(currentStoryId);
        if (res.success) {
          if (res.story?.generatedMusicUrl) {
            setGeneratedMusicUrl(res.story.generatedMusicUrl);
            console.log('🎵 Loaded generatedMusicUrl from Firestore:', res.story.generatedMusicUrl.substring(0, 60));
          }
          // Load background from Firestore only once
          if (!bgLoaded && res.story?.backgroundVideoUrl) {
            bgLoaded = true;
            setBackgroundVideoUrl(res.story.backgroundVideoUrl);
            setBackgroundMediaType(res.story.backgroundMediaType || 'video');
            console.log('🖼️ Loaded backgroundVideoUrl from Firestore');
          }
          // Load performance music track (karaoke mode — sync backing track with vocal recording)
          if (res.story?.performanceMusicTrack?.url) {
            setPerformanceMusicTrack(res.story.performanceMusicTrack);
          }
          // Load server-processed video URL so getVideoForSharing can use it
          // when finalVideoUri in Zustand is null (e.g. opened from EditRoom)
          if (!firestoreVideoUrlRef.current && res.story?.finalVideoUrl) {
            firestoreVideoUrlRef.current = res.story.finalVideoUrl;
            console.log('📹 Loaded finalVideoUrl from Firestore (tryLoad)');
          }
          if (res.story?.clipsExpireAt) setClipsExpireAt(res.story.clipsExpireAt.toDate ? res.story.clipsExpireAt.toDate() : new Date(res.story.clipsExpireAt));
          if (res.story?.clipsDeleted) setClipsDeleted(true);
          if (res.story?.hdVideoUrl) { setHdVideoUrl(res.story.hdVideoUrl); setHdRenderStatus('ready'); }
          else if (res.story?.hdRenderStatus) setHdRenderStatus(res.story.hdRenderStatus);
          if (res.story?.generatedMusicUrl) return;
        }
      } catch (e) {}
      if (attempts < 1) {
        attempts++;
        // One 2s retry — give Firestore a second chance (e.g. ProcessingScreen just saved it)
        setTimeout(tryLoad, 2000);
      } else if (!cancelled) {
        // Music not in Firestore after 2 polls (~4s).
        // Start Suno generation NOW (8s earlier than waiting for 5 failed polls).
        // The 30s UI timer still controls when AnimationPlayer unblocks — no blank-screen gap.
        // When Suno finishes it saves to Firestore → next view loads instantly.
        generateMusicInBackground();
      }
    };
    tryLoad();
    return () => { cancelled = true; };
  }, [currentStoryId, musicRetryTrigger]);

  // Check if server has marked video as ready (videoPublishReady: true — server-only field).
  // Also loads finalVideoUrl so getVideoForSharing can use it when opened from EditRoom.
  useEffect(() => {
    if (!currentStoryId) return;
    setVideoReadyForShare(false);
    firestoreVideoUrlRef.current = null;
    storiesService.getStory(currentStoryId).then(res => {
      if (res.success) {
        const url = res.story?.finalVideoUrl;
        if (url) firestoreVideoUrlRef.current = url;
        if (res.story?.videoPublishReady && url) {
          videoReadyForShareRef.current = true;
          autoRecordTriggeredRef.current = true; // story already complete — skip auto-record
          setVideoReadyForShare(true);
          // Do NOT show end screen here — let the video play first; onEnd will show it
          console.log('📹 videoPublishReady=true — WhatsApp button enabled, auto-record skipped');
        }
      }
      // Mark initial check done — now decide how to proceed
      initialCheckDoneRef.current = true;
      if (autoRecordTriggeredRef.current || videoReadyForShareRef.current) return; // already handled
      if (USE_SERVER_CUBE_RENDER && videoFormat === 'cube-3d') {
        // Route cube-3d through server-side Puppeteer renderer
        autoRecordTriggeredRef.current = true; // prevents client recording
        console.log('📹 Server cube render: starting...');
        startServerCubeRender();
      } else if (clientRecordingSupportedRef.current) {
        console.log('📹 Deferred auto-record: initial check done, triggering now');
        autoRecordTriggeredRef.current = true;
        setRecordNextPlayback(true);
        setTimeout(() => { setTriggerAutoPlay(true); setTimeout(() => setTriggerAutoPlay(false), 500); }, 300);
      }
    }).catch(() => { initialCheckDoneRef.current = true; });
  }, [currentStoryId]);

  // Poll every 15s for server to set videoPublishReady after processing.
  useEffect(() => {
    if (!currentStoryId) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, 15000));
        if (cancelled) break;
        try {
          const res = await storiesService.getStory(currentStoryId);
          if (res.success) {
            if (res.story?.renderStage) setRenderStage(res.story.renderStage);
            if (res.story?.videoPublishReady && res.story?.finalVideoUrl) {
              firestoreVideoUrlRef.current = res.story.finalVideoUrl;
              videoReadyForShareRef.current = true;
              setVideoReadyForShare(true);
              setRenderStage(null);
              // Show end screen only if animation already ended; otherwise onEnd will handle it
              if (videoPlaybackEndedRef.current) {
                setShowEndScreen(true);
              }
              break;
            }
          }
        } catch (e) {}
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [currentStoryId]);

  // Unblock AnimationPlayer after 2 min if Suno hasn't finished yet.
  useEffect(() => {
    if (generatedMusicUrl || musicTimedOut) return;
    const timer = setTimeout(() => {
      console.warn('⏱️ Music generation taking too long — unblocking animation');
      setMusicTimedOut(true);
      setMusicServerDown(true);
    }, 120000); // 2 min
    return () => clearTimeout(timer);
  }, [generatedMusicUrl, musicTimedOut]);

  // Download final video locally for smooth playback (avoids network buffering)
  useEffect(() => {
    const isAnim = videoFormat && videoFormat !== 'standard';
    if (!finalVideoUri || isAnim) return;
    // Already local (pre-cached by ProcessingScreen) — use directly
    if (finalVideoUri.startsWith('file://') || finalVideoUri.startsWith(FileSystem.cacheDirectory)) {
      setLocalVideoUri(finalVideoUri);
      return;
    }
    setIsLoadingVideo(true);
    const localPath = FileSystem.cacheDirectory + `final_video_${Date.now()}.mp4`;
    FileSystem.downloadAsync(finalVideoUri, localPath)
      .then(result => {
        if (result.status === 200) {
          setLocalVideoUri(result.uri);
        } else {
          setLocalVideoUri(finalVideoUri); // fallback to remote
        }
      })
      .catch(() => setLocalVideoUri(finalVideoUri)) // fallback to remote
      .finally(() => setIsLoadingVideo(false));
  }, [finalVideoUri]);

  const player = useVideoPlayer(localVideoUri ? { uri: localVideoUri } : null, p => {
    p.loop = false;
  });

  useEffect(() => {
    if (!player) return;
    const sub1 = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(prev => playing !== prev ? playing : prev);
    });
    return () => { sub1.remove(); };
  }, [player]);

  const isAmbientMusic = false; // files missing from Storage — Suno AI music replaces this

  const startAmbientMusic = async () => {
    if (!isAmbientMusic) return;
    // Suno sets (suno-set-N) are AI-generated per-story — no ambient phase files exist for them.
    // Fall back to a known ambient library track.
    const rawTrackId = selectedMusic || 'reflective-space';
    const trackId = rawTrackId.startsWith('suno-set-') ? 'reflective-space' : rawTrackId;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => {});

      const phaseNum = ambientPhaseIndexRef.current + 1;
      const url = `${MUSIC_BASE_URL}/${trackId}/phase${phaseNum > 3 ? 1 : phaseNum}.mp3`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.3, isLooping: false }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          ambientPhaseIndexRef.current = (ambientPhaseIndexRef.current + 1) % 3;
          sound.unloadAsync().then(() => {
            startAmbientMusic();
          });
        }
      });

      ambientSoundRef.current = sound;
    } catch (err) {
      console.error('Ambient music error:', err.message);
    }
  };

  const stopAmbientMusic = async () => {
    if (ambientSoundRef.current) {
      try {
        const status = await ambientSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const startVol = status.volume || 0.3;
          const steps = 10;
          for (let i = steps; i >= 0; i--) {
            if (!ambientSoundRef.current) break;
            await ambientSoundRef.current.setVolumeAsync((startVol * i) / steps);
            await new Promise(r => setTimeout(r, 100));
          }
        }
        await ambientSoundRef.current.stopAsync();
        await ambientSoundRef.current.unloadAsync();
      } catch (e) {}
      ambientSoundRef.current = null;
    }
    ambientPhaseIndexRef.current = 0;
  };

  // Preload music into memory (shouldPlay:false) so startAiMusic can begin instantly.
  // Called when generatedMusicUrl arrives before the animation starts.
  const preloadAiMusic = async () => {
    if (aiMusicSoundRef.current) return;
    const musicUrl = generatedMusicUrlRef.current;
    if (!musicUrl) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: musicUrl },
        { shouldPlay: false, volume: 0, isLooping: true }
      );
      aiMusicSoundRef.current = sound;
      console.log('🎵 AI music preloaded (ready to play instantly)');
    } catch (err) {
      console.warn('AI music preload failed:', err.message);
    }
  };

  const startAiMusic = async () => {
    const musicUrl = generatedMusicUrlRef.current;
    console.log('🎵 startAiMusic called, url:', musicUrl ? 'exists' : 'null');
    if (!musicUrl) return;
    try {
      let sound = aiMusicSoundRef.current;
      if (sound) {
        const status = await sound.getStatusAsync().catch(() => ({ isLoaded: false }));
        if (!status.isLoaded) {
          // Bad state — discard and reload
          await sound.unloadAsync().catch(() => {});
          aiMusicSoundRef.current = null;
          sound = null;
        } else if (status.isPlaying) {
          return; // already playing
        }
        // else: preloaded + paused — just play below
      }
      if (!sound) {
        const res = await Audio.Sound.createAsync(
          { uri: musicUrl },
          { shouldPlay: true, volume: 0, isLooping: true }
        );
        sound = res.sound;
        aiMusicSoundRef.current = sound;
      } else {
        await sound.playAsync();
      }
      console.log('🎵 AI music playing (fading in)...');
      for (let i = 1; i <= 12; i++) {
        if (!aiMusicSoundRef.current) break;
        try { await sound.setVolumeAsync(0.01 * i); } catch (e) { break; }
        await new Promise(r => setTimeout(r, 125));
      }
    } catch (err) {
      console.warn('AI music playback failed:', err.message);
    }
  };

  const stopAiMusic = async () => {
    if (!aiMusicSoundRef.current) return;
    try {
      await aiMusicSoundRef.current.stopAsync();
      await aiMusicSoundRef.current.unloadAsync();
    } catch (e) {}
    aiMusicSoundRef.current = null;
  };

  useEffect(() => {
    // allowsRecordingIOS: false is critical — PlayerRecordScreen may have left it true,
    // which routes audio to the earpiece (inaudible) instead of the speaker.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});

    return () => {
      if (ambientSoundRef.current) {
        ambientSoundRef.current.stopAsync().catch(() => {});
        ambientSoundRef.current.unloadAsync().catch(() => {});
        ambientSoundRef.current = null;
      }
      if (aiMusicSoundRef.current) {
        aiMusicSoundRef.current.stopAsync().catch(() => {});
        aiMusicSoundRef.current.unloadAsync().catch(() => {});
        aiMusicSoundRef.current = null;
      }
    };
  }, []);

  const needsConversion = (url) => {
    if (!url) return false;
    return url.includes('.webm') || url.includes('video%2Fwebm');
  };

  const convertVideoUrl = async (originalUrl) => {
    if (convertedUrlCache.has(originalUrl)) {
      console.log('📦 Using cached converted URL');
      return convertedUrlCache.get(originalUrl);
    }

    console.log('🔄 Converting video:', originalUrl.substring(0, 80) + '...');
    
    try {
      const response = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`Conversion failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.convertedUrl) {
        console.log('✅ Video converted successfully');
        convertedUrlCache.set(originalUrl, result.convertedUrl);
        return result.convertedUrl;
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('❌ Video conversion error:', error);
      return originalUrl;
    }
  };

  // Count unique participants by playerName/participantName
  const participantCount = useMemo(() => {
    const uniqueParticipants = new Set();
    reflections.forEach(r => {
      const name = r.playerName || r.participantName || r.recipientId || r.participantId;
      if (name) {
        uniqueParticipants.add(name);
      }
    });
    // If we have clips but no unique names, count by groups of 3 (each participant records 3 clips)
    if (uniqueParticipants.size === 0 && reflections.length > 0) {
      return Math.ceil(reflections.length / 3);
    }
    return uniqueParticipants.size || 1;
  }, [reflections]);

  const is3DFormat = videoFormat && videoFormat !== 'standard';
  const isCube3D = videoFormat === 'cube-3d';
  const isFlipPages = videoFormat === 'flip-pages';
  const isCarousel = videoFormat === 'carousel-3d';
  const isFilmStrip = videoFormat === 'film-strip';
  const isSpotlight = videoFormat === 'spotlight';
  const isCinematic = videoFormat === 'cinematic';
  const isAnimatedFormat = isCube3D || isFlipPages || isCarousel || isFilmStrip || isSpotlight;
  
  console.log('🎬 FinalVideoScreen format:', videoFormat, 'isAnimatedFormat:', isAnimatedFormat, 'isFlipPages:', isFlipPages);

  // Load all reflections (not limited to 6) for proper progress display
  const { 
    status: assetStatus, 
    progress: assetProgress, 
    preparedFaces, 
    isReady: assetsReady,
    reset: resetAssets,
    prepareAllAssets 
  } = useReflectionAssets(isAnimatedFormat ? reflections : [], reflections.length || 9);

  const cubeFaces = preparedFaces;

  const prepareVideosFor3D = () => {
    const videos = [];
    
    if (keyStoryUri && videoFormat !== 'cube-3d') {
      videos.push({
        url: keyStoryUri,
        videoUrl: keyStoryUri,
        playerName: t('finalVideo.my_story'),
        participantId: 'creator',
        thumbnail: null,
      });
    }
    
    reflections.forEach((reflection, index) => {
      if (reflection.videoUrl) {
        videos.push({
          url: reflection.videoUrl,
          videoUrl: reflection.videoUrl,
          playerName: reflection.playerName || reflection.participantName || t('finalVideo.participant_n', { n: index + 1 }),
          participantId: reflection.recipientId || reflection.participantId,
          clipNumber: reflection.clipNumber,
        });
      }
    });
    
    return videos;
  };


  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentPlayingFaceIndex, setCurrentPlayingFaceIndex] = useState(-1);
  const [currentVideoDuration, setCurrentVideoDuration] = useState(5000);
  const [cubeStarted, setCubeStarted] = useState(false);

  const [videoUrls, setVideoUrls] = useState([]);
  const [convertedUrls, setConvertedUrls] = useState([]);

  const handleFaceChange = (faceIndex) => {
    if (cubeStarted) {
      setCurrentPlayingFaceIndex(faceIndex);
    }
  };

  const handleVideoEnd = (faceId) => {
    console.log(`🎲 Video ended on face ${faceId}`);
  };

  const startCubePlayback = () => {
    if (!assetsReady) {
      console.log('⏳ Assets not ready yet, waiting...');
      return;
    }
    console.log(`▶️ Starting cube rotation with ${cubeFaces.filter(f => f).length} pre-loaded videos`);
    setCubeStarted(true);
    setPlaybackComplete(false);
  };

  const playNextVideo = () => {
    const nextIndex = currentVideoIndex + 1;
    setVideoHasPlayed(false); // Reset for next video
    if (nextIndex < videoUrls.length) {
      setCurrentVideoIndex(nextIndex);
      setActiveVideoUrl(videoUrls[nextIndex]);
      console.log(`⏭️ Playing video ${nextIndex + 1}/${videoUrls.length}`);
    } else {
      setShowVideoPlayer(false);
      setActiveVideoUrl(null);
      setIsPlaying(false);
      setCurrentVideoIndex(0);
      stopAmbientMusic();
      console.log(`✅ Cube playback complete`);
    }
  };

  const handlePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      if (ambientSoundRef.current) {
        try { ambientSoundRef.current.pauseAsync(); } catch (e) {}
      }
    } else {
      player.play();
      if (ambientSoundRef.current) {
        try { ambientSoundRef.current.playAsync(); } catch (e) {}
      } else {
        startAmbientMusic();
      }
    }
  };

  const handleShare = async () => {
    if (!videoReadyForShare) {
      Alert.alert(
        'הסרטון עדיין בעריכה 🎬',
        'הסרטון מוכן בקרוב — תקבל הודעה כשאפשר לשלוח.',
        [{ text: 'הבנתי' }]
      );
      return;
    }
    try {
      analyticsService.shareClicked(currentStoryId, 'link');
      analyticsService.inviteSent(currentStoryId);
      // Share watch link — shows full experience (background + music + animation)
      const domain = Constants.expoConfig?.extra?.webPlayerDomain ||
                     'reflectlymobilex.onrender.com';
      const watchUrl = `https://${domain}/s/${currentStoryId}`;
      await Share.share({
        message: `צפה בסיפור שלי: "${storyName}" 🎬\n${watchUrl}`,
        title: storyName,
        url: watchUrl,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_share_video'));
    }
  };

  const handleShareToWhatsApp = async () => {
    if (!videoReadyForShare) {
      Alert.alert(
        'הסרטון עדיין בהכנה 🎬',
        'הסרטון מוכן בקרוב — תקבל הודעה כשאפשר לשלוח.',
        [{ text: 'הבנתי' }]
      );
      return;
    }
    try {
      analyticsService.shareClicked(currentStoryId, 'whatsapp');
      const domain = Constants.expoConfig?.extra?.webPlayerDomain ||
                     'reflectlymobilex.onrender.com';
      const watchUrl = `https://${domain}/s/${currentStoryId}`;
      const text = t('finalVideo.whatsapp_share_text', { storyName }) + '\n' + watchUrl;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message: text, url: watchUrl });
      }
    } catch (error) {
      console.error('WhatsApp share error:', error);
    }
  };

  // VIDEO FILE SHARE (kept for easy restore — shares MP4 without background):
  // const handleShare = async () => {
  //   try {
  //     setIsDownloading(true);
  //     const videoUri = await getVideoForSharing(t('finalVideo.sharing_label'));
  //     if (videoUri && await Sharing.isAvailableAsync()) {
  //       setDownloadProgress(t('finalVideo.downloading'));
  //       const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
  //       const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'share');
  //       setIsDownloading(false);
  //       setDownloadProgress('');
  //       await Sharing.shareAsync(localUri, { mimeType: 'video/mp4', dialogTitle: `שתף את הסרטון: ${storyName}` });
  //     } else {
  //       await Share.share({ message: `צפה בסרטון שלי: "${storyName}" 🎬`, title: storyName });
  //     }
  //   } catch (error) {
  //     console.error('Error sharing:', error);
  //     Alert.alert(t('common.error'), t('finalVideo.error_share_video'));
  //   } finally {
  //     setIsDownloading(false);
  //     setDownloadProgress('');
  //   }
  // };

  const handleHdRender = async () => {
    if (!storyId) return;
    setHdRenderStatus('rendering');
    try {
      await fetch(`${VIDEO_CONVERTER_URL}/api/render-hd`, {
        method: 'POST',
        headers: { ...SERVER_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });
      // Firestore listener will update hdRenderStatus + hdVideoUrl when done
    } catch (e) {
      setHdRenderStatus('error');
    }
  };

  const handleHdDownload = async () => {
    if (!hdVideoUrl) return;
    setIsDownloadingHd(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'יש לאפשר גישה לגלריה כדי לשמור את הסרטון');
        setIsDownloadingHd(false);
        return;
      }
      const localUri = FileSystem.cacheDirectory + `hd_${storyId}_${Date.now()}.mp4`;
      const { uri } = await FileSystem.downloadAsync(hdVideoUrl, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      setShowHdModal(false);
      Alert.alert('✅ הסרטון נשמר', 'גרסת HD נשמרה לגלריה בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו להוריד את הסרטון, נסה שנית');
    } finally {
      setIsDownloadingHd(false);
    }
  };

  const handleDownload = async () => {
    if (!finalVideoUri) {
      Alert.alert(t('common.error'), t('finalVideo.error_no_video_download'));
      return;
    }
    
    try {
      setIsDownloading(true);
      
      const filename = `${storyName.replace(/[^a-zA-Zא-ת0-9]/g, '_')}_${Date.now()}.mp4`;
      const localUri = FileSystem.documentDirectory + filename;
      
      const downloadResult = await FileSystem.downloadAsync(finalVideoUri, localUri);
      
      if (downloadResult.status === 200) {
        Alert.alert(
          t('finalVideo.download_success_title'),
          t('finalVideo.download_success_text'),
          [{ text: t('finalVideo.download_success_ok') }]
        );
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_no_download'));
    } finally {
      setIsDownloading(false);
    }
  };

  const [downloadProgress, setDownloadProgress] = useState('');

  const handleRecord3DVideo = () => {
    setShowEndScreen(false);
    setShowRecordGuide(true);
  };

  const startRecordingCountdown = () => {
    setShowRecordGuide(false);
    setRecordCountdown(5);
    setIsRecordingMode(true);
    setTriggerAutoPlay(false);

    let count = 5;
    const interval = setInterval(() => {
      count--;
      setRecordCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setRecordCountdown(0);
        setTriggerAutoPlay(true);
        setTimeout(() => setTriggerAutoPlay(false), 500);
      }
    }, 1000);
  };

  const activeRenderRef = useRef(null);
  
  const renderConcatenatedVideo = async (progressLabel = 'מחבר סרטונים') => {
    if (activeRenderRef.current) {
      console.log('📥 Render already in progress, waiting for existing job');
      return activeRenderRef.current;
    }
    
    const renderPromise = (async () => {
    const allVideos = cubeFaces.map(f => f?.videoUrl).filter(Boolean);
    if (allVideos.length === 0) {
      return finalVideoUri;
    }
    if (allVideos.length === 1 && !isAnimatedFormat) {
      return allVideos[0];
    }
    
    setDownloadProgress(`${progressLabel}...`);
    const storyId = `render_${Date.now()}`;
    
    const useFormatRender = isAnimatedFormat && (isCube3D || isFlipPages);
    const endpoint = useFormatRender 
      ? `${VIDEO_CONVERTER_URL}/api/stories/${storyId}/render-format`
      : `${VIDEO_CONVERTER_URL}/api/stories/${storyId}/render`;
    
    console.log(`📥 Sending ${useFormatRender ? 'FORMAT' : 'standard'} render: ${allVideos.length} videos, format: ${videoFormat}`);
    const renderRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrls: allVideos,
        format: videoFormat || 'standard',
        storyName: storyName || '',
        backgroundVideoUrl: backgroundVideoUrl || null,
        backgroundMediaType: backgroundMediaType || 'video',
      }),
    });

    const renderText = await renderRes.text();
    console.log(`📥 Render response (${renderRes.status}):`, renderText);
    let renderData;
    try { renderData = JSON.parse(renderText); } catch (e) {
      throw new Error(`Server returned invalid response: ${renderText.substring(0, 200)}`);
    }
    if (!renderData.success || !renderData.jobId) {
      throw new Error(renderData.error || renderData.message || 'Failed to start rendering');
    }

    const maxPolls = useFormatRender ? 450 : 120;
    let consecutiveErrors = 0;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 15000);
        const statusRes = await fetch(`${VIDEO_CONVERTER_URL}/api/render-status/${renderData.jobId}`, {
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);
        const statusText = await statusRes.text();
        let statusData;
        try { statusData = JSON.parse(statusText); } catch (parseErr) {
          console.warn(`Status poll ${i}: non-JSON response (${statusRes.status}):`, statusText.substring(0, 100));
          consecutiveErrors++;
          if (consecutiveErrors > 30) throw new Error('Server not responding properly');
          continue;
        }
        consecutiveErrors = 0;
        if (statusData.status === 'completed' && statusData.finalUrl) {
          return statusData.finalUrl;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Rendering failed');
        }
        const progressMsg = statusData.progressMessage || '';
        setDownloadProgress(`${statusData.progress || 0}% ${progressMsg}`);
      } catch (fetchErr) {
        if (fetchErr.message === 'Server not responding properly' || fetchErr.message?.includes('Rendering failed')) throw fetchErr;
        console.warn(`Status poll ${i} error:`, fetchErr.message);
        consecutiveErrors++;
        if (consecutiveErrors > 30) throw new Error('Server connection lost');
      }
    }
    throw new Error('Rendering timed out');
    })();
    
    activeRenderRef.current = renderPromise;
    try {
      const result = await renderPromise;
      return result;
    } finally {
      activeRenderRef.current = null;
    }
  };

  const performClientRecording = () => {
    return new Promise((resolve) => {
      clientRecordingResolveRef.current = resolve;
      setClientRecordingInProgress(true);
      setDownloadProgress(t('finalVideo.recording_animation'));
      setShowEndScreen(false);
      setRecordNextPlayback(true);
      
      const recordingTimeout = setTimeout(() => {
        console.log('📹 Recording timeout - resolving with null');
        if (clientRecordingResolveRef.current) {
          clientRecordingResolveRef.current(null);
          clientRecordingResolveRef.current = null;
        }
        setRecordNextPlayback(false);
        setClientRecordingInProgress(false);
      }, 5 * 60 * 1000);
      
      const origResolve = resolve;
      clientRecordingResolveRef.current = (fileUri) => {
        clearTimeout(recordingTimeout);
        origResolve(fileUri);
      };
      
      setTimeout(() => {
        setTriggerAutoPlay(true);
        setTimeout(() => setTriggerAutoPlay(false), 500);
      }, 300);
    });
  };

  // ── Server-side cube rendering ────────────────────────────────────────────
  const startServerCubeRender = async () => {
    setServerRenderError(null);
    setDownloadProgress(t('finalVideo.server_rendering'));
    // Keep animation visible while server renders — end screen shows only when render completes
    // Auto-play animation so user watches while server renders (~3-6 min)
    setTimeout(() => { setTriggerAutoPlay(true); setTimeout(() => setTriggerAutoPlay(false), 500); }, 300);
    try {
      const res = await fetch(`${VIDEO_CONVERTER_URL}/api/poc/render-cube`, {
        method: 'POST',
        headers: SERVER_HEADERS,
        body: JSON.stringify({ storyId: currentStoryId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setServerRenderJobId(data.jobId);
      setDownloadProgress('');
      console.log('[ServerRender] Job started:', data.jobId);
    } catch (err) {
      console.error('[ServerRender] Failed to start:', err.message);
      setServerRenderError(err.message);
      setDownloadProgress('');
    }
  };

  const handleServerRenderFallback = () => {
    // User chose to fall back to client recording
    setServerRenderError(null);
    autoRecordTriggeredRef.current = false;
    setShowEndScreen(false);
    if (clientRecordingSupportedRef.current) {
      autoRecordTriggeredRef.current = true;
      setRecordNextPlayback(true);
      setTimeout(() => { setTriggerAutoPlay(true); setTimeout(() => setTriggerAutoPlay(false), 500); }, 300);
    }
  };

  const handleRecordingSupport = (supported) => {
    console.log('📹 Client recording supported:', supported, 'format:', videoFormat);
    setClientRecordingSupported(supported);
    clientRecordingSupportedRef.current = supported;
    // Auto-record on first view: enables recording BEFORE play starts so music gets
    // mixed into the video server-side. End screen only shows after mixing is done.
    if (supported && !autoRecordTriggeredRef.current && !showEndScreen && !videoReadyForShareRef.current) {
      if (!initialCheckDoneRef.current) {
        // Firestore initial check not yet complete — defer auto-record until check returns
        console.log('📹 Auto-record deferred: waiting for initial Firestore check...');
        return;
      }
      // Server-side render handles cube-3d — never start client recording for this format
      if (USE_SERVER_CUBE_RENDER && videoFormat === 'cube-3d') return;
      autoRecordTriggeredRef.current = true;
      setRecordNextPlayback(true);
      // 300ms delay ensures _recEnabled=true JS arrives in WebView before handlePlayClick()
      setTimeout(() => {
        setTriggerAutoPlay(true);
        setTimeout(() => setTriggerAutoPlay(false), 500);
      }, 300);
    }
  };

  const handleRecordingComplete = async (fileUri, meta = {}) => {
    console.log('📹 Recording complete:', fileUri, 'hasMusic:', meta.hasMusic);
    setRecordNextPlayback(false);
    // NOTE: do NOT clear clientRecordingInProgress here yet.
    // It must stay true until isUploadingRecording is set to true, to prevent
    // the overlay from briefly disappearing (both flags false) between the two state updates.
    setDownloadProgress('');

    let validRecording = false;
    if (!fileUri) {
      // recordingFailed was called (e.g. canvas taint, captureStream not working)
      console.warn('📹 Recording returned null — disabling client recording');
      setClientRecordingInProgress(false);
      setClientRecordingSupported(false);
      clientRecordingSupportedRef.current = false;
    } else {
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        const MIN_VALID_SIZE = 50000;
        console.log(`📹 Recording file size: ${info.size} bytes (min: ${MIN_VALID_SIZE})`);
        if (info.exists && info.size >= MIN_VALID_SIZE) {
          validRecording = true;
          setCachedRecordingUri(fileUri);
          cachedRecordingRef.current = fileUri;
          // Clear clientRecordingInProgress BEFORE calling convertAndUploadRecording,
          // so both this and setIsUploadingRecording(true) are batched in the same render.
          setClientRecordingInProgress(false);
          convertAndUploadRecording(fileUri, meta);
        } else {
          console.warn('📹 Recording too small - iOS captureStream likely not supported. Will use server render.');
          setClientRecordingInProgress(false);
          setCachedRecordingUri(null);
          cachedRecordingRef.current = null;
          setClientRecordingSupported(false);
          clientRecordingSupportedRef.current = false;
        }
      } catch (e) {
        console.warn('📹 Cannot check recording file:', e.message);
        setClientRecordingInProgress(false);
      }
    }
    
    const hadManualResolve = !!clientRecordingResolveRef.current;
    if (clientRecordingResolveRef.current) {
      clientRecordingResolveRef.current(validRecording ? fileUri : null);
      clientRecordingResolveRef.current = null;
    }

    if (!hadManualResolve) {
      if (validRecording && isAnimatedFormat) {
        // For animated formats: wait for upload+mix to finish before showing end screen.
        // convertAndUploadRecording will call setShowEndScreen(true) when the final mixed URL is ready.
        // Do nothing here — the upload overlay (isUploadingRecording) keeps the user informed.
      } else {
        setShowEndScreen(true);
      }
    }
  };

  const convertAndUploadRecording = async (fileUri, meta = {}) => {
    if (!currentStoryId || !fileUri) return;
    const recordingHasMusic = meta.hasMusic === true;
    const isAlreadyMp4 = fileUri.toLowerCase().includes('.mp4');
    
    try {
      setIsUploadingRecording(true);
      isUploadingRef.current = true;
      startAmbientMusic();
      // Reset videoPublishReady so WhatsApp button stays grey until new mix is done.
      // Old sessions may have videoPublishReady:true pointing to a stale/wrong finalVideoUrl.
      setVideoReadyForShare(false);
      storiesService.updateStory(currentStoryId, { videoPublishReady: false }).catch(() => {});

      if (isAlreadyMp4) {
        console.log('📹 Recording is already MP4 (iOS) - uploading directly...');
        setDownloadProgress(t('finalVideo.uploading_video'));
        const uploadResult = await storageService.uploadVideo(
          fileUri,
          currentStoryId,
          'animated_export',
          (progress) => {
            console.log(`📹 Upload progress: ${progress.toFixed(0)}%`);
            setDownloadProgress(`${t('finalVideo.uploading_video')} ${progress.toFixed(0)}%`);
          }
        );

        if (uploadResult.success && uploadResult.url) {
          console.log('📹 MP4 uploaded to Firebase:', uploadResult.url.substring(0, 60));
          let finalMp4Url = uploadResult.url;

          // Show end screen immediately after upload — mixing continues in background.
          // WhatsApp button stays grey until videoPublishReady is set by server (polling picks it up).
          setRecordingFirebaseUrl(finalMp4Url);
          firebaseUrlRef.current = finalMp4Url;
          setConversionSucceeded(true);
          if (currentStoryId) {
            storiesService.updateStory(currentStoryId, { sourceVideoUrl: uploadResult.url }).catch(() => {});
            analyticsService.finalMovieReady(currentStoryId);
          }
          cachedRecordingRef.current = null;
          setCachedRecordingUri(null);
          setShowEndScreen(true);

          // Background: wait for music → mix → server saves videoPublishReady → polling enables WhatsApp
          // Wait for AI music generation if still in progress (up to 3 min)
          if (!generatedMusicUrlRef.current) {
            console.log('🎵 Waiting for AI music generation before mixing...');
            const deadline = Date.now() + 3 * 60 * 1000;
            while (!generatedMusicUrlRef.current && Date.now() < deadline) {
              await new Promise(r => setTimeout(r, 5000));
              if (!generatedMusicUrlRef.current && currentStoryId) {
                try {
                  const res = await storiesService.getStory(currentStoryId);
                  if (res.success && res.story?.generatedMusicUrl) {
                    generatedMusicUrlRef.current = res.story.generatedMusicUrl;
                    setGeneratedMusicUrl(res.story.generatedMusicUrl);
                    console.log('🎵 Music URL found in Firestore');
                  }
                } catch (e) {}
              }
            }
            if (generatedMusicUrlRef.current) console.log('🎵 Music ready, proceeding to mix');
            else console.log('⚠️ Music not ready after 3min, mixing without');
          }

          // Mix AI music into the recording using the recording's own audio track ([0:a]).
          // Do NOT pass clipUrls/replaceAudio — that discards the in-sync recording audio
          // and rebuilds from clip files which causes lip-sync drift.
          const musicUrl = generatedMusicUrlRef.current;
          if (musicUrl) {
            console.log('🎵 Mixing AI music into recording (using recording audio for sync)...');
            try {
              const mixCtrl = new AbortController();
              const mixTimeout = setTimeout(() => mixCtrl.abort(), 4 * 60 * 1000);
              const mixRes = await fetch(`${VIDEO_CONVERTER_URL}/api/mix-music-with-video`, {
                method: 'POST',
                headers: SERVER_HEADERS,
                body: JSON.stringify({ videoUrl: finalMp4Url, musicUrl, musicVolume: 0.06, backgroundVideoUrl: backgroundVideoUrl || null, storyId: currentStoryId }),
                signal: mixCtrl.signal,
              });
              clearTimeout(mixTimeout);
              if (mixRes.ok) {
                const mixResult = await mixRes.json();
                const mixedUrl = mixResult.finalUrl || mixResult.videoUrl;
                if (mixedUrl) {
                  finalMp4Url = mixedUrl;
                  firebaseUrlRef.current = mixedUrl; // update to mixed URL for Instagram sharing
                  console.log('✅ AI music mixed into recording');
                }
              }
            } catch (mixErr) {
              console.warn('⚠️ Music mixing failed, using unmixed mp4:', mixErr.message);
            }
          } else {
            // No AI music — performance mode: re-encode + mix backing track at recorded offset.
            console.log('🎤 Performance mode — re-encoding + syncing backing track...');
            try {
              const reCtrl = new AbortController();
              const reTimeout = setTimeout(() => reCtrl.abort(), 4 * 60 * 1000);
              const perfTrackUrl = performanceMusicTrack?.url || null;
              const perfOffsetMs = performanceMusicTrack?.offsets?.[0] ?? 0;
              const reRes = await fetch(`${VIDEO_CONVERTER_URL}/api/reencode-for-whatsapp`, {
                method: 'POST',
                headers: SERVER_HEADERS,
                body: JSON.stringify({
                  videoUrl: finalMp4Url,
                  storyId: currentStoryId,
                  backgroundVideoUrl: backgroundVideoUrl || null,
                  ...(perfTrackUrl ? { performanceMusicTrackUrl: perfTrackUrl, performanceMusicOffsetMs: perfOffsetMs } : {}),
                }),
                signal: reCtrl.signal,
              });
              clearTimeout(reTimeout);
              if (reRes.ok) {
                const reResult = await reRes.json();
                const recodedUrl = reResult.finalUrl || reResult.videoUrl;
                if (recodedUrl) {
                  finalMp4Url = recodedUrl;
                  firebaseUrlRef.current = recodedUrl;
                  console.log('✅ Re-encoded for WhatsApp (CFR h264 baseline + background)');
                }
              }
            } catch (reErr) {
              console.warn('⚠️ Re-encode failed, using raw mp4 (may fail in WhatsApp):', reErr.message);
            }
          }

          // Download the final mixed mp4 to local cache for faster sharing.
          try {
            const mp4LocalPath = FileSystem.cacheDirectory + `recording_mp4_${Date.now()}.mp4`;
            const dlResult = await FileSystem.downloadAsync(finalMp4Url, mp4LocalPath);
            if (dlResult.status === 200) {
              console.log('📹 Final mp4 cached locally (iOS path):', mp4LocalPath);
              setCachedRecordingUri(mp4LocalPath);
              cachedRecordingRef.current = mp4LocalPath;
            }
          } catch (dlErr) {
            console.warn('📹 Local cache failed (iOS path):', dlErr.message);
          }
        } else {
          console.warn('📹 Firebase upload failed:', uploadResult.error);
          setShowEndScreen(true); // unblock even on failure
        }
        return;
      }

      console.log('📹 Step 1: Uploading webm to Firebase...');
      const uploadResult = await storageService.uploadVideo(
        fileUri,
        currentStoryId,
        'animated_export_raw',
        (progress) => console.log(`📹 Upload progress: ${progress.toFixed(0)}%`)
      );
      
      if (!uploadResult.success || !uploadResult.url) {
        console.warn('📹 Firebase upload failed:', uploadResult.error);
        return;
      }
      
      const webmUrl = uploadResult.url;
      console.log('📹 Step 2: Converting webm→mp4 via server (async)...', webmUrl.substring(0, 60));

      try {
        // Send async request to avoid Cloudflare tunnel timeout on large files
        const convertResponse = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
          method: 'POST',
          headers: SERVER_HEADERS,
          body: JSON.stringify({ url: webmUrl, async: true }),
        });

        if (convertResponse.ok) {
          const convertQueued = await convertResponse.json();
          const jobId = convertQueued.jobId;
          console.log('📹 Conversion queued, jobId:', jobId);

          // Poll until done (max 8 min)
          let convertedUrl = null;
          const maxAttempts = 160;
          let lastSeenProgress = -1;
          let stuckCount = 0;
          const STUCK_LIMIT = 20; // 20 × 3s = 60s with no progress → give up
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              const statusRes = await fetch(`${VIDEO_CONVERTER_URL}/api/queue/job/${jobId}`);
              if (statusRes.ok) {
                const statusJson = await statusRes.json();
                const curProgress = statusJson.progress || 0;
                console.log(`📹 Conversion status [${i+1}]:`, statusJson.status, curProgress);
                if (statusJson.status === 'completed' && statusJson.result?.convertedUrl) {
                  convertedUrl = statusJson.result.convertedUrl;
                  break;
                } else if (statusJson.status === 'failed') {
                  console.warn('📹 Conversion job failed:', statusJson.error);
                  break;
                } else if (statusJson.status === 'not_found') {
                  // Server restarted — job is gone, fall back to webm
                  console.warn('📹 Conversion job not found (server restarted?)');
                  break;
                }
                // Detect stuck progress — if same value for 60s, give up
                if (curProgress === lastSeenProgress) {
                  stuckCount++;
                  if (stuckCount >= STUCK_LIMIT) {
                    console.warn(`📹 Conversion stuck at ${curProgress}% for ${STUCK_LIMIT * 3}s — falling back to webm`);
                    break;
                  }
                } else {
                  stuckCount = 0;
                  lastSeenProgress = curProgress;
                }
              }
            } catch (pollErr) {
              console.warn('📹 Poll error:', pollErr.message);
            }
          }

          if (convertedUrl) {
            console.log('📹 Converted mp4 ready:', convertedUrl.substring(0, 60));
            // Save unmixed video so /api/remix-music can re-mix with different music later
            if (currentStoryId) {
              storiesService.updateStory(currentStoryId, { sourceVideoUrl: convertedUrl }).catch(() => {});
            }
            let finalMp4Url = convertedUrl;

            // Wait for AI music generation if still in progress (up to 3 min)
            // UI timeout (30s) fires to unblock AnimationPlayer — but mix should still wait longer.
            if (!generatedMusicUrlRef.current) {
              console.log('🎵 Waiting for AI music generation before mixing...');
              setDownloadProgress(t('finalVideo.waiting_for_music'));
              const deadline = Date.now() + 3 * 60 * 1000;
              while (!generatedMusicUrlRef.current && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 5000));
                if (!generatedMusicUrlRef.current && currentStoryId) {
                  try {
                    const res = await storiesService.getStory(currentStoryId);
                    if (res.success && res.story?.generatedMusicUrl) {
                      generatedMusicUrlRef.current = res.story.generatedMusicUrl;
                      setGeneratedMusicUrl(res.story.generatedMusicUrl);
                      console.log('🎵 Music URL found in Firestore');
                    }
                  } catch (e) {}
                }
              }
              if (generatedMusicUrlRef.current) console.log('🎵 Music ready, proceeding to mix');
              else console.log('⚠️ Music not ready after 3min, mixing without');
            }

            // Mix AI music using the recording's own audio ([0:a]) — NOT clip files.
            // clipUrls/replaceAudio would discard the in-sync recording audio → lip-sync drift.
            const musicUrl = generatedMusicUrlRef.current;
            console.log('🎬 mix-music: backgroundVideoUrl=', backgroundVideoUrl ? backgroundVideoUrl.substring(0, 60) : 'null');
            if (musicUrl) {
              console.log('🎵 Mixing AI music into cube recording (using recording audio for sync)...');
              setDownloadProgress(t('finalVideo.factory_mixing'));
              try {
                const mixCtrl = new AbortController();
                const mixTimeout = setTimeout(() => mixCtrl.abort(), 4 * 60 * 1000);
                const mixRes = await fetch(`${VIDEO_CONVERTER_URL}/api/mix-music-with-video`, {
                  method: 'POST',
                  headers: SERVER_HEADERS,
                  body: JSON.stringify({ videoUrl: finalMp4Url, musicUrl, musicVolume: 0.06, backgroundVideoUrl: backgroundVideoUrl || null, storyId: currentStoryId }),
                  signal: mixCtrl.signal,
                });
                clearTimeout(mixTimeout);
                if (mixRes.ok) {
                  const mixResult = await mixRes.json();
                  const mixedUrl = mixResult.finalUrl || mixResult.videoUrl;
                  if (mixedUrl) {
                    finalMp4Url = mixedUrl;
                    console.log('✅ AI music mixed into cube recording');
                  }
                }
              } catch (mixErr) {
                console.warn('⚠️ Music mixing failed, using unmixed mp4:', mixErr.message);
              }
            } else if (backgroundVideoUrl || performanceMusicTrack?.url) {
              // No Suno music — composite background and/or mix performance backing track
              console.log('🎨 No Suno — compositing background / performance track...');
              setDownloadProgress(t('finalVideo.factory_mixing'));
              try {
                const reCtrl = new AbortController();
                const reTimeout = setTimeout(() => reCtrl.abort(), 4 * 60 * 1000);
                const perfTrackUrl2 = performanceMusicTrack?.url || null;
                const perfOffsetMs2 = performanceMusicTrack?.offsets?.[0] ?? 0;
                const reRes = await fetch(`${VIDEO_CONVERTER_URL}/api/reencode-for-whatsapp`, {
                  method: 'POST',
                  headers: SERVER_HEADERS,
                  body: JSON.stringify({
                    videoUrl: finalMp4Url,
                    storyId: currentStoryId,
                    backgroundVideoUrl: backgroundVideoUrl || null,
                    ...(perfTrackUrl2 ? { performanceMusicTrackUrl: perfTrackUrl2, performanceMusicOffsetMs: perfOffsetMs2 } : {}),
                  }),
                  signal: reCtrl.signal,
                });
                clearTimeout(reTimeout);
                if (reRes.ok) {
                  const reResult = await reRes.json();
                  const recodedUrl = reResult.finalUrl || reResult.videoUrl;
                  if (recodedUrl) {
                    finalMp4Url = recodedUrl;
                    console.log('✅ Background composited (no-music cube path)');
                  }
                }
              } catch (reErr) {
                console.warn('⚠️ Background compositing failed (no-music cube path):', reErr.message);
              }
            }

            setRecordingFirebaseUrl(finalMp4Url);
            firebaseUrlRef.current = finalMp4Url;
            setConversionSucceeded(true);
            if (currentStoryId) {
              // finalVideoUrl is set only by the server (mixed version with music + player clips)
            // storiesService.updateStory(currentStoryId, { finalVideoUrl: finalMp4Url, status: 'completed' }).catch(() => {});
            }
            setShowEndScreen(true);

            const mp4LocalPath = FileSystem.cacheDirectory + `recording_mp4_${Date.now()}.mp4`;
            try {
              const dlResult = await FileSystem.downloadAsync(finalMp4Url, mp4LocalPath);
              if (dlResult.status === 200) {
                console.log('📹 Mp4 cached locally:', mp4LocalPath);
                setCachedRecordingUri(mp4LocalPath);
                cachedRecordingRef.current = mp4LocalPath;
              }
            } catch (dlErr) {
              console.warn('📹 Mp4 local cache failed, will use URL:', dlErr.message);
            }
            return;
          }
        }
        console.warn('📹 Server conversion failed, using webm as fallback');
      } catch (convertErr) {
        console.warn('📹 Conversion request failed:', convertErr.message);
      }
      
      setRecordingFirebaseUrl(webmUrl);
      firebaseUrlRef.current = webmUrl;
      if (currentStoryId) {
        // Save as sourceVideoUrl only — finalVideoUrl is server-only to prevent sharing unprocessed webm
        storiesService.updateStory(currentStoryId, { sourceVideoUrl: webmUrl }).catch(() => {});
      }
      setShowEndScreen(true); // fallback: server conversion failed, show end screen with webm
    } catch (err) {
      console.warn('📹 Upload/convert error:', err.message);
      setShowEndScreen(true); // unblock on error
    } finally {
      setIsUploadingRecording(false);
      isUploadingRef.current = false;
      stopAmbientMusic();
    }
  };

  const handleRecordingProgress = useCallback((progress) => {
    if (progress.phase === 'saving') {
      setDownloadProgress(t('finalVideo.saving_recording'));
    }
  }, []);

  const getVideoForSharing = async (label = 'מכין סרטון') => {
    if (isUploadingRef.current) {
      console.log('📹 Conversion in progress, waiting...');
      setDownloadProgress(t('finalVideo.converting_video'));
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isUploadingRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
        setTimeout(() => { clearInterval(checkInterval); resolve(); }, 5 * 60 * 1000); // wait up to 5 min for conversion
      });
      setDownloadProgress('');
    }
    
    const cached = cachedRecordingRef.current;
    const fbUrl = firebaseUrlRef.current;
    const isMp4 = (uri) => uri && !uri.toLowerCase().includes('.webm');
    const MIN_VALID_SIZE = 50000;
    
    const isValidLocal = async (uri) => {
      if (!uri) return false;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        const valid = info.exists && info.size >= MIN_VALID_SIZE;
        if (!valid) console.log(`📹 File invalid: ${uri.slice(-30)} size=${info.size || 0}`);
        return valid;
      } catch { return false; }
    };
    
    if (isMp4(cached) && await isValidLocal(cached)) {
      console.log('📹 Using cached mp4 recording');
      return cached;
    }
    if (fbUrl && isMp4(fbUrl)) {
      console.log('📹 Using Firebase converted URL, downloading...');
      try {
        const localPath = await downloadVideoToLocal(fbUrl, 'share_mp4', 120000);
        if (await isValidLocal(localPath)) {
          console.log('📹 Firebase mp4 downloaded and valid');
          return localPath;
        }
      } catch (e) {
        console.warn('📹 Firebase download failed:', e.message);
      }
    } else if (fbUrl && !isMp4(fbUrl)) {
      // fbUrl is webm — server conversion previously failed. Try converting now (2-min timeout).
      console.warn('📹 fbUrl is webm — attempting on-demand conversion for sharing...');
      try {
        const convCtrl = new AbortController();
        const convTimer = setTimeout(() => convCtrl.abort(), 2 * 60 * 1000);
        const convertRes = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
          method: 'POST',
          headers: SERVER_HEADERS,
          body: JSON.stringify({ url: fbUrl }),
          signal: convCtrl.signal,
        });
        clearTimeout(convTimer);
        if (convertRes.ok) {
          const convertData = await convertRes.json();
          const mp4Url = convertData.url || convertData.convertedUrl;
          if (mp4Url && isMp4(mp4Url)) {
            firebaseUrlRef.current = mp4Url;
            setRecordingFirebaseUrl(mp4Url);
            const localPath = await downloadVideoToLocal(mp4Url, 'share_converted');
            if (await isValidLocal(localPath)) {
              console.log('📹 On-demand conversion succeeded for sharing');
              return localPath;
            }
          }
        }
      } catch (convErr) {
        console.warn('📹 On-demand conversion failed:', convErr.message);
      }
    }
    if (localVideoUri && await isValidLocal(localVideoUri)) {
      console.log('📹 Using localVideoUri (server-processed format)');
      return localVideoUri;
    }
    if (cached && isMp4(cached) && await isValidLocal(cached)) {
      console.log('📹 Using cached mp4 recording');
      return cached;
    }
    if (finalVideoUri) {
      const isLocalFile = finalVideoUri.startsWith('file://') || finalVideoUri.startsWith('/');
      if (isLocalFile) {
        if (await isValidLocal(finalVideoUri)) {
          console.log('📹 Using finalVideoUri (local file)');
          return finalVideoUri;
        }
      } else if (finalVideoUri.startsWith('http')) {
        try {
          const dlPath = await downloadVideoToLocal(finalVideoUri, 'final');
          if (await isValidLocal(dlPath)) {
            console.log('📹 Downloaded finalVideoUri to local');
            return dlPath;
          }
        } catch (e) { console.warn('📹 finalVideoUri download failed:', e.message); }
      }
    }
    // Use server-processed video loaded from Firestore (when coming from EditRoom, finalVideoUri is null)
    let firestoreUrl = firestoreVideoUrlRef.current;
    // If not loaded yet (user pressed share before useEffect resolved), do a fresh fetch now
    if (!firestoreUrl && currentStoryId) {
      try {
        console.log('📹 firestoreVideoUrlRef empty — fetching finalVideoUrl from Firestore now...');
        const freshRes = await storiesService.getStory(currentStoryId);
        const freshUrl = freshRes.success && freshRes.story?.finalVideoUrl;
        if (freshUrl) {
          firestoreVideoUrlRef.current = freshUrl;
          firestoreUrl = freshUrl;
          console.log('📹 Fresh Firestore fetch got finalVideoUrl');
        }
      } catch (e) { console.warn('📹 Fresh Firestore fetch failed:', e.message); }
    }
    if (firestoreUrl) {
      console.log('📹 Using Firestore videoUrl, downloading...');
      try {
        const dlPath = await downloadVideoToLocal(firestoreUrl, 'firestore_video');
        if (await isValidLocal(dlPath)) {
          console.log('📹 Firestore videoUrl downloaded and valid');
          return dlPath;
        }
      } catch (e) { console.warn('📹 Firestore videoUrl download failed:', e.message); }
    }
    // Only re-record if we have NO known URL for this story.
    // If we do have a URL (Firestore/Firebase) but downloads failed, don't re-record —
    // that would show a black screen + audio and re-upload unnecessarily.
    // Only treat as "known" if we have a non-webm URL — webm-only means conversion failed,
    // so re-recording is still worth attempting for animated formats.
    const isWebm = (u) => u && u.toLowerCase().includes('.webm');
    const hasKnownUrl = !!(
      (firestoreVideoUrlRef.current && !isWebm(firestoreVideoUrlRef.current)) ||
      (firebaseUrlRef.current && !isWebm(firebaseUrlRef.current))
    );
    if (isAnimatedFormat && clientRecordingSupportedRef.current && !hasKnownUrl) {
      console.log('📹 No known URL — recording now');
      setIsDownloading(true);
      const fileUri = await performClientRecording();
      // Restore end screen so VideoFactoryWaiting (upload overlay) doesn't block the share dialog
      setShowEndScreen(true);
      if (fileUri && await isValidLocal(fileUri)) return fileUri;
      console.log('📹 Client recording failed or too small, falling back to server');
    } else if (hasKnownUrl) {
      console.log('📹 Has known URL but downloads failed — not re-recording');
    }
    console.log('📹 Falling back to server-side render');
    return await renderConcatenatedVideo(label);
  };

  const downloadVideoToLocal = async (url, prefix = 'video', timeoutMs = 30000) => {
    const filename = `${prefix}_${Date.now()}.mp4`;
    const localUri = FileSystem.cacheDirectory + filename;
    const downloadPromise = FileSystem.downloadAsync(url, localUri);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Download timeout after ' + timeoutMs / 1000 + 's')), timeoutMs)
    );
    const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
    if (downloadResult.status !== 200) throw new Error('Download failed: status ' + downloadResult.status);
    return downloadResult.uri;
  };

  const handleSaveToGallery = async () => {
    try {
      setIsDownloading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permission_required'), t('finalVideo.permission_gallery_save'));
        return;
      }

      // Try known URLs / local cache first — avoids triggering re-recording
      const knownRemoteUrl = firebaseUrlRef.current || recordingFirebaseUrl || firestoreVideoUrlRef.current;
      const knownLocalCache = cachedRecordingRef.current || cachedRecordingUri || localVideoUri;

      let localUri = null;

      // 1. Use local cache if valid
      if (knownLocalCache) {
        const info = await FileSystem.getInfoAsync(knownLocalCache);
        if (info.exists && info.size > 10000) {
          localUri = knownLocalCache;
          console.log('📹 Gallery save: using local cache', localUri);
        }
      }

      // 2. Download from known remote URL
      if (!localUri && knownRemoteUrl) {
        setDownloadProgress(t('finalVideo.saving_to_gallery'));
        try {
          localUri = await downloadVideoToLocal(knownRemoteUrl, 'gallery_save');
          console.log('📹 Gallery save: downloaded from remote URL');
        } catch (dlErr) {
          console.warn('📹 Remote download failed:', dlErr.message);
        }
      }

      // 3. Fall back to full getVideoForSharing logic (may trigger re-record for animated formats)
      if (!localUri) {
        const allVideos = cubeFaces.map(f => f?.videoUrl).filter(Boolean);
        if (allVideos.length === 0 && !finalVideoUri && !knownRemoteUrl) {
          Alert.alert(t('common.error'), t('finalVideo.no_video'));
          return;
        }
        setDownloadProgress(t('finalVideo.saving_to_gallery'));
        const videoUri = await getVideoForSharing(t('finalVideo.saving_label'));
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, storyName.replace(/[^a-zA-Zא-ת0-9]/g, '_'));
      }

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      console.log('📹 File to save:', localUri, 'size:', fileInfo.size, 'exists:', fileInfo.exists);

      if (!fileInfo.exists || fileInfo.size < 1000) {
        throw new Error(t('finalVideo.error_save', { message: 'file too small or missing' }));
      }

      if (!localUri.endsWith('.mp4')) {
        const mp4Path = localUri.replace(/\.[^.]+$/, '.mp4');
        await FileSystem.copyAsync({ from: localUri, to: mp4Path });
        localUri = mp4Path;
        console.log('📹 Renamed to .mp4 for gallery save:', mp4Path);
      }

      try {
        const asset = await MediaLibrary.createAssetAsync(localUri);
        console.log('📹 Asset created:', asset.uri);
      } catch (assetErr) {
        console.warn('📹 createAssetAsync failed, trying saveToLibraryAsync:', assetErr.message);
        await MediaLibrary.saveToLibraryAsync(localUri);
      }
      
      Alert.alert(t('finalVideo.saved_success'), t('finalVideo.saved_single'));
    } catch (error) {
      console.error('Save to gallery error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_save', { message: error.message }));
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleShareToFacebook = async () => {
    if (!videoReadyForShare) {
      Alert.alert('בעיבוד', 'הסרטון עדיין בעיבוד — נסה שוב בעוד כמה דקות');
      return;
    }
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing('Facebook');
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress(t('finalVideo.downloading'));
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'facebook');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, { mimeType: 'video/mp4' });
        return;
      }
      await Share.share({ message: `צפו בסיפור שלי: "${storyName}" 🎬✨`, title: storyName });
    } catch (error) {
      console.error('Facebook share error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_facebook_share'));
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleShareToInstagram = async () => {
    if (!videoReadyForShare) {
      Alert.alert('בעיבוד', 'הסרטון עדיין בעיבוד — נסה שוב בעוד כמה דקות');
      return;
    }
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing(t('finalVideo.instagram_label'));
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress(t('finalVideo.downloading'));
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'instagram');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
          UTI: 'com.instagram.exclusivegram',
        });
        return;
      }
      const igUrl = 'instagram://app';
      const canOpen = await Linking.canOpenURL(igUrl);
      if (canOpen) {
        await Linking.openURL(igUrl);
      } else {
        Alert.alert(t('finalVideo.instagram_title'), t('finalVideo.error_instagram'));
      }
    } catch (error) {
      console.error('Instagram share error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_instagram_share'));
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleShareToTikTok = async () => {
    if (!videoReadyForShare) {
      Alert.alert('בעיבוד', 'הסרטון עדיין בעיבוד — נסה שוב בעוד כמה דקות');
      return;
    }
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing(t('finalVideo.preparing_label'));
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress(t('finalVideo.downloading'));
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'tiktok');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
        });
        return;
      }
      const tiktokUrl = 'snssdk1233://';
      const canOpen = await Linking.canOpenURL(tiktokUrl);
      if (canOpen) {
        await Linking.openURL(tiktokUrl);
      } else {
        Alert.alert(t('finalVideo.tiktok_title'), t('finalVideo.error_tiktok'));
      }
    } catch (error) {
      console.error('TikTok share error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_tiktok_share'));
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleRemixMusic = async () => {
    if (!currentStoryId) return;
    setIsRemixingMusic(true);
    try {
      const res = await fetch(`${VIDEO_CONVERTER_URL}/api/remix-music`, {
        method: 'POST',
        headers: SERVER_HEADERS,
        body: JSON.stringify({ storyId: currentStoryId, userHint: musicHint.trim() || undefined, musicEngine }),
      });
      const data = await res.json();
      if (!res.ok || !data.finalVideoUrl) {
        Alert.alert('שגיאה', data.error || 'החלפת המוזיקה נכשלה');
        return;
      }
      // Download the new mixed video locally and update playback
      const localPath = FileSystem.cacheDirectory + `remix_${Date.now()}.mp4`;
      const dlResult = await FileSystem.downloadAsync(data.finalVideoUrl, localPath);
      const MIN_VALID = 50000;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (dlResult.status === 200 && fileInfo.exists && fileInfo.size >= MIN_VALID) {
        setLocalVideoUri(localPath);
        cachedRecordingRef.current = localPath;
        setRecordingFirebaseUrl(data.finalVideoUrl);
        firebaseUrlRef.current = data.finalVideoUrl;
      } else {
        console.warn(`📹 Remix file invalid (${fileInfo.size || 0} bytes) — keeping original`);
        Alert.alert('שגיאה', 'הקובץ שהתקבל פגום. נסה שוב.');
        return;
      }
      setMusicHint('');
      Alert.alert('✅ מוזיקה הוחלפה', 'הסרטון עודכן עם המוזיקה החדשה');
    } catch (err) {
      Alert.alert('שגיאה', err.message);
    } finally {
      setIsRemixingMusic(false);
    }
  };

  const handleGeneralShare = async () => {
    console.log('🔗 handleGeneralShare v2 - link share');
    if (!videoReadyForShare) {
      Alert.alert(
        'הסרטון עדיין בהכנה 🎬',
        'הסרטון מוכן בקרוב — תקבל הודעה כשאפשר לשלוח.',
        [{ text: 'הבנתי' }]
      );
      return;
    }
    try {
      const domain = Constants.expoConfig?.extra?.webPlayerDomain ||
                     'reflectlymobilex.onrender.com';
      const watchUrl = `https://${domain}/s/${currentStoryId}`;
      await Share.share({
        message: `צפה בסיפור שלי: "${storyName}" 🎬\n${watchUrl}`,
        title: storyName,
        url: watchUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert(t('common.error'), t('finalVideo.error_share'));
    }
  };

  // VIDEO FILE SHARE (kept for easy restore):
  // const handleGeneralShare = async () => {
  //   try {
  //     setIsDownloading(true);
  //     const videoUri = await getVideoForSharing(t('finalVideo.preparing_label'));
  //     if (videoUri && await Sharing.isAvailableAsync()) {
  //       const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
  //       const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'share');
  //       setIsDownloading(false);
  //       await Sharing.shareAsync(localUri, { mimeType: 'video/mp4', dialogTitle: `שתף את הסרטון: ${storyName}` });
  //       return;
  //     }
  //     await Share.share({ message: `צפה בסרטון שלי: "${storyName}" 🎬`, title: storyName });
  //   } catch (error) {
  //     console.error('Share error:', error);
  //     Alert.alert(t('common.error'), t('finalVideo.error_share'));
  //   } finally {
  //     setIsDownloading(false);
  //     setDownloadProgress('');
  //   }
  // };

  const handleNewStory = () => {
    stopAmbientMusic();
    resetStory();
    go('Home');
  };

  const handlePlaybackComplete = () => {
    setPlaybackComplete(true);
    stopAmbientMusic();
  };

  const openBgPicker = async () => {
    if (bgPickerList.length === 0) {
      const list = await backgroundsService.getActiveBackgrounds();
      setBgPickerList(list);
    }
    setShowBgPicker(true);
  };

  const selectBg = (url, mediaType) => {
    setBackgroundVideoUrl(url);
    setBackgroundMediaType(mediaType);
    setShowBgPicker(false);
    // Persist to Firestore so background survives app restarts
    if (currentStoryId) {
      storiesService.updateStory(currentStoryId, { backgroundVideoUrl: url, backgroundMediaType: mediaType }).catch(() => {});
    }
  };

  const resetBg = () => {
    setBackgroundVideoUrl(null);
    setBackgroundMediaType(null);
    setShowBgPicker(false);
    if (currentStoryId) {
      storiesService.updateStory(currentStoryId, { backgroundVideoUrl: null, backgroundMediaType: null }).catch(() => {});
    }
  };

  const pickBgFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.permission_required'), t('finalVideo.permission_gallery'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      selectBg(dataUrl, 'image');
    }
  };

  const videos3D = is3DFormat ? prepareVideosFor3D() : [];

  return (
    <View style={[styles.container, isCubeFullscreen && styles.fullscreenMode]}>
      {/* ANIMATION PLAYER - supports cube-3d and flip-pages */}
      {isAnimatedFormat && assetsReady && (generatedMusicUrl || musicServerDown) && (
        <View style={[
          styles.cubeContainer,
          !isCube3D && { height: SCREEN_HEIGHT * 0.62 },
          isCubeFullscreen && styles.fullscreenCubeOverlay
        ]}>
          <AnimationPlayer
            key={animationPlayerKey}
            format={videoFormat}
            faces={cubeFaces}
            storyName={storyName}
            autoRotate={cubeStarted}
            rotationSpeed={currentVideoDuration > 0 ? currentVideoDuration * 1000 * 4 : 20000}
            isFullscreen={isCubeFullscreen}
            triggerAutoPlay={triggerAutoPlay}
            recordNextPlayback={recordNextPlayback}
            musicUrl={generatedMusicUrl || null}
            backgroundUrl={backgroundVideoUrl || null}
            backgroundMediaType={backgroundMediaType || 'video'}
            onFaceChange={handleFaceChange}
            onVideoStart={(faceIndex) => setCurrentPlayingFaceIndex(faceIndex)}
            onVideoEnd={handleVideoEnd}
            onPlaybackStart={() => {
              console.log('🚀 Animation fullscreen mode ON');
              setIsCubeFullscreen(true);
              pendingMusicStartRef.current = true;
              setCubeStarted(true);
              if (generatedMusicUrlRef.current) {
                startAiMusic();
              }
              // Do NOT start ambient music here — Audio.Sound.createAsync / setAudioModeAsync
              // while face-0 is buffering causes iOS to interrupt the WKWebView audio session,
              // stalling face-0 for 3-6s before the watchdog skips to face-1.
              if (recordNextPlayback) {
                setClientRecordingInProgress(true);
              }
            }}
            onPlaybackComplete={() => {
              console.log('✅ All videos finished - showing end screen');
              setIsCubeFullscreen(false);
              videoPlaybackEndedRef.current = true;
              setVideoHasPlayed(true);
              analyticsService.movieWatched(currentStoryId);
              stopAmbientMusic();
              stopAiMusic().then(() => {
                // Pre-load music so next playback starts instantly (no reload delay)
                if (generatedMusicUrlRef.current) preloadAiMusic();
              });
              if (clientRecordingInProgress) {
                console.log('📹 Playback complete during recording — VideoFactoryWaiting shows until upload done');
                // Do NOT setShowEndScreen here — VideoFactoryWaiting will show (isUploadingRecording)
                // and setShowEndScreen(true) will be called by convertAndUploadRecording when done.
              } else if (isRecordingMode) {
                setIsRecordingMode(false);
                setTimeout(() => {
                  Alert.alert(
                    t('finalVideo.stop_recording_title'),
                    t('finalVideo.stop_recording_text'),
                    [{ text: t('finalVideo.stop_recording_ok'), onPress: () => setShowEndScreen(true) }]
                  );
                }, 500);
              } else if (USE_SERVER_CUBE_RENDER && videoFormat === 'cube-3d' && !videoReadyForShareRef.current) {
                // Server still rendering — VideoFactoryWaiting will show automatically until push arrives
                console.log('📹 Animation done but server still rendering — showing VideoFactoryWaiting');
              } else {
                setShowEndScreen(true);
              }
            }}
            onRecordingSupport={handleRecordingSupport}
            onRecordingComplete={handleRecordingComplete}
            onRecordingProgress={handleRecordingProgress}
            currentPlayingFaceIndex={currentPlayingFaceIndex}
          />
        </View>
      )}

      {/* Music timeout banner — small absolute banner, doesn't affect layout */}
      {isAnimatedFormat && !generatedMusicUrl && musicServerDown && (
        <View style={styles.musicErrorContainer}>
          <Ionicons name="musical-notes-outline" size={18} color="white" />
          <Text style={styles.musicErrorTitle}>{t('finalVideo.music_server_down')}</Text>
          <TouchableOpacity
            onPress={() => { setMusicServerDown(false); setMusicTimedOut(false); setMusicRetryTrigger(n => n + 1); }}
          >
            <Ionicons name="refresh-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Factory Waiting Screen — only while waiting for Suno, before animation starts */}
      {isAnimatedFormat && !generatedMusicUrl && !musicTimedOut && !musicServerDown && !isCubeFullscreen && !videoHasPlayed && (
        <VideoFactoryWaiting estimatedSeconds={180} storyName={storyName} />
      )}

      {/* Server Cube Render — waiting after animation finishes until push notification arrives */}
      {USE_SERVER_CUBE_RENDER && videoFormat === 'cube-3d' && videoHasPlayed && !videoReadyForShare && !showEndScreen && !isCubeFullscreen && (
        <VideoFactoryWaiting
          estimatedSeconds={300}
          storyName={storyName}
          title="הסרטון שלך בעריכה 🎬"
          message="נשלח לך התראה כשמוכן לשליחה"
          renderStage={renderStage}
        />
      )}

      {/* Recording + Upload/Mix Processing Overlay — shown until the final mixed URL is ready */}
      {!isCubeFullscreen && (clientRecordingInProgress || isUploadingRecording) && !showEndScreen && videoHasPlayed && (
        <VideoFactoryWaiting
          estimatedSeconds={120}
          storyName={storyName}
          title={t('finalVideo.factory_processing')}
          message={downloadProgress || (isUploadingRecording ? t('finalVideo.factory_mixing') : t('finalVideo.factory_preparing'))}
          disableMusic
        />
      )}

      {/* End Screen Overlay */}
      <Modal
        visible={showEndScreen}
        transparent={false}
        animationType="none"
        statusBarTranslucent
      >
        <View style={styles.endScreenOverlay}>
          <View style={styles.endScreenBgOverlay} />
          {isDownloading && (
            <View style={styles.downloadProgressOverlay}>
              <View style={styles.downloadProgressCard}>
                <ActivityIndicator size="large" color="#5ab4cc" />
                <Text style={styles.downloadProgressTitle}>{t('finalVideo.processing_overlay')}</Text>
                {downloadProgress ? (
                  <Text style={styles.downloadProgressText}>{downloadProgress}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => { setIsDownloading(false); setDownloadProgress(''); }}
                  style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: '#5ab4cc' }}
                >
                  <Text style={{ color: '#5ab4cc', fontSize: 14 }}>ביטול</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.endScreenScroll}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={require('../../assets/rilio-logo-primary.png.png')}
                style={styles.endScreenLogo}
                resizeMode="contain"
              />
              <Text style={styles.endScreenText}>{t('finalVideo.end_text')}</Text>
              <Text style={styles.endScreenSubtext}>{storyName}</Text>

              {!privacySettings?.allowSocialMedia && (
                <View style={styles.privateWatermark}>
                  <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.privateWatermarkText}>לצפייה פרטית בלבד — לא לפרסום</Text>
                </View>
              )}

              {isUploadingRecording ? (
                <View style={styles.recordingReadyBadge}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.recordingReadyText}>{t('finalVideo.upload_converting')}</Text>
                </View>
              ) : conversionSucceeded ? (
                <View style={styles.recordingReadyBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={styles.recordingReadyText}>{t('finalVideo.upload_mp4_ready')}</Text>
                </View>
              ) : cachedRecordingUri ? (
                <View style={styles.recordingReadyBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFC107" />
                  <Text style={styles.recordingReadyText}>{t('finalVideo.upload_recorded')}</Text>
                </View>
              ) : null}

              {/* Server render error UI */}
              {serverRenderError && (
                <View style={{ marginTop: 14, alignItems: 'center', paddingHorizontal: 20 }}>
                  <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>
                    {t('finalVideo.server_render_error')} ({serverRenderError})
                  </Text>
                  <TouchableOpacity
                    onPress={startServerCubeRender}
                    style={{ backgroundColor: '#5ab4cc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 22, marginBottom: 8 }}
                  >
                    <Text style={{ color: '#040c18', fontSize: 14, fontWeight: '600' }}>נסה שוב</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleServerRenderFallback}
                    style={{ borderRadius: 20, paddingVertical: 8, paddingHorizontal: 22, borderWidth: 1, borderColor: '#5ab4cc' }}
                  >
                    <Text style={{ color: '#5ab4cc', fontSize: 14 }}>הקלט מהמכשיר</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.endScreenDivider} />

              <View style={styles.endScreenActionsCard}>
              <Text style={styles.endScreenSectionTitle}>{t('finalVideo.section_save_share')}</Text>

              <View style={styles.endScreenActions}>
                <TouchableOpacity 
                  style={styles.endScreenActionBtn}
                  onPress={handleSaveToGallery}
                  disabled={isDownloading}
                >
                  <View style={styles.endScreenIconCircle}>
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="download-outline" size={22} color="white" />
                    )}
                  </View>
                  <Text style={styles.endScreenActionLabel}>{t('finalVideo.btn_download_video')}</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.endScreenActionBtn, (!videoReadyForShare || isDownloading) && styles.disabledBtn]}
                  onPress={handleGeneralShare}
                  disabled={isDownloading}
                >
                  <View style={styles.endScreenIconCircle}>
                    {videoReadyForShare
                      ? <Ionicons name="share-outline" size={22} color="white" />
                      : <Ionicons name="time-outline" size={22} color="rgba(255,255,255,0.5)" />
                    }
                  </View>
                  <Text style={styles.endScreenActionLabel}>
                    {videoReadyForShare ? t('finalVideo.btn_send') : 'בעיבוד...'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.endScreenSectionTitle}>{t('finalVideo.section_social')}</Text>

              <View style={styles.endScreenSocials}>
                {/* WhatsApp — always visible */}
                <TouchableOpacity
                  style={[styles.socialBtn, !videoReadyForShare && { opacity: 0.55 }]}
                  onPress={handleShareToWhatsApp}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: videoReadyForShare ? '#25D366' : '#888' }]}>
                    {videoReadyForShare
                      ? <Ionicons name="logo-whatsapp" size={24} color="white" />
                      : <Ionicons name="time-outline" size={20} color="white" />
                    }
                  </View>
                  <Text style={styles.socialLabel}>
                    {videoReadyForShare ? t('finalVideo.social_whatsapp') : 'בעיבוד...'}
                  </Text>
                </TouchableOpacity>

                {/* Facebook / Instagram / TikTok — only when public consent given */}
                {privacySettings?.allowSocialMedia && (
                  <>
                    <TouchableOpacity
                      style={[styles.socialBtn, (!videoReadyForShare || isDownloading) && { opacity: 0.50 }]}
                      onPress={handleShareToFacebook}
                      disabled={isDownloading}
                    >
                      <View style={[styles.socialIconCircle, { backgroundColor: videoReadyForShare ? '#1877F2' : '#888' }]}>
                        {videoReadyForShare
                          ? <Ionicons name="logo-facebook" size={24} color="white" />
                          : <Ionicons name="time-outline" size={20} color="white" />
                        }
                      </View>
                      <Text style={styles.socialLabel}>{t('finalVideo.social_facebook')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialBtn, (!videoReadyForShare || isDownloading) && { opacity: 0.50 }]}
                      onPress={handleShareToInstagram}
                      disabled={isDownloading}
                    >
                      <LinearGradient
                        colors={videoReadyForShare ? ['#F58529', '#DD2A7B', '#8134AF', '#515BD4'] : ['#888', '#888']}
                        style={styles.socialIconCircle}
                      >
                        {videoReadyForShare
                          ? <Ionicons name="logo-instagram" size={24} color="white" />
                          : <Ionicons name="time-outline" size={20} color="white" />
                        }
                      </LinearGradient>
                      <Text style={styles.socialLabel}>{t('finalVideo.social_instagram')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialBtn, (!videoReadyForShare || isDownloading) && { opacity: 0.50 }]}
                      onPress={handleShareToTikTok}
                      disabled={isDownloading}
                    >
                      <View style={[styles.socialIconCircle, { backgroundColor: videoReadyForShare ? '#000' : '#888' }]}>
                        {videoReadyForShare
                          ? <Ionicons name="logo-tiktok" size={22} color="white" />
                          : <Ionicons name="time-outline" size={20} color="white" />
                        }
                      </View>
                      <Text style={styles.socialLabel}>{t('finalVideo.social_tiktok')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* No social consent — lock message */}
              {!privacySettings?.allowSocialMedia && (
                <View style={styles.socialNoConsentBanner}>
                  <Ionicons name="lock-closed-outline" size={13} color="rgba(200,155,70,0.70)" />
                  <Text style={styles.socialNoConsentText}>לשיתוף ברשתות חברתיות — יש לאפשר פרסום ציבורי בהגדרות הסיפור</Text>
                </View>
              )}

              {/* Replace music section — only shown once recording is done */}
              {conversionSucceeded && (
                <View style={styles.remixMusicSection}>
                  <View style={styles.remixMusicHeader}>
                    <Ionicons name="musical-notes-outline" size={18} color="#5ab4cc" />
                    <Text style={styles.remixMusicTitle}>לא מרוצה מהמוזיקה?</Text>
                  </View>
                  <TextInput
                    style={styles.remixMusicInput}
                    placeholder="תאר מה אתה מחפש... (לדוגמה: משהו יותר עליז)"
                    placeholderTextColor="#999"
                    value={musicHint}
                    onChangeText={setMusicHint}
                    multiline={false}
                    returnKeyType="done"
                  />
                  {/* Engine toggle: Suno (default) vs MusicGen (premium AI) */}
                  <View style={styles.engineToggleRow}>
                    <TouchableOpacity
                      style={[styles.engineToggleBtn, musicEngine === 'suno' && styles.engineToggleBtnActive]}
                      onPress={() => setMusicEngine('suno')}
                    >
                      <Text style={[styles.engineToggleBtnText, musicEngine === 'suno' && styles.engineToggleBtnTextActive]}>🎵 Suno</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.engineToggleBtn, musicEngine === 'musicgen' && styles.engineToggleBtnActive]}
                      onPress={() => setMusicEngine('musicgen')}
                    >
                      <Text style={[styles.engineToggleBtnText, musicEngine === 'musicgen' && styles.engineToggleBtnTextActive]}>✨ MusicGen AI</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.remixMusicBtn, isRemixingMusic && styles.disabledBtn]}
                    onPress={handleRemixMusic}
                    disabled={isRemixingMusic}
                  >
                    {isRemixingMusic ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color="white" />
                    )}
                    <Text style={styles.remixMusicBtnText}>
                      {isRemixingMusic ? 'מחליף מוזיקה...' : 'החלף מוזיקה'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {clipsExpireAt && !clipsDeleted && (() => {
                const daysLeft = Math.ceil((clipsExpireAt - new Date()) / (1000 * 60 * 60 * 24));
                return daysLeft > 0 ? (
                  <TouchableOpacity style={styles.hdBanner} onPress={() => setShowHdModal(true)} activeOpacity={0.75}>
                    <Ionicons name="download-outline" size={14} color="rgba(200,155,70,0.90)" />
                    <Text style={styles.hdBannerText}>הורד בHD — זמין עוד {daysLeft} ימים</Text>
                    <Ionicons name="chevron-forward" size={12} color="rgba(200,155,70,0.50)" />
                  </TouchableOpacity>
                ) : null;
              })()}

              <View style={styles.endScreenBottomBtns}>
                <TouchableOpacity
                  style={styles.endScreenPrimaryBtn}
                  onPress={() => { resetStory(); go('Home'); }}
                >
                  <Ionicons name="home-outline" size={20} color="#040c18" />
                  <Text style={styles.endScreenPrimaryBtnText}>{t('finalVideo.btn_go_home')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.endScreenSecondaryBtn}
                  onPress={() => {
                    setShowEndScreen(false);
                    setPlaybackComplete(false);
                    videoPlaybackEndedRef.current = false;
                    setVideoHasPlayed(false);
                    setCubeStarted(false);
                    setIsCubeFullscreen(false);
                    setAnimationPlayerKey(k => k + 1);
                  }}
                >
                  <Ionicons name="play-circle-outline" size={18} color="#5ab4cc" />
                  <Text style={styles.endScreenSecondaryBtnText}>{t('finalVideo.btn_watch_again')}</Text>
                </TouchableOpacity>
              </View>
              </View>
            </ScrollView>
        </View>
      </Modal>

      {/* HD Download Modal */}
      <Modal visible={showHdModal} transparent animationType="slide" onRequestClose={() => setShowHdModal(false)}>
        <TouchableOpacity style={styles.hdModalOverlay} activeOpacity={1} onPress={() => setShowHdModal(false)}>
          <TouchableOpacity style={styles.hdModalCard} activeOpacity={1} onPress={() => {}}>
            <View style={styles.hdModalIconCircle}>
              <Ionicons name="film-outline" size={28} color="rgba(200,155,70,0.90)" />
            </View>
            <Text style={styles.hdModalTitle}>הורד בHD</Text>
            <Text style={styles.hdModalSub}>גרסת 1080p באיכות הקרנה</Text>

            <View style={styles.hdModalBullets}>
              {['איכות 1080p מלאה', 'שמירה ישירה לגלריה', 'ניסיון חינם'].map((b, i) => (
                <View key={i} style={styles.hdModalBulletRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#5ab4cc" />
                  <Text style={styles.hdModalBulletText}>{b}</Text>
                </View>
              ))}
            </View>

            {hdRenderStatus === 'rendering' ? (
              <View style={styles.hdModalRenderingBox}>
                <ActivityIndicator color="rgba(200,155,70,0.90)" />
                <Text style={styles.hdModalRenderingText}>מרנדר בHD, עוד כמה דקות...</Text>
                <Text style={styles.hdModalRenderingHint}>ניתן לסגור — נשלח עדכון כשמוכן</Text>
              </View>
            ) : hdRenderStatus === 'ready' && hdVideoUrl ? (
              <TouchableOpacity style={styles.hdModalBtn} onPress={handleHdDownload} disabled={isDownloadingHd}>
                {isDownloadingHd ? <ActivityIndicator color="#040c18" /> : <Ionicons name="download-outline" size={18} color="#040c18" />}
                <Text style={styles.hdModalBtnText}>{isDownloadingHd ? 'מוריד...' : 'הורד לגלריה'}</Text>
              </TouchableOpacity>
            ) : hdRenderStatus === 'error' ? (
              <TouchableOpacity style={styles.hdModalBtn} onPress={handleHdRender}>
                <Ionicons name="refresh-outline" size={18} color="#040c18" />
                <Text style={styles.hdModalBtnText}>נסה שנית</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.hdModalBtn} onPress={handleHdRender}>
                <Ionicons name="sparkles-outline" size={18} color="#040c18" />
                <Text style={styles.hdModalBtnText}>צור גרסת HD</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setShowHdModal(false)} style={styles.hdModalDismiss}>
              <Text style={styles.hdModalDismissText}>אולי מאוחר יותר</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Screen Recording Guide Modal */}
      {showRecordGuide && (
        <View style={styles.endScreenOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.endScreenGradient}
          >
            <View style={styles.recordGuideContent}>
              <View style={styles.recordGuideIconWrap}>
                <Ionicons name="recording-outline" size={50} color="#FF4444" />
              </View>
              <Text style={styles.recordGuideTitle}>{t('finalVideo.guide_title')}</Text>
              <Text style={styles.recordGuideDesc}>
                {t('finalVideo.guide_desc')}
              </Text>

              <View style={styles.recordGuideSteps}>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                  <Text style={styles.stepText}>{t('finalVideo.guide_step_1')}</Text>
                </View>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                  <Text style={styles.stepText}>{t('finalVideo.guide_step_2')}</Text>
                </View>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                  <Text style={styles.stepText}>{t('finalVideo.guide_step_3')}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.recordStartBtn}
                onPress={startRecordingCountdown}
              >
                <Ionicons name="videocam" size={24} color="white" />
                <Text style={styles.recordStartBtnText}>{t('finalVideo.guide_btn_start')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.recordCancelBtn}
                onPress={() => {
                  setShowRecordGuide(false);
                  setShowEndScreen(true);
                }}
              >
                <Text style={styles.recordCancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Countdown Overlay */}
      {recordCountdown > 0 && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{recordCountdown}</Text>
          <Text style={styles.countdownLabel}>{t('finalVideo.countdown_label')}</Text>
        </View>
      )}

      {!isCubeFullscreen && !showEndScreen && !showRecordGuide && (
        <>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="sparkles" size={22} color="#5ab4cc" />
              </View>
              <Text style={styles.title}>{t('finalVideo.header_title')}</Text>
              <Text style={styles.storyName}>{storyName}</Text>
              {is3DFormat && (
                <View style={styles.formatBadge}>
                  <Ionicons name="cube" size={16} color="#5ab4cc" />
                  <Text style={styles.formatText}>{videoFormat}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.content}>
        <View style={styles.videoContainer}>
          {isAnimatedFormat && assetStatus === 'error' ? (
            /* Show error screen with retry option when downloads failed */
            <View style={styles.cubeContainer}>
              <View style={styles.loadingContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.error || '#EF4444'} />
                <Text style={styles.errorTitle}>{t('finalVideo.error_download')}</Text>
                <Text style={styles.cubePlayText}>{assetProgress.message}</Text>
                <Text style={styles.cubeProgressText}>
                  {t('finalVideo.progress_downloaded', { converted: assetProgress.converted, total: assetProgress.total })}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    resetAssets();
                    setTimeout(() => prepareAllAssets(), 100);
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="white" />
                  <Text style={styles.retryButtonText}>{t('finalVideo.btn_retry')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isAnimatedFormat && !assetsReady ? (
            /* Show loading screen while downloading ALL videos */
            <View style={styles.cubeContainer}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingTitle}>{t('finalVideo.loading_cube')}</Text>
                <Text style={styles.cubePlayText}>{assetProgress.message}</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${assetProgress.total > 0 ? (assetProgress.converted / assetProgress.total) * 100 : 0}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.cubeProgressText}>
                  {t('finalVideo.progress_videos', { converted: assetProgress.converted, total: assetProgress.total })}
                </Text>
              </View>
            </View>
          ) : isAnimatedFormat && assetsReady ? (
            /* Cube is rendered at top level - show empty placeholder here */
            null
          ) : is3DFormat && !isCinematic && videos3D.length > 0 ? (
            <Video3DPlayer
              videos={videos3D}
              format={videoFormat}
              width={SCREEN_WIDTH - 48}
              height={260}
              autoPlay={true}
              onComplete={handlePlaybackComplete}
            />
          ) : finalVideoUri ? (
            isLoadingVideo ? (
              <View style={[styles.videoPlayer, isCinematic && { height: SCREEN_HEIGHT * 0.65 }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.subtext, marginTop: 12 }}>{t('finalVideo.loading_video')}</Text>
              </View>
            ) : (
              <VideoView
                player={player}
                style={[styles.videoPlayer, isCinematic && { height: SCREEN_HEIGHT * 0.65 }]}
                nativeControls
                contentFit="contain"
              />
            )
          ) : (
            <View style={styles.videoPreview}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={64}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.noVideoText}>{t('finalVideo.no_video')}</Text>
            </View>
          )}
          
          <View style={styles.videoInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{t('finalVideo.participants_count', { count: participantCount })}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="videocam-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{t('finalVideo.reflections_count', { count: reflections.length })}</Text>
            </View>
          </View>
        </View>

        {playbackComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.completeText}>{t('finalVideo.playback_complete')}</Text>
          </View>
        )}

        <View style={styles.privacyBadge}>
          <Ionicons 
            name={privacySettings.allowSocialMedia ? 'globe-outline' : 'lock-closed-outline'} 
            size={18} 
            color={privacySettings.allowSocialMedia ? theme.colors.success : theme.colors.primary} 
          />
          <Text style={styles.privacyText}>
            {privacySettings.allowSocialMedia
              ? t('finalVideo.privacy_public')
              : t('finalVideo.privacy_private')}
          </Text>
        </View>

        <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSaveToGallery}
              disabled={isDownloading}
            >
              <View style={styles.actionIcon}>
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#5ab4cc" />
                ) : (
                  <Ionicons name="download-outline" size={28} color="#5ab4cc" />
                )}
              </View>
              <Text style={styles.actionLabel}>{t('finalVideo.btn_download')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={styles.actionIcon}>
                <Ionicons name="share-social-outline" size={28} color="#5ab4cc" />
              </View>
              <Text style={styles.actionLabel}>{t('finalVideo.btn_share')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => go('EditRoom')}>
              <View style={styles.actionIcon}>
                <Ionicons name="create-outline" size={28} color="#5ab4cc" />
              </View>
              <Text style={styles.actionLabel}>{t('finalVideo.btn_edit')}</Text>
            </TouchableOpacity>

            {isAnimatedFormat && (
              <TouchableOpacity style={styles.actionButton} onPress={openBgPicker}>
                <View style={styles.actionIcon}>
                  <Ionicons name="image-outline" size={28} color={backgroundVideoUrl ? '#5ab4cc' : 'rgba(255,255,255,0.35)'} />
                </View>
                <Text style={styles.actionLabel}>{t('finalVideo.btn_bg')}</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
        </>
      )}
      {/* Background Picker Modal */}
      <Modal
        visible={showBgPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBgPicker(false)}
      >
        <TouchableOpacity
          style={styles.bgModalOverlay}
          activeOpacity={1}
          onPress={() => setShowBgPicker(false)}
        />
        <View style={styles.bgModalSheet}>
          <View style={styles.bgModalHeader}>
            <Text style={styles.bgModalTitle}>{t('finalVideo.bg_modal_title')}</Text>
            <TouchableOpacity onPress={() => setShowBgPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bgPickerScroll}
            contentContainerStyle={styles.bgPickerContent}
          >
            {/* Default / starfield */}
            <TouchableOpacity
              style={[styles.bgThumb, !backgroundVideoUrl && styles.bgThumbSelected]}
              onPress={resetBg}
            >
              <View style={[styles.bgThumbImg, { backgroundColor: '#0a0a1e', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="sparkles" size={28} color="#a78bfa" />
              </View>
              <Text style={styles.bgThumbName}>{t('finalVideo.bg_default')}</Text>
            </TouchableOpacity>

            {bgPickerList.map((bg) => (
              <TouchableOpacity
                key={bg.firestoreId}
                style={[styles.bgThumb, backgroundVideoUrl === bg.url && styles.bgThumbSelected]}
                onPress={() => selectBg(bg.url, bg.mediaType)}
              >
                {bg.mediaType === 'image' ? (
                  <Image source={{ uri: bg.url }} style={styles.bgThumbImg} />
                ) : (
                  <View style={[styles.bgThumbImg, { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="videocam" size={26} color="#a78bfa" />
                  </View>
                )}
                <Text style={styles.bgThumbName} numberOfLines={1}>{bg.nameHe}</Text>
                {backgroundVideoUrl === bg.url && (
                  <View style={styles.bgThumbCheck}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.bgGalleryBtn} onPress={pickBgFromGallery}>
            <Ionicons name="images-outline" size={22} color="white" />
            <Text style={styles.bgGalleryBtnText}>{t('finalVideo.bg_gallery')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0e14',
  },
  fullscreenMode: {
    backgroundColor: '#000',
  },
  fullscreenCubeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(38,40,50,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,155,70,0.18)',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(90,180,204,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5ab4cc',
    letterSpacing: 0.5,
  },
  storyName: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(240,195,90,1.0)',
    marginTop: 4,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(220,170,60,0.40)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(90,180,204,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatText: {
    color: '#5ab4cc',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  videoContainer: {
    backgroundColor: 'rgba(15,17,26,1)',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.15)',
  },
  cubeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[4],
    minHeight: 400,
    width: '100%',
    position: 'relative',
  },
  cubeFullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 0,
    zIndex: 1000,
    backgroundColor: '#000',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: theme.colors.border || '#E5E7EB',
    borderRadius: 4,
    marginTop: theme.spacing[3],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.error || '#EF4444',
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.md,
    marginTop: theme.spacing[4],
    gap: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  musicGeneratingBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    zIndex: 100,
  },
  musicGeneratingText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  cubePlayButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  playButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  cubePlayText: {
    marginTop: theme.spacing[2],
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  cubeProgressText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  activeVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderRadius: theme.radii.lg,
  },
  overlayVideo: {
    width: '95%',
    height: '85%',
    borderRadius: 12,
  },
  videoCounter: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoCounterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeVideoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectedVideoContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  projectedVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  projectedVideoFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#8446b0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 12,
  },
  videoScreenBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    pointerEvents: 'none',
  },
  projectedVideo: {
    width: '100%',
    height: '100%',
  },
  projectedVideoCounter: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectedVideoCounterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  fullscreenVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideoFrame: {
    width: '92%',
    aspectRatio: 9/16,
    maxHeight: '85%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8446b0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayerNameBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  videoPlayerNameText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  videoProgressBadge: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  videoProgressText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cubeStatusBadge: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  cubeStatusText: {
    color: 'white',
    fontSize: 12,
  },
  videoPlayer: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreview: {
    height: 220,
    backgroundColor: theme.colors.gradient.end,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoText: {
    color: 'white',
    marginTop: theme.spacing[2],
    fontSize: 14,
  },
  videoInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[6],
    padding: theme.spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  infoText: {
    ...theme.typography.caption,
    color: 'rgba(255,255,255,0.55)',
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    padding: theme.spacing[2],
    backgroundColor: 'rgba(30,80,40,0.35)',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.25)',
  },
  completeText: {
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    padding: theme.spacing[3],
    backgroundColor: 'rgba(38,40,50,0.90)',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
  },
  privacyText: {
    ...theme.typography.body,
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  actionButton: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(38,40,50,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.30)',
  },
  actionLabel: {
    ...theme.typography.caption,
    color: 'rgba(255,255,255,0.80)',
  },
  bottomActions: {
    marginTop: 'auto',
    paddingVertical: theme.spacing[3],
  },
  homeButton: {
    alignItems: 'center',
    marginTop: theme.spacing[3],
  },
  homeButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  downloadProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadProgressCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    maxWidth: '80%',
  },
  downloadProgressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  downloadProgressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  endScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(22,24,36,1)',
  },
  endScreenBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,24,36,1)',
  },
  endScreenGradient: {
    width: '100%',
    height: '100%',
  },
  endScreenLogo: {
    width: SCREEN_WIDTH - 40,
    height: 90,
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 0,
  },
  endScreenScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  endScreenText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'rgba(200,155,70,0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  endScreenSubtext: {
    fontSize: 17,
    color: 'rgba(200,155,70,0.75)',
    marginTop: 6,
    fontWeight: '500',
  },
  endScreenActionsCard: {
    width: '100%',
    backgroundColor: 'rgba(34,37,52,0.95)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.18)',
    alignItems: 'center',
  },
  recordingReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(90,180,204,0.15)',
  },
  recordingReadyText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  endScreenDivider: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(200,155,70,0.35)',
    marginVertical: 14,
    borderRadius: 1,
  },
  endScreenSectionTitle: {
    fontSize: 13,
    color: 'rgba(200,155,70,0.85)',
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  endScreenActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 12,
  },
  endScreenActionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  endScreenIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5ab4cc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5ab4cc',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 4,
  },
  endScreenActionLabel: {
    color: 'rgba(200,155,70,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  endScreenSocials: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 12,
  },
  socialBtn: {
    alignItems: 'center',
    gap: 6,
  },
  socialIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  socialLabel: {
    color: 'rgba(200,155,70,0.80)',
    fontSize: 10,
    fontWeight: '500',
  },
  privateWatermark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  privateWatermarkText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
  socialNoConsentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(200,155,70,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.18)',
  },
  socialNoConsentText: {
    color: 'rgba(200,155,70,0.70)',
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  remixMusicSection: {
    width: '100%',
    backgroundColor: 'rgba(28,30,44,0.90)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
  },
  remixMusicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  remixMusicTitle: {
    color: 'rgba(200,155,70,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  remixMusicInput: {
    backgroundColor: 'rgba(15,17,28,0.80)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.25)',
  },
  remixMusicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5ab4cc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  remixMusicBtnText: {
    color: '#040c18',
    fontSize: 14,
    fontWeight: '700',
  },
  engineToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  engineToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.25)',
    backgroundColor: 'rgba(90,180,204,0.06)',
  },
  engineToggleBtnActive: {
    backgroundColor: 'rgba(90,180,204,0.25)',
    borderColor: '#5ab4cc',
  },
  engineToggleBtnText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  engineToggleBtnTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  hdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(200,155,70,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.20)',
  },
  hdBannerText: {
    fontSize: 12,
    color: 'rgba(200,155,70,0.80)',
  },
  endScreenBottomBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  endScreenPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5ab4cc',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
  },
  endScreenPrimaryBtnText: {
    color: '#040c18',
    fontSize: 14,
    fontWeight: 'bold',
  },
  endScreenSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,155,70,0.18)',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(228,180,85,0.55)',
  },
  endScreenSecondaryBtnText: {
    color: '#5ab4cc',
    fontSize: 15,
    fontWeight: '600',
  },
  recordGuideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  recordGuideIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  recordGuideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  recordGuideDesc: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  recordGuideSteps: {
    width: '100%',
    marginBottom: 32,
  },
  recordGuideStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FF6666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    lineHeight: 21,
  },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF4444',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  recordStartBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordCancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  recordCancelBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#FF4444',
    textShadowColor: 'rgba(255, 68, 68, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownLabel: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  musicErrorContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(80,40,120,0.88)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  musicErrorTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  musicErrorText: {
    fontSize: 15,
    color: theme.colors.subtext,
    textAlign: 'center',
    lineHeight: 22,
  },
  musicErrorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  musicErrorRetryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bgModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bgModalSheet: {
    backgroundColor: theme.colors.card || '#1e1e2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingTop: 16,
  },
  bgModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  bgModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  bgPickerScroll: {
    paddingLeft: 16,
  },
  bgPickerContent: {
    paddingRight: 16,
    gap: 10,
  },
  bgThumb: {
    width: 88,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 4,
  },
  bgThumbSelected: {
    borderColor: theme.colors.primary,
  },
  bgThumbImg: {
    width: 80,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
  },
  bgThumbName: {
    color: theme.colors.subtext || '#aaa',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },
  bgThumbCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  bgGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 13,
  },
  bgGalleryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  /* ── HD Modal ── */
  hdModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  hdModalCard: {
    backgroundColor: '#0d0e14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.20)',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  hdModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(200,155,70,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  hdModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(200,155,70,0.95)',
    marginBottom: 4,
  },
  hdModalSub: {
    fontSize: 13,
    color: 'rgba(200,155,70,0.55)',
    marginBottom: 20,
  },
  hdModalBullets: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  hdModalBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hdModalBulletText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  hdModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,155,70,0.90)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hdModalBtnText: {
    color: '#040c18',
    fontSize: 16,
    fontWeight: '800',
  },
  hdModalRenderingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  hdModalRenderingText: {
    color: 'rgba(200,155,70,0.90)',
    fontSize: 15,
    fontWeight: '600',
  },
  hdModalRenderingHint: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 12,
  },
  hdModalDismiss: {
    paddingVertical: 8,
  },
  hdModalDismissText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
});
