import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image, Text } from 'react-native';
import { Video } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.75, 300);
const HALF_SIZE = CUBE_SIZE / 2;

const FACE_POSITIONS = [
  { rotateY: 0, rotateX: 0, translateZ: HALF_SIZE },
  { rotateY: 180, rotateX: 0, translateZ: HALF_SIZE },
  { rotateY: 90, rotateX: 0, translateZ: HALF_SIZE },
  { rotateY: -90, rotateX: 0, translateZ: HALF_SIZE },
  { rotateY: 0, rotateX: 90, translateZ: HALF_SIZE },
  { rotateY: 0, rotateX: -90, translateZ: HALF_SIZE },
];

const FACE_COLORS = [
  '#FF6B9D',
  '#C06FBB',
  '#9B59B6',
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
];

const CubeFace = ({ 
  faceIndex, 
  position, 
  videoUrl, 
  thumbnailUrl, 
  playerName,
  isActive,
  cubeRotationY,
  cubeRotationX,
}) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const faceAnimatedStyle = useAnimatedStyle(() => {
    const totalRotateY = cubeRotationY.value + position.rotateY;
    const totalRotateX = cubeRotationX.value + position.rotateX;
    
    const radY = (totalRotateY * Math.PI) / 180;
    const radX = (totalRotateX * Math.PI) / 180;
    
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    
    const x = sinY * position.translateZ;
    const y = -sinX * position.translateZ * cosY;
    const z = cosY * cosX * position.translateZ;
    
    const isVisible = z > -HALF_SIZE * 0.3;
    const scale = 1 + (z / (HALF_SIZE * 4));
    
    return {
      transform: [
        { perspective: 1000 },
        { translateX: x },
        { translateY: y },
        { rotateY: `${totalRotateY}deg` },
        { rotateX: `${totalRotateX}deg` },
        { scale: Math.max(0.7, Math.min(1.3, scale)) },
      ],
      opacity: isVisible ? 1 : 0.3,
      zIndex: Math.round(z + 200),
    };
  });

  useEffect(() => {
    if (videoRef.current && isActive && videoUrl) {
      videoRef.current.playAsync?.();
    } else if (videoRef.current && !isActive) {
      videoRef.current.pauseAsync?.();
    }
  }, [isActive, videoUrl]);

  return (
    <Animated.View style={[styles.cubeFace, faceAnimatedStyle]}>
      <View style={[styles.faceContent, { backgroundColor: FACE_COLORS[faceIndex] }]}>
        {thumbnailUrl ? (
          <Image 
            source={{ uri: thumbnailUrl }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : null}
        
        {videoUrl && isActive && (
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.faceVideo}
            resizeMode="cover"
            shouldPlay={true}
            isLooping={false}
            isMuted={false}
            onLoad={() => setIsLoaded(true)}
          />
        )}
        
        {playerName && (
          <View style={styles.playerBadge}>
            <Text style={styles.playerText}>{playerName}</Text>
          </View>
        )}
        
        {!thumbnailUrl && !videoUrl && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🎬</Text>
            <Text style={styles.placeholderText}>סרטון {faceIndex + 1}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const PureCSSCube = ({
  faces = [],
  autoRotate = true,
  rotationSpeed = 15000,
  onFaceChange,
  currentPlayingFaceIndex = -1,
}) => {
  const rotationY = useSharedValue(0);
  const rotationX = useSharedValue(-15);
  const [currentFace, setCurrentFace] = useState(0);

  const updateCurrentFace = useCallback((rotation) => {
    const normalizedY = ((rotation % 360) + 360) % 360;
    let face = 0;
    if (normalizedY >= 315 || normalizedY < 45) face = 0;
    else if (normalizedY >= 45 && normalizedY < 135) face = 2;
    else if (normalizedY >= 135 && normalizedY < 225) face = 1;
    else if (normalizedY >= 225 && normalizedY < 315) face = 3;
    
    if (face !== currentFace) {
      setCurrentFace(face);
      onFaceChange?.(face);
    }
  }, [currentFace, onFaceChange]);

  useEffect(() => {
    if (autoRotate) {
      rotationY.value = withRepeat(
        withTiming(360, {
          duration: rotationSpeed,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotationY);
    }
    
    return () => {
      cancelAnimation(rotationY);
    };
  }, [autoRotate, rotationSpeed, rotationY]);

  return (
    <View style={styles.container}>
      <View style={styles.cubeWrapper}>
        {FACE_POSITIONS.map((position, index) => {
          const faceData = faces[index];
          return (
            <CubeFace
              key={index}
              faceIndex={index}
              position={position}
              videoUrl={faceData?.videoUrl}
              thumbnailUrl={faceData?.thumbnailUrl || faceData?.posterThumbUri}
              playerName={faceData?.playerName}
              isActive={currentPlayingFaceIndex === index}
              cubeRotationY={rotationY}
              cubeRotationX={rotationX}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CUBE_SIZE + 60,
    height: CUBE_SIZE + 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeWrapper: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeFace: {
    position: 'absolute',
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    backfaceVisibility: 'hidden',
  },
  faceContent: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  faceVideo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playerBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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

export default PureCSSCube;
