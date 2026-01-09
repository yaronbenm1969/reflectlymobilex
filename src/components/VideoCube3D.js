import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Dimensions, StyleSheet, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

export const VideoCube3D = ({
  videos = [],
  width = SCREEN_WIDTH - 40,
  height = 350,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [convertedUrls, setConvertedUrls] = useState({});
  const videoRef = useRef(null);
  
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  console.log('VideoCube3D loaded with', videos.length, 'videos');

  useEffect(() => {
    const convertVideos = async () => {
      const converted = {};
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const url = video.videoUrl || video.url;
        
        if (url && url.includes('.webm')) {
          try {
            const response = await fetch(`${API_URL}/api/convert-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            });
            if (response.ok) {
              const data = await response.json();
              if (data.convertedUrl) {
                converted[i] = data.convertedUrl;
              }
            }
          } catch (error) {
            console.error(`Video ${i} conversion failed:`, error);
            converted[i] = url;
          }
        } else {
          converted[i] = url;
        }
      }
      setConvertedUrls(converted);
    };
    
    if (videos.length > 0) {
      convertVideos();
    }
  }, [videos]);

  const animateRotation = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.cubic),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      rotateAnim.setValue(0);
    });
  }, [rotateAnim, scaleAnim]);

  const handleVideoEnd = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      animateRotation();
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    }
  }, [currentIndex, videos.length, onComplete, animateRotation]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (status.didJustFinish) {
      handleVideoEnd();
    }
  }, [handleVideoEnd]);

  const goToNext = () => {
    if (currentIndex < videos.length - 1) {
      animateRotation();
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      animateRotation();
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
      }, 500);
    }
  };

  const rotateY = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  if (videos.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noVideosText}>אין סרטונים להצגה</Text>
      </View>
    );
  }

  const currentVideo = videos[currentIndex];
  const playerName = currentVideo?.playerName || currentVideo?.participantName || `משתתף ${currentIndex + 1}`;
  const videoUrl = convertedUrls[currentIndex] || currentVideo?.videoUrl || currentVideo?.url;

  return (
    <View style={[styles.container, { width, height: height + 80 }]}>
      <Animated.View 
        style={[
          styles.cubeContainer,
          { 
            width, 
            height,
            transform: [
              { perspective: 1000 },
              { scale: scaleAnim },
              { rotateY: rotateY },
            ]
          }
        ]}
      >
        <View style={styles.faceContainer}>
          {videoUrl ? (
            <Video
              ref={videoRef}
              source={{ uri: videoUrl }}
              style={styles.video}
              resizeMode="cover"
              shouldPlay={isPlaying}
              isLooping={false}
              isMuted={isMuted}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="hourglass" size={40} color="white" />
              <Text style={styles.loadingText}>טוען סרטון...</Text>
            </View>
          )}
          
          <View style={styles.overlay}>
            <View style={styles.playerBadge}>
              <Text style={styles.playerName}>{playerName}</Text>
            </View>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{currentIndex + 1}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.controls}>
        <TouchableOpacity 
          onPress={goToPrevious} 
          style={[styles.navButton, currentIndex === 0 && styles.disabledButton]}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setIsPlaying(prev => !prev)} 
          style={styles.playButton}
        >
          <Ionicons 
            name={isPlaying ? 'pause' : 'play'} 
            size={28} 
            color="white" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setIsMuted(prev => !prev)} 
          style={styles.muteButton}
        >
          <Ionicons 
            name={isMuted ? 'volume-mute' : 'volume-high'} 
            size={22} 
            color="white" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={goToNext} 
          style={[styles.navButton, currentIndex === videos.length - 1 && styles.disabledButton]}
          disabled={currentIndex === videos.length - 1}
        >
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressDots}>
          {videos.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i === currentIndex && styles.activeDot,
                i < currentIndex && styles.completedDot
              ]} 
            />
          ))}
        </View>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {videos.length}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 10,
  },
  cubeContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 157, 0.4)',
  },
  faceContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playerBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  playerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.3,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    backgroundColor: theme.colors.primary,
    width: 16,
  },
  completedDot: {
    backgroundColor: theme.colors.success,
  },
  progressText: {
    color: 'white',
    fontSize: 14,
  },
  noVideosText: {
    color: 'white',
    fontSize: 18,
  },
});

export default VideoCube3D;
