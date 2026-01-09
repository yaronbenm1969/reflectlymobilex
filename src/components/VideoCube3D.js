import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import { CubeNavigationHorizontal } from 'react-native-3dcube-navigation';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const VideoFace = ({ item, index, isActive, onVideoEnd }) => {
  const videoRef = useRef(null);
  const [convertedUrl, setConvertedUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  const rawVideoUrl = item.videoUrl || item.url;
  const playerName = item.playerName || item.participantName || `משתתף ${index + 1}`;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const convertIfNeeded = async () => {
      if (rawVideoUrl && rawVideoUrl.includes('.webm') && !convertedUrl) {
        setIsConverting(true);
        try {
          const response = await fetch(`${API_URL}/api/convert-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: rawVideoUrl })
          });
          if (response.ok && isMountedRef.current) {
            const data = await response.json();
            if (data.convertedUrl) {
              setConvertedUrl(data.convertedUrl);
            }
          }
        } catch (error) {
          console.error(`Video ${index} conversion failed:`, error);
        }
        if (isMountedRef.current) {
          setIsConverting(false);
        }
      } else if (rawVideoUrl && !rawVideoUrl.includes('.webm')) {
        setConvertedUrl(rawVideoUrl);
      }
    };
    convertIfNeeded();
  }, [rawVideoUrl, index]);

  useEffect(() => {
    const controlPlayback = async () => {
      if (!videoRef.current || !isMountedRef.current) return;
      
      try {
        if (isActive && convertedUrl && isLoaded) {
          await videoRef.current.playAsync();
        } else if (!isActive && isLoaded) {
          await videoRef.current.pauseAsync();
          await videoRef.current.setPositionAsync(0);
        }
      } catch (error) {
        console.log('Playback error:', error.message);
      }
    };
    controlPlayback();
  }, [isActive, convertedUrl, isLoaded]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (!isMountedRef.current) return;
    
    if (status.isLoaded && !isLoaded) {
      setIsLoaded(true);
    }
    
    if (status.didJustFinish && onVideoEnd) {
      setTimeout(() => {
        if (isMountedRef.current) {
          onVideoEnd(index);
        }
      }, 500);
    }
  }, [onVideoEnd, index, isLoaded]);

  const gradientColors = [
    ['#FF6B9D', '#C06FBB'],
    ['#4ECDC4', '#44A08D'],
    ['#667EEA', '#764BA2'],
    ['#F093FB', '#F5576C'],
    ['#4FACFE', '#00F2FE'],
    ['#43E97B', '#38F9D7'],
  ];

  const [color1, color2] = gradientColors[index % gradientColors.length];

  return (
    <View style={[styles.face, { backgroundColor: color1 }]}>
      <View style={styles.faceGradient}>
        {isConverting ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="sync" size={48} color="white" />
            <Text style={styles.loadingText}>ממיר סרטון...</Text>
            <Text style={styles.playerName}>{playerName}</Text>
          </View>
        ) : convertedUrl ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: convertedUrl }}
              style={styles.video}
              resizeMode="cover"
              shouldPlay={false}
              isLooping={false}
              onLoad={() => setIsLoaded(true)}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />
            <View style={styles.videoOverlay}>
              <Text style={styles.playerNameOnVideo}>{playerName}</Text>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Ionicons name="videocam" size={48} color="white" />
            <Text style={styles.playerName}>{playerName}</Text>
            <Text style={styles.waitingText}>טוען...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export const VideoCube3D = ({
  videos = [],
  width = SCREEN_WIDTH - 40,
  height = 300,
  onComplete,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const cubeRef = useRef(null);

  console.log('🎲 VideoCube3D loaded with', videos.length, 'videos');

  const handleSwipe = useCallback((position, index) => {
    console.log('🎲 Cube swipe to index:', index);
    setActiveIndex(index);
  }, []);

  const handleVideoEnd = useCallback((index) => {
    if (index < videos.length - 1) {
      const nextIndex = index + 1;
      setActiveIndex(nextIndex);
      if (cubeRef.current && cubeRef.current.scrollTo) {
        cubeRef.current.scrollTo({ x: nextIndex * width, animated: true });
      }
    } else {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    }
  }, [videos.length, onComplete, width]);

  if (videos.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noVideosText}>אין סרטונים להצגה</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height: height + 60 }]}>
      <View style={[styles.cubeWrapper, { width, height }]}>
        <CubeNavigationHorizontal
          ref={cubeRef}
          callBackAfterSwipe={handleSwipe}
          style={{ width, height }}
        >
          {videos.map((video, index) => (
            <VideoFace
              key={index}
              item={video}
              index={index}
              isActive={index === activeIndex && isPlaying}
              onVideoEnd={handleVideoEnd}
            />
          ))}
        </CubeNavigationHorizontal>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity 
          onPress={() => setIsPlaying(prev => !prev)} 
          style={styles.playButton}
        >
          <Ionicons 
            name={isPlaying ? 'pause' : 'play'} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
        
        <View style={styles.progressDots}>
          {videos.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i === activeIndex && styles.activeDot,
                i < activeIndex && styles.completedDot
              ]} 
            />
          ))}
        </View>
        
        <Text style={styles.progressText}>
          {activeIndex + 1} / {videos.length}
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
  },
  cubeWrapper: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  face: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  playerNameOnVideo: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 8,
  },
  playerName: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  waitingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
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
    fontSize: 12,
  },
  noVideosText: {
    color: 'white',
    fontSize: 16,
  },
});

export default VideoCube3D;
