import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
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
  const videoRef = useRef(null);
  const fullscreenVideoRef = useRef(null);

  const storyData = playerStoryData || navigationParams || {};
  const storyName = storyData.name || storyData.storyName || 'הסיפור';
  const creatorName = storyData.creatorName || 'חבר';
  const instructions = storyData.instructions || 'שתף את החוויה שלך';
  const videoUri = storyData.videoUri || storyData.videoUrl || storyData.keyStoryUrl || null;

  const handlePlayPause = async () => {
    if (!videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      if (status.didJustFinish || status.positionMillis >= status.durationMillis) {
        await videoRef.current.replayAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(true);
    }
  };

  const handlePlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setIsBuffering(status.isBuffering);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setHasWatched(true);
        setIsPlaying(false);
      }
    }
  };

  const handleContinue = () => {
    go('PlayerRecord');
  };

  const handleOpenFullscreen = async () => {
    if (videoRef.current) {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) await videoRef.current.pauseAsync();
    }
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = async () => {
    if (fullscreenVideoRef.current) {
      await fullscreenVideoRef.current.pauseAsync();
    }
    setIsFullscreen(false);
  };

  const handleFullscreenPlayPause = async () => {
    if (!fullscreenVideoRef.current) return;
    const status = await fullscreenVideoRef.current.getStatusAsync();
    if (status.isPlaying) {
      await fullscreenVideoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      if (status.didJustFinish || status.positionMillis >= status.durationMillis) {
        await fullscreenVideoRef.current.replayAsync();
      } else {
        await fullscreenVideoRef.current.playAsync();
      }
      setIsPlaying(true);
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

      <View style={styles.content}>
        <View style={styles.videoContainer}>
          {videoUri ? (
            <>
              <TouchableOpacity
                style={styles.videoWrapper}
                activeOpacity={0.9}
                onPress={handlePlayPause}
              >
                <Video
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  onLoad={() => setIsBuffering(false)}
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
                    <Video
                      ref={fullscreenVideoRef}
                      source={{ uri: videoUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay
                      onPlaybackStatusUpdate={(s) => {
                        if (s.isLoaded) {
                          setIsPlaying(s.isPlaying);
                          if (s.didJustFinish) { setHasWatched(true); setIsPlaying(false); }
                        }
                      }}
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
        </View>

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

        {!hasWatched && !isPlaying && (
          <Text style={styles.hint}>
            {t('playerView.hint')}
          </Text>
        )}
      </View>
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
    padding: theme.spacing[4],
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
  actions: {
    marginTop: 'auto',
    paddingTop: theme.spacing[4],
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
