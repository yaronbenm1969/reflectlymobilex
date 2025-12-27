import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const PlayerViewScreen = () => {
  const { go } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasWatched, setHasWatched] = useState(false);
  const [progress, setProgress] = useState(0);

  const storyName = navigationParams?.storyName || 'הסיפור';
  const creatorName = navigationParams?.creatorName || 'חבר';
  const instructions = navigationParams?.instructions || 'שתף את החוויה שלך';

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            setHasWatched(true);
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const handlePlay = () => {
    if (progress >= 100) {
      setProgress(0);
    }
    setIsPlaying(true);
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
          <View style={styles.videoPreview}>
            {!isPlaying ? (
              <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
                <Ionicons 
                  name={hasWatched ? "refresh" : "play"} 
                  size={48} 
                  color="white" 
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.playingIndicator}>
                <Ionicons name="volume-high" size={32} color="white" />
                <Text style={styles.playingText}>מתנגן...</Text>
              </View>
            )}
          </View>
          
          {isPlaying && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
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
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  videoPreview: {
    height: 220,
    backgroundColor: '#333',
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
  playingIndicator: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  playingText: {
    color: 'white',
    fontSize: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#ddd',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
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
