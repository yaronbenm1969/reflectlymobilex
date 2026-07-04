import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';
import storageService from '../services/storageService';
import reflectionsService from '../services/reflectionsService';
import { storiesService } from '../services/storiesService';
import { notificationsService } from '../services/notificationsService';
import { analyticsService } from '../services/analyticsService';

import { useTranslation } from 'react-i18next';
import { AppButton } from '../ui/AppButton';
import { VideoFactoryWaiting } from '../components/VideoFactoryWaiting';
import theme from '../theme/theme';
import Constants from 'expo-constants';

const isWeb = Platform.OS === 'web';

const WAITING_TRACKS = [
  'reflective-space', 'gentle-warmth', 'soft-hope', 'tender-vulnerability',
  'quiet-strength', 'light-movement', 'floating-memory', 'subtle-uplift',
  'open-horizon', 'electric-pulse', 'world-celebration',
];
const randomWaitingTrack = () => WAITING_TRACKS[Math.floor(Math.random() * WAITING_TRACKS.length)];

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.videoConverterUrl ||
  'https://reflectlymobilex.onrender.com';
const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
const SERVER_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  ...(process.env.EXPO_PUBLIC_ACCESS_CODE ? { 'x-app-access-code': process.env.EXPO_PUBLIC_ACCESS_CODE } : {}),
};
const { width, height } = Dimensions.get('window');

let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  Haptics = {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success' },
  };
}

export const PlayerRecordScreen = () => {
  const { t } = useTranslation();
  const { go, back } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  const playerStoryData = useAppState((state) => state.playerStoryData);
  const playerStoryId = useAppState((state) => state.playerStoryId);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const storyIdForMusic = playerStoryId || currentStoryId;

  const selectedMusic = useAppState((state) => state.selectedMusic);
  const preferredMusicEngine = useAppState((state) => state.preferredMusicEngine);
  const storyClipCount = useAppState((state) => state.storyClipCount);
  const storyMaxClipDuration = useAppState((state) => state.storyMaxClipDuration);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');

  // Clip count: from playerStoryData (deep link), Zustand (creator flow), or default 3
  const clipCount = playerStoryData?.clipCount || storyClipCount || 3;
  // Clip duration: from playerStoryData, Zustand, or per-clip navigationParams, or default 60
  const maxClipDuration = playerStoryData?.maxClipDuration || storyMaxClipDuration || 60;
  const clipTimes = Array.from({ length: clipCount }, () => maxClipDuration);

  const [resolvedTrackUrl, setResolvedTrackUrl] = useState(null);
  const [resolvedTrackId, setResolvedTrackId] = useState(null);

  // Audio instruction playback
  const [isPlayingInstruction, setIsPlayingInstruction] = useState(false);
  const instructionSoundRef = useRef(null);

  const playInstructionAudio = async () => {
    const audioUrl = playerStoryData?.instructionAudioUrl || navigationParams?.instructionAudioUrl;
    if (!audioUrl) return;
    try {
      if (instructionSoundRef.current) {
        await instructionSoundRef.current.unloadAsync();
        instructionSoundRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { volume: 1.0 });
      instructionSoundRef.current = sound;
      setIsPlayingInstruction(true);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.didJustFinish) setIsPlayingInstruction(false);
      });
    } catch (e) {
      console.error('Instruction audio play failed', e);
      setIsPlayingInstruction(false);
    }
  };
  useEffect(() => {
    if (!playerStoryData) return;
    const stored = playerStoryData?.musicAmbient?.url;
    if (stored) { setResolvedTrackUrl(stored); return; }
    const lockedSet = playerStoryData?.lockedSet;
    if (!lockedSet) { setResolvedTrackId(randomWaitingTrack()); return; }
    // musicAmbient.url missing — try server, fallback to library track
    fetch(`${API_BASE_URL}/api/suno-sets`, { headers: SERVER_HEADERS })
      .then(r => r.json())
      .then(data => {
        const found = data.sets?.find(s => s.set === lockedSet);
        if (found?.previewUrl) setResolvedTrackUrl(found.previewUrl);
        else setResolvedTrackId(randomWaitingTrack());
      })
      .catch(() => setResolvedTrackId(randomWaitingTrack()));
  }, [playerStoryData]);
  const ambient = useAmbientPlayback(resolvedTrackId, resolvedTrackUrl);
  const [waitingTrackId, setWaitingTrackId] = useState(null);
  const waitingAmbient = useAmbientPlayback(waitingTrackId);

  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const [clipRecordings, setClipRecordings] = useState(() => Array(clipCount).fill(null));
  // Reset clip slots if clipCount changes (e.g. story data arrives from Firestore after mount)
  const prevClipCountRef = useRef(clipCount);
  useEffect(() => {
    if (prevClipCountRef.current !== clipCount) {
      prevClipCountRef.current = clipCount;
      setClipRecordings(Array(clipCount).fill(null));
    }
  }, [clipCount]);

  const musicMode = useAppState((state) => state.clipMusicMode);
  const setMusicMode = useAppState((state) => state.setClipMusicMode);
  const setGeneratedMusicUrl = useAppState((state) => state.setGeneratedMusicUrl);
  const [activeClip, setActiveClip] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Consent flow — only for player mode (deep link)
  const [consentState, setConsentState] = useState(null); // null=loading | 'needed' | 'done'
  const [consentLevel, setConsentLevel] = useState(null); // null | 'private' | 'friends' | 'public'
  const participantIdRef = useRef(`participant_${Date.now()}`);

  useEffect(() => {
    // Clear any AI music URL from a previous session (Zustand + Firestore)
    setGeneratedMusicUrl(null);
    if (storyIdForMusic) {
      storiesService.updateStory(storyIdForMusic, { generatedMusicUrl: null }).catch(() => {});
    }
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      ambient.stop();
      waitingAmbient.stop();
    };
  }, []);

  // Play random waiting music during upload
  useEffect(() => {
    if (isUploading) {
      setWaitingTrackId(randomWaitingTrack());
    } else {
      waitingAmbient.stop();
      setWaitingTrackId(null);
    }
  }, [isUploading]);

  useEffect(() => {
    if (waitingTrackId) {
      waitingAmbient.playPhase(1, 0.15);
    }
  }, [waitingTrackId]);

  // Determine whether consent is needed (player mode only)
  useEffect(() => {
    if (!playerStoryId) {
      setConsentState('done'); // creator mode — no consent screen
    }
  }, []);

  useEffect(() => {
    if (!playerStoryId) return;
    if (!playerStoryData) return; // still loading
    const needsConsent = playerStoryData?.privacySettings?.publishingEnabled;
    setConsentState(needsConsent ? 'needed' : 'done');
  }, [playerStoryData]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clipDurationRef = useRef(0);

  const startRecordingClip = async (clipIndex) => {
    if (clipIndex === 0) analyticsService.recordingStarted(storyIdForMusic || playerStoryId);
    if (isWeb) {
      if (musicMode === 'none') { ambient.stop(); }
      else { ambient.playPhase(1, 0.04, true); }
      setActiveClip(clipIndex);
      setIsRecording(true);
      setRecordingTimer(0);
      clipDurationRef.current = 0;
      recordingTimerRef.current = setInterval(() => {
        clipDurationRef.current += 1;
        setRecordingTimer(clipDurationRef.current);
        if (clipDurationRef.current >= clipTimes[clipIndex]) {
          stopRecordingClip(clipIndex);
        }
      }, 1000);
      return;
    }

    if (!cameraRef.current || isRecording) return;

    try {
      setActiveClip(clipIndex);
      setIsRecording(true);
      setRecordingTimer(0);
      clipDurationRef.current = 0;

      recordingTimerRef.current = setInterval(() => {
        clipDurationRef.current += 1;
        setRecordingTimer(clipDurationRef.current);
      }, 1000);

      if (musicMode === 'none') { ambient.stop(); }
      else { ambient.playPhase(1, 0.04, true); }

      const video = await cameraRef.current.recordAsync({
        maxDuration: clipTimes[clipIndex],
        codec: 'avc1',
      });

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      ambient.fadeOut(1500);

      if (video && video.uri) {
        console.log(`✅ Clip ${clipIndex + 1} recorded: ${video.uri} (${clipDurationRef.current}s)`);
        setClipRecordings(prev => {
          const updated = [...prev];
          updated[clipIndex] = { uri: video.uri, duration: clipDurationRef.current };
          return updated;
        });
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      }

      setIsRecording(false);
      setActiveClip(null);
    } catch (error) {
      console.error('Recording error:', error);
      setIsRecording(false);
      setActiveClip(null);
      Alert.alert(t('common.error'), t('playerRecord.error_recording'));
    }
  };

  const stopRecordingClip = async (clipIndex) => {
    if (isWeb) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      ambient.fadeOut(1000);
      setClipRecordings(prev => {
        const updated = [...prev];
        updated[clipIndex] = { uri: 'web-demo', duration: clipDurationRef.current };
        return updated;
      });
      setIsRecording(false);
      setActiveClip(null);
      return;
    }

    if (cameraRef.current) {
      try {
        await cameraRef.current.stopRecording();
      } catch (e) {}
    }
  };

  const toggleCameraType = async () => {
    try { await Haptics.selectionAsync(); } catch (e) {}
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleSubmit = async () => {
    ambient.stop();
    const recorded = clipRecordings.filter(r => r !== null);

    if (recorded.length === 0) {
      Alert.alert(t('playerRecord.error_no_clips_title'), t('playerRecord.error_no_clips'));
      return;
    }

    if (!storyIdForMusic) {
      go('ThankYou', {
        recordedCount: recorded.length,
        creatorName: playerStoryData?.creatorName || navigationParams?.creatorName,
        storyName: playerStoryData?.name || navigationParams?.storyName,
      });
      return;
    }

    setIsUploading(true);
    const participantId = participantIdRef.current;
    let uploadedCount = 0;
    const uploadedUrls = [];

    try {
      for (let i = 0; i < clipRecordings.length; i++) {
        const clip = clipRecordings[i];
        if (!clip || clip.uri === 'web-demo') continue;

        setUploadProgress(t('playerRecord.uploading_clip', { n: i + 1 }));
        const result = await storageService.uploadPlayerVideo(
          clip.uri,
          storyIdForMusic,
          participantId,
          i + 1,
          (progress) => {
            setUploadProgress(t('playerRecord.uploading_clip_pct', { n: i + 1, pct: Math.round(progress) }));
          }
        );

        if (result.success) {
          const participantName = playerStoryData?.participantName || navigationParams?.participantName || null;
          await reflectionsService.saveReflection(
            playerStoryId,
            i + 1,
            result.url,
            participantId,
            participantName
          );
          uploadedUrls.push(result.url);
          uploadedCount++;
        } else {
          console.error(`Upload failed for clip ${i + 1}:`, result.error);
        }
      }

      if (uploadedCount > 0) analyticsService.clipSubmitted(storyIdForMusic || playerStoryId, uploadedCount);
      // Notify story creator about new clips
      if (storyIdForMusic && uploadedCount > 0) {
        const participantName = playerStoryData?.participantName || navigationParams?.participantName || null;
        fetch(getApiUrl('/api/notify-reflection'), {
          method: 'POST', headers: SERVER_HEADERS,
          body: JSON.stringify({ storyId: storyIdForMusic, playerName: participantName }),
        }).catch(() => {});
      }

      // Save push token so server can notify when video is ready
      if (storyIdForMusic) {
        notificationsService.registerForPushNotifications().then(token => {
          if (token) storiesService.updateStory(storyIdForMusic, { pushToken: token }).catch(() => {});
        });
      }

      // Fire-and-forget: generate AI music in background from uploaded clips
      if (uploadedUrls.length > 0 && storyIdForMusic) {
        (async () => {
          try {
            console.log(`🎵 Starting background music generation (${uploadedUrls.length} clips)...`);
            let transcriptionSegments = null;
            let totalDuration = 60;
            try {
              const transcribeRes = await fetch(getApiUrl('/api/transcribe-from-urls'), {
                method: 'POST', headers: SERVER_HEADERS,
                body: JSON.stringify({ clipUrls: uploadedUrls }),
              });
              const transcribeJson = await transcribeRes.json();
              if (transcribeJson.success && transcribeJson.segments?.length > 0) {
                transcriptionSegments = transcribeJson.segments;
                totalDuration = transcribeJson.totalDuration || totalDuration;
              }
            } catch (e) { console.warn('Transcription failed:', e.message); }
            const genRes = await fetch(getApiUrl('/api/generate-music'), {
              method: 'POST', headers: SERVER_HEADERS,
              body: JSON.stringify({ storyId: storyIdForMusic, totalDuration, numClips: uploadedUrls.length, style: selectedMusic || undefined, musicEngine: preferredMusicEngine || 'suno', ...(transcriptionSegments && { transcriptionSegments }), ...(playerStoryData?.lockedSet != null && { lockedSet: playerStoryData.lockedSet }) }),
            });
            const genJson = await genRes.json();
            const musicJobId = genJson.jobId;
            if (!musicJobId) { console.warn('No music jobId'); return; }
            for (let i = 0; i < 100; i++) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const statusRes = await fetch(getApiUrl(`/api/music-status/${musicJobId}`), { headers: SERVER_HEADERS });
                const statusJson = await statusRes.json();
                if (statusJson.status === 'completed' && statusJson.musicUrl) {
                  await storiesService.updateStory(storyIdForMusic, { generatedMusicUrl: statusJson.musicUrl });
                  console.log('✅ Background music saved to Firestore:', statusJson.musicUrl.substring(0, 60));
                  return;
                }
                if (statusJson.status === 'failed') return;
              } catch (e) {}
            }
          } catch (err) { console.warn('Background music generation error:', err.message); }
        })();
      }

      setIsUploading(false);
      go('ThankYou', {
        recordedCount: uploadedCount,
        creatorName: playerStoryData?.creatorName || navigationParams?.creatorName,
        storyName: playerStoryData?.name || navigationParams?.storyName,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      Alert.alert(t('playerRecord.error_upload_title'), t('playerRecord.error_upload'));
    }
  };

  const recordedCount = clipRecordings.filter(r => r !== null).length;

  const handleConsentGiven = () => {
    if (!consentLevel) return;
    setConsentState('done');
    if (playerStoryId) {
      storiesService.updateStory(playerStoryId, {
        [`playerConsents.${participantIdRef.current}`]: {
          consented: true,
          consentLevel,
          timestamp: Date.now(),
          participantName: playerStoryData?.participantName || null,
        },
      }).catch(() => {});
    }
  };

  // Waiting for story data to determine consent requirement
  if (playerStoryId && consentState === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.permissionText}>{t('playerRecord.loading_story')}</Text>
      </View>
    );
  }

  // Player must consent before recording
  if (consentState === 'needed') {
    const creatorName = playerStoryData?.creatorName || t('playerRecord.creator_fallback');
    return (
      <View style={styles.consentContainer}>
        <View style={styles.consentHeader}>
          <Ionicons name="shield-checkmark-outline" size={56} color={theme.colors.accent} />
          <Text style={styles.consentTitle}>{t('playerRecord.consent_title')}</Text>
        </View>

        <Text style={styles.consentBody}>
          {t('playerRecord.consent_body', { creatorName })}
        </Text>

        {['private', 'friends', 'public'].map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.consentOption, consentLevel === level && styles.consentOptionSelected]}
            onPress={() => setConsentLevel(level)}
            activeOpacity={0.7}
          >
            <View style={[styles.consentRadio, consentLevel === level && styles.consentRadioSelected]}>
              {consentLevel === level && <View style={styles.consentRadioDot} />}
            </View>
            <View style={styles.consentOptionText}>
              <Text style={styles.consentOptionTitle}>{t(`playerRecord.consent_level_${level}`)}</Text>
              <Text style={styles.consentOptionDesc}>{t(`playerRecord.consent_level_${level}_desc`)}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <AppButton
          title={t('playerRecord.consent_approve')}
          onPress={handleConsentGiven}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!consentLevel}
        />

        <TouchableOpacity style={styles.consentDeclineBtn} onPress={() => back()}>
          <Text style={styles.consentDeclineText}>{t('playerRecord.consent_decline')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.permissionText}>{t('playerRecord.checking_permissions')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera" size={64} color={theme.colors.primary} />
        <Text style={styles.permissionText}>{t('playerRecord.permission_text')}</Text>
        <AppButton
          title={t('playerRecord.btn_grant')}
          onPress={requestPermission}
          variant="primary"
          size="lg"
        />
      </View>
    );
  }

  if (isUploading) {
    return (
      <VideoFactoryWaiting
        estimatedSeconds={60}
        storyName={playerStoryData?.name || navigationParams?.storyName}
        title={t('playerRecord.uploading_title')}
        message={uploadProgress}
      />
    );
  }

  if (activeClip !== null) {
    const maxTime = clipTimes[activeClip];
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          mode="video"
        >
          <View style={styles.cameraHeader}>
            <View style={styles.clipBadge}>
              <Text style={styles.clipBadgeText}>{t('playerRecord.camera_clip_badge', { n: activeClip + 1, total: clipCount })}</Text>
            </View>

            <TouchableOpacity style={styles.cameraHeaderButton} onPress={toggleCameraType}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
              <Text style={styles.timerText}>{formatTime(recordingTimer)}</Text>
            </View>
          )}

          {isRecording && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${(recordingTimer / maxTime) * 100}%` },
                ]}
              />
            </View>
          )}

          {ambient.hasTrack && ambient.isPlaying && (
            <View style={styles.musicBadge}>
              <Ionicons name="musical-notes" size={14} color="white" />
              <Text style={styles.musicBadgeText}>{t('playerRecord.camera_music_badge')}</Text>
            </View>
          )}

          <View style={styles.cameraControls}>
            <Text style={styles.maxTimeHint}>
              {isRecording
                ? t('playerRecord.camera_timer', { current: formatTime(recordingTimer), max: formatTime(maxTime) })
                : t('playerRecord.camera_until', { time: formatTime(maxTime) })}
            </Text>
            <View style={styles.recordRow}>
              <TouchableOpacity
                style={[
                  styles.recordBtn,
                  isRecording && styles.recordBtnActive,
                ]}
                onPress={() => {
                  if (isRecording) {
                    stopRecordingClip(activeClip);
                  } else {
                    startRecordingClip(activeClip);
                  }
                }}
              >
                <View
                  style={[
                    styles.recordBtnInner,
                    isRecording && styles.recordBtnInnerActive,
                  ]}
                />
              </TouchableOpacity>
              {activeClip > 0 && !isRecording && (
                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={() => setActiveClip(null)}
                >
                  <Ionicons name="play-skip-forward" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.skipBtnText}>{t('playerRecord.camera_skip')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.recordHint}>
              {isRecording ? t('playerRecord.camera_stop') : t('playerRecord.camera_record')}
            </Text>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('playerRecord.header_title')}</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{t('playerRecord.intro_title')}</Text>
          <Text style={styles.introBody}>
            {t('playerRecord.intro_body', { count: clipCount })}
          </Text>
          <Text style={styles.introEmphasize}>{t('playerRecord.intro_emphasize')}</Text>
          {!!(playerStoryData?.instructions || navigationParams?.instructions) && (
            <View style={styles.introInstructions}>
              <Ionicons name="chatbubble-ellipses" size={16} color={theme.colors.primary} />
              <Text style={styles.introInstructionsText}>
                {playerStoryData?.instructions || navigationParams?.instructions}
              </Text>
            </View>
          )}
          {!!(playerStoryData?.instructionAudioUrl || navigationParams?.instructionAudioUrl) && (
            <TouchableOpacity
              style={styles.listenInstructionBtn}
              onPress={playInstructionAudio}
              disabled={isPlayingInstruction}
            >
              <Ionicons
                name={isPlayingInstruction ? 'volume-high' : 'headset'}
                size={18}
                color="white"
              />
              <Text style={styles.listenInstructionText}>
                {isPlayingInstruction ? t('playerRecord.playing_instruction') : t('playerRecord.listen_instruction')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Music — creator's chosen track + mode selection */}
        {ambient.hasTrack && (
          <View style={styles.musicPanel}>
            {/* Track preview row */}
            <View style={styles.musicPanelHeader}>
              <Ionicons name="musical-notes" size={18} color={theme.colors.accent} />
              <Text style={styles.musicPanelTitle} numberOfLines={1}>
                {playerStoryData?.musicAmbient?.nameHe || playerStoryData?.musicAmbient?.name || 'מוזיקה'}
              </Text>
              <TouchableOpacity
                style={[styles.previewPlayBtn, ambient.isPlaying && styles.previewPlayBtnActive]}
                onPress={() => ambient.isPlaying ? ambient.stop() : ambient.playPhase(1, 0.4)}
              >
                <Ionicons
                  name={ambient.isPlaying ? 'pause' : 'play'}
                  size={16}
                  color={ambient.isPlaying ? '#fff' : theme.colors.accent}
                />
              </TouchableOpacity>
            </View>
            {/* Mode buttons */}
            <View style={styles.musicModeRow}>
              <TouchableOpacity
                style={[styles.musicModeBtn, musicMode === 'performance' && styles.musicModeBtnActive]}
                onPress={() => setMusicMode('performance')}
              >
                <Ionicons name="mic" size={16} color={musicMode === 'performance' ? '#fff' : theme.colors.accent} />
                <Text style={[styles.musicModeBtnText, musicMode === 'performance' && styles.musicModeBtnTextActive]}>
                  🎤 שיר עם מוזיקה
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.musicModeBtn, musicMode === 'none' && styles.musicModeBtnActive]}
                onPress={() => setMusicMode('none')}
              >
                <Ionicons name="volume-mute" size={16} color={musicMode === 'none' ? '#fff' : theme.colors.accent} />
                <Text style={[styles.musicModeBtnText, musicMode === 'none' && styles.musicModeBtnTextActive]}>
                  🔇 ללא מוזיקה
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.clipCards}>
          {Array.from({ length: clipCount }, (_, i) => i).map((i) => {
            const clip = clipRecordings[i];
            const isRecorded = clip !== null;
            return (
              <React.Fragment key={i}>
                <TouchableOpacity
                  style={[
                    styles.clipCard,
                    isRecorded && styles.clipCardRecorded,
                  ]}
                  onPress={() => { setActiveClip(i); }}
                >
                  <View style={[
                    styles.clipIcon,
                    isRecorded && styles.clipIconRecorded,
                  ]}>
                    {isRecorded ? (
                      <Ionicons name="checkmark" size={28} color="white" />
                    ) : (
                      <Ionicons name="videocam" size={28} color={theme.colors.primary} />
                    )}
                  </View>

                  <View style={styles.clipInfo}>
                    <Text style={[
                      styles.clipLabel,
                      isRecorded && styles.clipLabelRecorded,
                    ]}>
                      {t('playerRecord.clip_n', { n: i + 1 })}
                    </Text>
                    <Text style={styles.clipDuration}>
                      {isRecorded
                        ? t('playerRecord.clip_recorded', { duration: clip.duration })
                        : t('playerRecord.clip_duration', { seconds: clipTimes[i] })}
                    </Text>
                  </View>

                  <View style={styles.clipAction}>
                    {isRecorded ? (
                      <Text style={styles.reRecordText}>{t('playerRecord.rerecord')}</Text>
                    ) : (
                      <Ionicons name="arrow-forward" size={24} color={theme.colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            {t('playerRecord.recording_count', { recorded: recordedCount, total: clipCount })}
          </Text>
          <View style={styles.statusDots}>
            {Array.from({ length: clipCount }, (_, i) => i).map((i) => (
              <View
                key={i}
                style={[
                  styles.statusDot,
                  clipRecordings[i] !== null && styles.statusDotFilled,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title={recordedCount === clipCount ? t('playerRecord.btn_submit_all') : t('playerRecord.btn_submit')}
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            fullWidth
            disabled={recordedCount === 0}
          />
        </View>
      </ScrollView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  permissionText: {
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
  },
  consentContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    padding: theme.spacing[6],
    gap: theme.spacing[5],
  },
  consentHeader: {
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  consentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  consentBody: {
    fontSize: 16,
    color: theme.colors.textSecondary || '#555',
    textAlign: 'center',
    lineHeight: 24,
  },
  consentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    backgroundColor: theme.colors.card || '#fff',
    borderRadius: 12,
    padding: theme.spacing[4],
    borderWidth: 1.5,
    borderColor: theme.colors.border || '#e0e0e0',
  },
  consentOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: `${theme.colors.accent}18`,
  },
  consentRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border || '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  consentRadioSelected: {
    borderColor: theme.colors.accent,
  },
  consentRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  consentOptionText: {
    flex: 1,
  },
  consentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  consentOptionDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary || '#888',
    marginTop: 2,
  },
  consentDeclineBtn: {
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
  },
  consentDeclineText: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#888',
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[8],
  },
  introCard: {
    backgroundColor: 'white',
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    borderRightWidth: 4,
    borderRightColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing[2],
    textAlign: 'right',
  },
  introBody: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  introEmphasize: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'right',
    marginTop: theme.spacing[2],
  },
  introInstructions: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  introInstructionsText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.subtext,
    textAlign: 'right',
    lineHeight: 20,
  },
  listenInstructionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing[3],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
  },
  listenInstructionText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  musicIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    backgroundColor: `${theme.colors.accent}15`,
    borderRadius: theme.radii.pill,
    gap: theme.spacing[2],
    alignSelf: 'center',
  },
  musicIndicatorText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '600',
    flex: 1,
  },
  musicModeChange: {
    paddingHorizontal: theme.spacing[2],
  },
  musicModeChangeText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  musicModeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: theme.spacing[4],
  },
  musicModeCard: {
    backgroundColor: theme.colors.surface || '#1a1a2e',
    borderRadius: theme.radii.lg || 16,
    padding: theme.spacing[5] || 20,
    width: '100%',
    gap: theme.spacing[3] || 12,
  },
  musicModeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  musicModeSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary || '#888',
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  musicModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3] || 12,
    borderRadius: theme.radii.md || 12,
    backgroundColor: `${theme.colors.primary}15`,
    gap: theme.spacing[3],
  },
  musicModeOptionPremium: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  musicModeOptionNone: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  musicModeIcon: {
    fontSize: 28,
  },
  musicModeInfo: {
    flex: 1,
    gap: 2,
  },
  musicModeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  musicModeDesc: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary || '#888',
  },
  premiumTag: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  clipCards: {
    gap: theme.spacing[3],
  },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    ...theme.shadows.sm,
  },
  clipCardRecorded: {
    backgroundColor: '#E8F5E9',
  },
  clipIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipIconRecorded: {
    backgroundColor: '#4CAF50',
  },
  clipInfo: {
    flex: 1,
    marginLeft: theme.spacing[3],
  },
  clipLabel: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  clipLabelRecorded: {
    color: '#2E7D32',
  },
  clipDuration: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  clipAction: {
    marginLeft: theme.spacing[2],
  },
  reRecordText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  musicBoostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: `${theme.colors.accent}18`,
    gap: 5,
  },
  musicBoostRowActive: {
    backgroundColor: theme.colors.accent,
  },
  musicBoostText: {
    fontSize: 11,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  musicBoostTextActive: {
    color: '#fff',
  },
  trackPickerWrap: {
    marginBottom: theme.spacing[3],
    width: '100%',
  },
  trackPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.accent,
    marginBottom: 8,
  },
  trackScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: `${theme.colors.accent}15`,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}35`,
  },
  trackChipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  trackChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  trackChipTextSelected: {
    color: '#fff',
  },
  musicPanel: {
    backgroundColor: `${theme.colors.primary}12`,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[4],
    borderWidth: 1,
    borderColor: `${theme.colors.primary}25`,
    gap: theme.spacing[2],
  },
  musicPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  musicModeRow: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
  musicModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: theme.radii.md,
    backgroundColor: `${theme.colors.accent}18`,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}35`,
  },
  musicModeBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  musicModeBtnText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  musicModeBtnTextActive: {
    color: '#fff',
  },
  musicPlayBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicPanelInfo: {
    flex: 1,
    gap: 2,
  },
  musicPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  previewPlayBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${theme.colors.accent}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  previewPlayBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  musicPanelHint: {
    fontSize: 11,
    color: theme.colors.subtext || theme.colors.textSecondary || '#888',
  },
  boostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: `${theme.colors.accent}18`,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
  },
  boostBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  boostText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  boostTextActive: {
    color: '#fff',
  },
  status: {
    alignItems: 'center',
    marginTop: theme.spacing[6],
  },
  statusText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  statusDots: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  statusDotFilled: {
    backgroundColor: '#4CAF50',
  },
  actions: {
    marginTop: theme.spacing[6],
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: 50,
  },
  clipBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
  },
  clipBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    left: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.8)',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
    gap: theme.spacing[2],
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timerText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  progressContainer: {
    position: 'absolute',
    top: 130,
    left: theme.spacing[4],
    right: theme.spacing[4],
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ff4444',
    borderRadius: 2,
  },
  musicBadge: {
    position: 'absolute',
    top: 140,
    right: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(70,155,176,0.7)',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    gap: 4,
  },
  musicBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  maxTimeHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: theme.spacing[2],
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnActive: {
    backgroundColor: 'rgba(255,0,0,0.8)',
  },
  recordBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff4444',
  },
  recordBtnInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  recordHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: theme.spacing[2],
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    marginLeft: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  skipBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
});
