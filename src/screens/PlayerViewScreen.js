import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

const { width } = Dimensions.get('window');

export const PlayerViewScreen = () => {
  const { go } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  const playerStoryData = useAppState((state) => state.playerStoryData);

  const [hasWatched, setHasWatched] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.header}
      >
        <Text style={styles.title}>הוזמנת לצפות!</Text>
        <Text style={styles.subtitle}>{creatorName} שיתף איתך סיפור</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.videoContainer}>
          {videoUri ? (
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
            </TouchableOpacity>
          ) : (
            <View style={styles.noVideoPlaceholder}>
              <Ionicons name="videocam-off" size={48} color="#999" />
              <Text style={styles.noVideoText}>הסרטון אינו זמין</Text>
            </View>
          )}
        </View>

        <View style={styles.storyInfo}>
          <Text style={styles.storyName}>{storyName}</Text>
          <Text style={styles.storyCreator}>מאת: {creatorName}</Text>
        </View>

        <View style={styles.instructionsCard}>
          <Ionicons name="chatbubble-ellipses" size={24} color={theme.colors.primary} />
          <Text style={styles.instructionsTitle}>ההנחיות שלך:</Text>
          <Text style={styles.instructionsText}>{instructions}</Text>
        </View>

        {hasWatched && (
          <View style={styles.actions}>
            <AppButton
              title="צפיתי! אני רוצה להקליט"
              onPress={handleContinue}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        )}

        {!hasWatched && !isPlaying && (
          <Text style={styles.hint}>
            לחץ על הסרטון כדי לצפות
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
    aspectRatio: 9 / 16,
    maxHeight: 300,
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
});
