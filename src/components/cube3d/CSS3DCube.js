import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { Video } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUBE_SIZE = Math.min(SCREEN_WIDTH * 0.85, 320);
const HALF_SIZE = CUBE_SIZE / 2;

const FACE_COLORS = [
  '#8446b0',
  '#464fb0',
  '#9B59B6',
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
];

const CSS3DCube = ({ 
  faces = [], 
  autoRotate = true,
  onFaceEnterFront,
  onFaceExitFront,
  onVideoFinished,
  isPlaying = false,
  currentPlayingFaceIndex = -1,
}) => {
  const rotationY = useRef(new Animated.Value(0)).current;
  const rotationX = useRef(new Animated.Value(-15)).current;
  const currentFaceRef = useRef(-1);
  const animationRef = useRef(null);
  const videoRefs = useRef({});
  const [playedFaces, setPlayedFaces] = useState(new Set());

  const getFrontFaceIndex = useCallback((yRotation) => {
    const normalizedY = ((yRotation % 360) + 360) % 360;
    
    if (normalizedY >= 315 || normalizedY < 45) return 0;
    if (normalizedY >= 45 && normalizedY < 135) return 3;
    if (normalizedY >= 135 && normalizedY < 225) return 1;
    if (normalizedY >= 225 && normalizedY < 315) return 2;
    return 0;
  }, []);

  useEffect(() => {
    if (!autoRotate) return;

    let currentY = 0;
    
    const animate = () => {
      currentY += 0.5;
      
      rotationY.setValue(currentY);
      
      const frontFace = getFrontFaceIndex(currentY);
      
      if (frontFace !== currentFaceRef.current) {
        const validFace = faces[frontFace];
        if (validFace?.videoUrl && !playedFaces.has(frontFace)) {
          if (currentFaceRef.current !== -1) {
            onFaceExitFront?.(currentFaceRef.current);
          }
          currentFaceRef.current = frontFace;
          onFaceEnterFront?.(frontFace);
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoRotate, faces, getFrontFaceIndex, onFaceEnterFront, onFaceExitFront, playedFaces]);

  useEffect(() => {
    if (currentPlayingFaceIndex >= 0 && currentPlayingFaceIndex < 6) {
      const videoRef = videoRefs.current[currentPlayingFaceIndex];
      if (videoRef) {
        videoRef.playAsync?.();
      }
    }
  }, [currentPlayingFaceIndex]);

  const handleVideoEnd = (faceIndex) => {
    setPlayedFaces(prev => new Set([...prev, faceIndex]));
    onVideoFinished?.(faceIndex);
  };

  const setVideoRef = (index, ref) => {
    videoRefs.current[index] = ref;
  };

  const renderFace = (faceIndex, transform, faceData) => {
    const isActive = currentPlayingFaceIndex === faceIndex;
    const hasVideo = faceData?.videoUrl;
    
    return (
      <Animated.View
        key={faceIndex}
        style={[
          styles.cubeFace,
          {
            backgroundColor: FACE_COLORS[faceIndex % 6],
            transform: [
              { perspective: 1000 },
              { rotateY: `${transform.rotateY}deg` },
              { rotateX: `${transform.rotateX || 0}deg` },
              { translateZ: HALF_SIZE },
            ],
          },
          isActive && styles.activeFace,
        ]}
      >
        {hasVideo ? (
          <Video
            ref={(ref) => setVideoRef(faceIndex, ref)}
            source={{ uri: faceData.videoUrl }}
            style={styles.faceVideo}
            resizeMode="cover"
            shouldPlay={isActive}
            isLooping={false}
            isMuted={!isActive}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish && isActive) {
                handleVideoEnd(faceIndex);
              }
            }}
          />
        ) : (
          <View style={styles.facePlaceholder}>
            <View style={styles.faceIcon} />
          </View>
        )}
        {faceData?.playerName && (
          <View style={styles.playerNameBadge}>
            <Animated.Text style={styles.playerNameText}>
              {faceData.playerName}
            </Animated.Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const faceTransforms = [
    { rotateY: 0, rotateX: 0 },
    { rotateY: 180, rotateX: 0 },
    { rotateY: 90, rotateX: 0 },
    { rotateY: -90, rotateX: 0 },
    { rotateY: 0, rotateX: 90 },
    { rotateY: 0, rotateX: -90 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.cubeWrapper}>
        <Animated.View
          style={[
            styles.cube,
            {
              transform: [
                { perspective: 1000 },
                { rotateX: rotationX.interpolate({
                    inputRange: [-180, 180],
                    outputRange: ['-180deg', '180deg'],
                  })
                },
                { rotateY: rotationY.interpolate({
                    inputRange: [-360, 360],
                    outputRange: ['-360deg', '360deg'],
                  })
                },
              ],
            },
          ]}
        >
          {faceTransforms.map((transform, index) => 
            renderFace(index, transform, faces[index])
          )}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CUBE_SIZE + 40,
    height: CUBE_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeWrapper: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cube: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    position: 'relative',
  },
  cubeFace: {
    position: 'absolute',
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  activeFace: {
    borderColor: '#FFD700',
    borderWidth: 4,
  },
  faceVideo: {
    width: '100%',
    height: '100%',
  },
  facePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  playerNameBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  playerNameText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CSS3DCube;
