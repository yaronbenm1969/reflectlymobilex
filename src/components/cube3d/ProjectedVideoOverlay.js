import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SIZE = Math.min(SCREEN_WIDTH * 0.65, 280);

const computeTransformFromCorners = (corners, baseWidth, baseHeight) => {
  if (!corners || corners.length !== 4) {
    return {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotateY: 0,
      rotateX: 0,
      skewX: 0,
    };
  }

  const [tl, tr, br, bl] = corners;

  const centerX = (tl.x + tr.x + br.x + bl.x) / 4;
  const centerY = (tl.y + tr.y + br.y + bl.y) / 4;

  const topWidth = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
  const bottomWidth = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
  const leftHeight = Math.sqrt(Math.pow(bl.x - tl.x, 2) + Math.pow(bl.y - tl.y, 2));
  const rightHeight = Math.sqrt(Math.pow(br.x - tr.x, 2) + Math.pow(br.y - tr.y, 2));

  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;

  const scaleX = avgWidth / baseWidth;
  const scaleY = avgHeight / baseHeight;

  const widthRatio = topWidth / Math.max(bottomWidth, 1);
  const rotateYDeg = (1 - widthRatio) * 50;

  const heightRatio = leftHeight / Math.max(rightHeight, 1);
  const rotateXDeg = (heightRatio - 1) * 35;

  const topMidX = (tl.x + tr.x) / 2;
  const bottomMidX = (bl.x + br.x) / 2;
  const skewXDeg = Math.atan2(topMidX - bottomMidX, avgHeight) * (180 / Math.PI);

  return {
    translateX: centerX - baseWidth / 2,
    translateY: centerY - baseHeight / 2,
    scaleX: Math.max(0.3, Math.min(2.5, scaleX)),
    scaleY: Math.max(0.3, Math.min(2.5, scaleY)),
    rotateY: Math.max(-70, Math.min(70, rotateYDeg)),
    rotateX: Math.max(-50, Math.min(50, rotateXDeg)),
    skewX: Math.max(-25, Math.min(25, skewXDeg)),
  };
};

export default function ProjectedVideoOverlay({
  videoUri,
  isActive,
  corners,
  visibility = 1,
  playerName,
  onPlaybackStatusUpdate,
  onVideoEnd,
  onDurationKnown,
  cubeContainerOffset = { x: 0, y: 0 },
  style,
}) {
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasEndedRef = useRef(false);
  const lastVideoUri = useRef(null);

  const transform = useMemo(() => {
    return computeTransformFromCorners(corners, BASE_SIZE, BASE_SIZE);
  }, [corners]);

  const animatedTransformStyle = useMemo(() => {
    if (!corners || visibility <= 0.3) {
      return { opacity: 0 };
    }

    return {
      opacity: Math.min(1, visibility),
      transform: [
        { perspective: 800 },
        { translateX: transform.translateX + cubeContainerOffset.x },
        { translateY: transform.translateY + cubeContainerOffset.y },
        { rotateY: `${transform.rotateY}deg` },
        { rotateX: `${transform.rotateX}deg` },
        { scaleX: transform.scaleX },
        { scaleY: transform.scaleY },
      ],
    };
  }, [corners, visibility, transform, cubeContainerOffset]);

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
          duration: 200,
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
        duration: 300,
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
        console.log('🎬 Video ended');

        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
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

  if (!videoUri || visibility <= 0.3) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: BASE_SIZE,
          height: BASE_SIZE,
          opacity: fadeAnim,
        },
        animatedTransformStyle,
        style,
      ]}
      pointerEvents="none"
    >
      <Video
        ref={videoRef}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping={false}
        isMuted={false}
        progressUpdateIntervalMillis={100}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(error) => console.log('❌ Video error:', error)}
      />
      {playerName && (
        <View style={styles.playerBadge}>
          <Text style={styles.playerText}>{playerName}</Text>
        </View>
      )}
      <View style={styles.border} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 12,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
  },
  playerBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  playerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
