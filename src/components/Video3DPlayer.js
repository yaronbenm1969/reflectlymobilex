import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Dimensions, StyleSheet, Image, Text, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const VideoSlide = ({ item, index, isActive, onVideoEnd }) => {
  const videoRef = useRef(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  const rawVideoUrl = item.videoUrl || item.url;
  const playerName = item.playerName || item.participantName || `משתתף ${index + 1}`;
  const thumbnail = item.thumbnail || item.thumbnailUrl;

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
        console.log(`🔄 Converting video ${index} from webm...`);
        try {
          const response = await fetch(`${API_URL}/api/convert-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: rawVideoUrl })
          });
          if (response.ok && isMountedRef.current) {
            const data = await response.json();
            if (data.convertedUrl) {
              console.log(`✅ Video ${index} converted:`, data.convertedUrl);
              setConvertedUrl(data.convertedUrl);
            }
          }
        } catch (error) {
          console.error(`❌ Video ${index} conversion failed:`, error);
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
          setShowThumbnail(false);
          await videoRef.current.playAsync();
          if (isMountedRef.current) setIsPlaying(true);
        } else if (!isActive && isLoaded) {
          await videoRef.current.pauseAsync();
          await videoRef.current.setPositionAsync(0);
          if (isMountedRef.current) {
            setShowThumbnail(true);
            setIsPlaying(false);
          }
        }
      } catch (error) {
        console.log('Playback control error (expected on unmount):', error.message);
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

  const handleLoad = useCallback(() => {
    if (isMountedRef.current) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <View style={styles.slideContainer}>
      {isConverting ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="sync" size={32} color="white" />
          <Text style={styles.loadingText}>ממיר סרטון...</Text>
          <Text style={styles.playerName}>{playerName}</Text>
        </View>
      ) : showThumbnail && thumbnail ? (
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
          <View style={styles.thumbnailOverlay}>
            <Text style={styles.playerName}>{playerName}</Text>
            {!isActive && (
              <View style={styles.waitingBadge}>
                <Ionicons name="time" size={16} color="white" />
                <Text style={styles.waitingText}>ממתין</Text>
              </View>
            )}
          </View>
        </View>
      ) : convertedUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: convertedUrl }}
          style={styles.video}
          resizeMode="cover"
          shouldPlay={false}
          isLooping={false}
          onLoad={handleLoad}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Ionicons name="videocam" size={32} color="white" />
          <Text style={styles.playerName}>{playerName}</Text>
        </View>
      )}
      
      <View style={styles.slideInfo}>
        <Text style={styles.slidePlayerName}>{playerName}</Text>
        {isActive && <View style={styles.activeDot} />}
      </View>
    </View>
  );
};

// 3D Cube Animation
const cube3DAnimation = (value, width) => {
  'worklet';
  const perspective = width * 2;
  const rotateY = interpolate(value, [-1, 0, 1], [90, 0, -90]);
  const translateX = interpolate(value, [-1, 0, 1], [-width / 2, 0, width / 2]);
  const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9]);

  return {
    transform: [
      { perspective },
      { translateX },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
  };
};

// 3D Carousel Animation
const carousel3DAnimation = (value, width) => {
  'worklet';
  const perspective = width * 2.5;
  const rotateY = interpolate(value, [-1, 0, 1], [45, 0, -45]);
  const translateX = interpolate(value, [-1, 0, 1], [-width * 0.3, 0, width * 0.3]);
  const scale = interpolate(value, [-1, 0, 1], [0.85, 1, 0.85]);
  const opacity = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7]);

  return {
    transform: [
      { perspective },
      { translateX },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
    opacity,
  };
};

// Flip Pages Animation
const flipPagesAnimation = (value, width) => {
  'worklet';
  const perspective = width * 2;
  const rotateY = interpolate(value, [-1, 0, 1], [180, 0, -180]);
  const translateX = interpolate(value, [-1, 0, 1], [-width, 0, width]);
  const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8]);

  return {
    transform: [
      { perspective },
      { translateX },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
    backfaceVisibility: 'hidden',
  };
};

// Stack Cards Animation
const stackCardsAnimation = (value, width) => {
  'worklet';
  const translateX = interpolate(value, [-1, 0, 1], [-width * 0.9, 0, width * 0.1]);
  const translateY = interpolate(value, [-1, 0, 1], [0, 0, 10]);
  const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.95]);
  const opacity = interpolate(value, [-1, 0, 1], [0, 1, 0.8]);
  const zIndex = interpolate(value, [-1, 0, 1], [0, 10, 5]);

  return {
    transform: [
      { translateX },
      { translateY },
      { scale },
    ],
    opacity,
    zIndex: Math.round(zIndex),
  };
};

// Paper Fold Animation
const foldAnimation = (value, width) => {
  'worklet';
  const perspective = width * 2;
  const rotateX = interpolate(value, [-1, 0, 1], [90, 0, -90]);
  const translateY = interpolate(value, [-1, 0, 1], [-width / 4, 0, width / 4]);
  const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8]);

  return {
    transform: [
      { perspective },
      { translateY },
      { rotateX: `${rotateX}deg` },
      { scale },
    ],
  };
};

// Circular Animation
const circularAnimation = (value, width) => {
  'worklet';
  const perspective = width * 3;
  const rotateY = interpolate(value, [-1, 0, 1], [60, 0, -60]);
  const translateX = interpolate(value, [-1, 0, 1], [-width * 0.6, 0, width * 0.6]);
  const translateZ = interpolate(value, [-1, 0, 1], [-100, 0, -100]);
  const scale = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7]);

  return {
    transform: [
      { perspective },
      { translateX },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
  };
};

// Parallax Animation
const parallaxAnimation = (value, width) => {
  'worklet';
  const translateX = interpolate(value, [-1, 0, 1], [-width * 0.3, 0, width * 0.3]);
  const scale = interpolate(value, [-1, 0, 1], [0.85, 1, 0.85]);
  const opacity = interpolate(value, [-1, 0, 1], [0.6, 1, 0.6]);

  return {
    transform: [
      { translateX },
      { scale },
    ],
    opacity,
  };
};

// Scale Fade Animation
const scaleFadeAnimation = (value, width) => {
  'worklet';
  const translateX = interpolate(value, [-1, 0, 1], [-width, 0, width]);
  const scale = interpolate(value, [-1, 0, 1], [0.5, 1, 0.5]);
  const opacity = interpolate(value, [-1, 0, 1], [0, 1, 0]);

  return {
    transform: [
      { translateX },
      { scale },
    ],
    opacity,
  };
};

// Standard Animation (no effects)
const standardAnimation = (value, width) => {
  'worklet';
  const translateX = interpolate(value, [-1, 0, 1], [-width, 0, width]);

  return {
    transform: [{ translateX }],
  };
};

const getAnimationStyle = (format) => {
  switch (format) {
    case 'cube-3d':
      return cube3DAnimation;
    case 'carousel-3d':
      return carousel3DAnimation;
    case 'flip-pages':
      return flipPagesAnimation;
    case 'stack-cards':
    case 'tinder':
      return stackCardsAnimation;
    case 'fold':
      return foldAnimation;
    case 'circular':
      return circularAnimation;
    case 'parallax':
    case 'flow':
      return parallaxAnimation;
    case 'blur-rotate':
    case 'scale-fade':
      return scaleFadeAnimation;
    case 'standard':
    default:
      return standardAnimation;
  }
};

const AnimatedSlide = ({ item, index, animationValue, width, height, format, isActive, onVideoEnd }) => {
  const animationFn = getAnimationStyle(format);
  
  const animatedStyle = useAnimatedStyle(() => {
    return animationFn(animationValue.value, width);
  }, [animationValue, width, format]);

  return (
    <Animated.View style={[{ width, height, position: 'absolute' }, animatedStyle]}>
      <VideoSlide
        item={item}
        index={index}
        isActive={isActive}
        onVideoEnd={onVideoEnd}
      />
    </Animated.View>
  );
};

export const Video3DPlayer = ({
  videos = [],
  format = 'cube-3d',
  width = SCREEN_WIDTH - 40,
  height = 280,
  autoPlay = true,
  onComplete,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  console.log('🎬 Video3DPlayer format:', format, 'videos:', videos.length, '(3D animations enabled)');

  const handleVideoEnd = useCallback((index) => {
    if (!isMountedRef.current || isTransitioning) return;
    
    if (index < videos.length - 1) {
      setIsTransitioning(true);
      const nextIndex = index + 1;
      
      requestAnimationFrame(() => {
        if (carouselRef.current && isMountedRef.current) {
          setActiveIndex(nextIndex);
          carouselRef.current.scrollTo({ index: nextIndex, animated: true });
          
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsTransitioning(false);
            }
          }, 1000);
        }
      });
    } else {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    }
  }, [videos.length, onComplete, isTransitioning]);

  const handleSnapToItem = useCallback((index) => {
    if (isMountedRef.current) {
      setActiveIndex(index);
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  if (videos.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noVideosText}>אין סרטונים להצגה</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height: height + 60 }]}>
      <View style={styles.carouselWrapper}>
        <Carousel
          ref={carouselRef}
          loop={false}
          width={width}
          height={height}
          data={videos}
          autoPlay={false}
          scrollAnimationDuration={800}
          onSnapToItem={handleSnapToItem}
          customAnimation={(value) => {
            'worklet';
            const animationFn = getAnimationStyle(format);
            return animationFn(value, width);
          }}
          renderItem={({ index, item, animationValue }) => (
            <AnimatedSlide
              item={item}
              index={index}
              animationValue={animationValue}
              width={width}
              height={height}
              format={format}
              isActive={index === activeIndex && isPlaying && !isTransitioning}
              onVideoEnd={handleVideoEnd}
            />
          )}
        />
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
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
                i === activeIndex && styles.activeDotIndicator,
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
  carouselWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a4e',
  },
  thumbnailContainer: {
    flex: 1,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  waitingText: {
    color: 'white',
    fontSize: 12,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  slideInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slidePlayerName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
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
  activeDotIndicator: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    gap: 12,
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
  },
});

export default Video3DPlayer;
