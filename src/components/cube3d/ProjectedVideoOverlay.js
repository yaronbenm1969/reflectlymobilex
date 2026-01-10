import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVERLAY_SIZE = SCREEN_WIDTH * 0.5;

const FADE_IN_DURATION = 300;
const FADE_OUT_DURATION = 1000;

export default function ProjectedVideoOverlay({
  videoUri,
  isActive,
  onPlaybackStatusUpdate,
  onVideoEnd,
  onDurationKnown,
  style,
}) {
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasEndedRef = useRef(false);
  const lastVideoUri = useRef(null);

  useEffect(() => {
    if (videoUri !== lastVideoUri.current) {
      lastVideoUri.current = videoUri;
      hasEndedRef.current = false;
      setIsLoaded(false);
      setIsPlaying(false);
      fadeAnim.setValue(0);
    }
  }, [videoUri, fadeAnim]);

  useEffect(() => {
    const prepareVideo = async () => {
      if (!videoRef.current || !videoUri || !isActive) return;

      try {
        console.log('📼 Loading video:', videoUri.substring(0, 50) + '...');
        await videoRef.current.loadAsync(
          { uri: videoUri },
          { shouldPlay: false },
          false
        );
        setIsLoaded(true);
        console.log('✅ Video loaded successfully');

        const status = await videoRef.current.getStatusAsync();
        if (status.durationMillis) {
          console.log(`⏱️ Video duration: ${status.durationMillis}ms`);
          onDurationKnown?.(status.durationMillis);
        }

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: FADE_IN_DURATION,
          useNativeDriver: true,
        }).start(async () => {
          if (videoRef.current) {
            await videoRef.current.playAsync();
            setIsPlaying(true);
          }
        });
      } catch (error) {
        console.log('❌ Video load error:', error.message);
      }
    };

    if (isActive && videoUri) {
      prepareVideo();
    } else if (!isActive && isLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_OUT_DURATION,
        useNativeDriver: true,
      }).start(async () => {
        setIsPlaying(false);
        if (videoRef.current) {
          try {
            await videoRef.current.stopAsync();
            await videoRef.current.unloadAsync();
          } catch (e) {}
        }
        setIsLoaded(false);
      });
    }
  }, [isActive, videoUri, fadeAnim, onDurationKnown, isLoaded]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    onPlaybackStatusUpdate?.(status);

    if (status.isLoaded && status.durationMillis && !hasEndedRef.current) {
      if (status.didJustFinish || (status.positionMillis >= status.durationMillis - 100)) {
        hasEndedRef.current = true;
        console.log('🎬 Video ended, starting fade out');

        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_OUT_DURATION,
          useNativeDriver: true,
        }).start(async () => {
          setIsPlaying(false);
          if (videoRef.current) {
            try {
              await videoRef.current.stopAsync();
              await videoRef.current.unloadAsync();
            } catch (e) {}
          }
          setIsLoaded(false);
          onVideoEnd?.();
        });
      }
    }
  }, [fadeAnim, onPlaybackStatusUpdate, onVideoEnd]);

  if (!videoUri) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={isActive ? 'auto' : 'none'}
    >
      <Video
        ref={videoRef}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping={false}
        isMuted={false}
        progressUpdateIntervalMillis={250}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(error) => console.log('❌ Video error:', error)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...theme.shadows.md,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
