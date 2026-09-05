import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  StatusBar,
  ScrollView,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

const { width } = Dimensions.get('window');

export const PlayerViewScreen = () => {
  const { t } = useTranslation();
  const { go } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  const playerStoryData = useAppState((state) => state.playerStoryData);

  const [hasWatched, setHasWatched] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioSoundRef = useRef(null);

  // Use only playerStoryData (not stale navigationParams) for the player gate
  const storyData = playerStoryData || {};
  const isDataLoaded = !!playerStoryData;
  const storyName = storyData.name || storyData.storyName || navigationParams?.storyName || 'הסיפור';
  const creatorName = storyData.creatorName || 'חבר';
  const instructions = storyData.instructions || '';
  const videoUri = storyData.videoUri || storyData.videoUrl || storyData.keyStoryUrl || null;
  const instructionAudioUrl = storyData.instructionAudioUrl || null;

  // expo-video player — shared between inline and fullscreen VideoView
  const mainPlayer = useVideoPlayer(videoUri ? { uri: videoUri } : null, p => {
    p.loop = false;
  });

  // Subscribe to player events
  useEffect(() => {
    if (!mainPlayer) return;
    const sub1 = mainPlayer.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    const sub2 = mainPlayer.addListener('statusChange', ({ status }) => {
      setIsBuffering(status === 'loading');
      if (status === 'readyToPlay') setIsBuffering(false);
    });
    const sub3 = mainPlayer.addListener('playToEnd', () => {
      setHasWatched(true);
      setIsPlaying(false);
    });
    return () => { sub1.remove(); sub2.remove(); sub3.remove(); };
  }, [mainPlayer]);

  // Only allow skipping if data loaded AND confirmed no video exists
  useEffect(() => {
    if (isDataLoaded && !videoUri) setHasWatched(true);
  }, [isDataLoaded, videoUri]);

  const handlePlayPause = () => {
    if (mainPlayer.playing) {
      mainPlayer.pause();
    } else {
      const atEnd = mainPlayer.duration > 0 && mainPlayer.currentTime >= mainPlayer.duration - 0.1;
      if (atEnd) mainPlayer.currentTime = 0;
      mainPlayer.play();
    }
  };

  const handleContinue = () => {
    go('PlayerRecord');
  };

  const handlePlayInstructionAudio = async () => {
    if (!instructionAudioUrl) return;
    try {
      if (audioSoundRef.current) {
        audioSoundRef.current.remove();
        audioSoundRef.current = null;
        setIsPlayingAudio(false);
        return;
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: instructionAudioUrl });
      player.volume = 1.0;
      audioSoundRef.current = player;
      setIsPlayingAudio(true);
      player.play();
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          player.remove();
          audioSoundRef.current = null;
          setIsPlayingAudio(false);
        }
      });
    } catch (e) {
      setIsPlayingAudio(false);
    }
  };

  const handleOpenFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = () => {
    mainPlayer.pause();
    setIsFullscreen(false);
  };

  const handleFullscreenPlayPause = () => {
    if (mainPlayer.playing) {
      mainPlayer.pause();
    } else {
      const atEnd = mainPlayer.duration > 0 && mainPlayer.currentTime >= mainPlayer.duration - 0.1;
      if (atEnd) mainPlayer.currentTime = 0;
      mainPlayer.play();
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.header}
      >
        <Text style={styles.title}>{t('playerView.title')}</Text>
        <Text style={styles.subtitle}>{t('playerView.subtitle', { creatorName })}</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.videoContainer}>
          {videoUri ? (
            <>
              <TouchableOpacity
                style={styles.videoWrapper}
                activeOpacity={0.9}
                onPress={handlePlayPause}
              >
                <VideoView
                  player={mainPlayer}
                  style={styles.video}
                  contentFit="cover"
                  nativeControls={false}
                />
                {isBuffering && (
                  <View style={styles.bufferingOverlay}>
                    <ActivityIndicator size="large" color="white" />
                  </View>
                )}
                {!isPlaying && !isBuffering && (
                  <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                      <Ionicons
                        name={hasWatched ? "refresh" : "play"}
                        size={48}
                        color="white"
                      />
                    </View>
                  </View>
                )}
                <TouchableOpacity style={styles.fullscreenBtn} onPress={handleOpenFullscreen}>
                  <Ionicons name="expand" size={22} color="white" />
                </TouchableOpacity>
              </TouchableOpacity>

              <Modal
                visible={isFullscreen}
                animationType="fade"
                statusBarTranslucent
                onRequestClose={handleCloseFullscreen}
              >
                <StatusBar hidden />
                <View style={styles.fullscreenContainer}>
                  <TouchableOpacity
                    style={styles.fullscreenVideo}
                    activeOpacity={0.9}
                    onPress={handleFullscreenPlayPause}
                  >
                    <VideoView
                      player={mainPlayer}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                      nativeControls={false}
                    />
                    {!isPlaying && (
                      <View style={styles.playOverlay}>
                        <View style={styles.playButton}>
                          <Ionicons name={hasWatched ? "refresh" : "play"} size={56} color="white" />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fullscreenClose} onPress={handleCloseFullscreen}>
                    <Ionicons name="contract" size={26} color="white" />
                  </TouchableOpacity>
                </View>
              </Modal>
            </>
          ) : (
            <View style={styles.noVideoPlaceholder}>
              <Ionicons name="videocam-off" size={48} color="#999" />
              <Text style={styles.noVideoText}>{t('playerView.no_video')}</Text>
            </View>
          )}
        </View>

        <View style={styles.storyInfo}>
          <Text style={styles.storyName}>{storyName}</Text>
          <Text style={styles.storyCreator}>{t('playerView.by_creator', { creatorName })}</Text>
        </View>

        <View style={styles.instructionsCard}>
          <Ionicons name="chatbubble-ellipses" size={24} color={theme.colors.primary} />
          <Text style={styles.instructionsTitle}>{t('playerView.instructions_label')}</Text>
          <Text style={styles.instructionsText}>{instructions}</Text>
          {!!instructionAudioUrl && (
            <TouchableOpacity style={styles.audioBtn} onPress={handlePlayInstructionAudio}>
              <Ionicons name={isPlayingAudio ? 'stop-circle' : 'headset'} size={20} color="white" />
              <Text style={styles.audioBtnText}>
                {isPlayingAudio ? t('playerView.stop_audio') : t('playerView.play_audio')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isDataLoaded && (
          <View style={styles.loadingHint}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}

        {isDataLoaded && videoUri && !hasWatched && (
          <View style={styles.watchHint}>
            <Ionicons name="play-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.watchHintText}>{t('playerView.watch_first')}</Text>
          </View>
        )}

        {hasWatched && (
          <View style={styles.actions}>
            <AppButton
              title={t('playerView.btn_record')}
              onPress={handleContinue}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingTop: 60,
    paddingBottom: theme.spacing[6],
    paddingHorizontal: theme.spacing[4],
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: theme.spacing[2],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[8],
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  videoWrapper: {
    width: '100%',
    height: 280,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoPlaceholder: {
    height: 220,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  noVideoText: {
    color: '#999',
    fontSize: 16,
  },
  storyInfo: {
    alignItems: 'center',
    marginTop: theme.spacing[4],
  },
  storyName: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  storyCreator: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  instructionsCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    marginTop: theme.spacing[4],
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  instructionsTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[2],
  },
  instructionsText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[2],
    lineHeight: 24,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: theme.spacing[3],
  },
  audioBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  actions: {
    marginTop: theme.spacing[6],
  },
  loadingHint: {
    marginTop: theme.spacing[4],
    alignItems: 'center',
  },
  watchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing[4],
  },
  watchHintText: {
    ...theme.typography.body,
    color: theme.colors.primary,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[4],
  },
  fullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenVideo: {
    flex: 1,
  },
  fullscreenClose: {
    position: 'absolute',
    top: 44,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
});
