import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Dimensions, StyleSheet, Image, Text, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { interpolate, Extrapolation } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const VideoSlide = ({ item, index, isActive, onVideoEnd, width, height }) => {
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
        console.log('Playback control error:', error.message);
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
    <View style={[styles.slideContainer, { width, height }]}>
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

const createCube3DAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width, 0, width],
    Extrapolation.CLAMP
  );

  const rotateY = interpolate(
    value,
    [-1, 0, 1],
    [90, 0, -90],
    Extrapolation.CLAMP
  );

  const zIndex = Math.round(
    interpolate(value, [-1, 0, 1], [0, 1000, 0], Extrapolation.CLAMP)
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.9, 1, 0.9],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 2 },
      { translateX },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
    zIndex,
  };
};

const createCarousel3DAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width * 0.7, 0, width * 0.7],
    Extrapolation.CLAMP
  );

  const translateZ = interpolate(
    value,
    [-1, 0, 1],
    [-200, 0, -200],
    Extrapolation.CLAMP
  );

  const rotateY = interpolate(
    value,
    [-1, 0, 1],
    [45, 0, -45],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.7, 1, 0.7],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, -0.5, 0, 0.5, 1],
    [0.5, 0.8, 1, 0.8, 0.5],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 3 },
      { translateX },
      { translateZ },
      { rotateY: `${rotateY}deg` },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createFlipPagesAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width * 0.5, 0, width * 0.5],
    Extrapolation.CLAMP
  );

  const rotateY = interpolate(
    value,
    [-1, 0, 1],
    [180, 0, -180],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, -0.5, 0, 0.5, 1],
    [0, 0.5, 1, 0.5, 0],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 2 },
      { translateX },
      { rotateY: `${rotateY}deg` },
    ],
    opacity,
    backfaceVisibility: 'hidden',
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createStackCardsAnimation = (value) => {
  'worklet';
  
  const translateY = interpolate(
    value,
    [-1, 0, 1, 2, 3],
    [0, 0, -15, -30, -45],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1, 2, 3],
    [1, 1, 0.95, 0.9, 0.85],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, 0, 1, 2, 3],
    [0, 1, 0.9, 0.8, 0.7],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { translateY },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1, 2, 3], [0, 1000, 999, 998, 997])),
  };
};

const createTinderAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-2, -1, 0, 1, 2],
    [-width * 2, -width, 0, width, width * 2],
    Extrapolation.CLAMP
  );

  const rotate = interpolate(
    value,
    [-1, 0, 1],
    [-15, 0, 15],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.9, 1, 0.9],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { translateX },
      { rotate: `${rotate}deg` },
      { scale },
    ],
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createFoldAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width, 0, width],
    Extrapolation.CLAMP
  );

  const rotateX = interpolate(
    value,
    [-1, 0, 1],
    [60, 0, -60],
    Extrapolation.CLAMP
  );

  const scaleY = interpolate(
    value,
    [-1, 0, 1],
    [0.5, 1, 0.5],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, 0, 1],
    [0.3, 1, 0.3],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 2 },
      { translateX },
      { rotateX: `${rotateX}deg` },
      { scaleY },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createCircularAnimation = (width) => (value) => {
  'worklet';
  
  const angle = value * 60;
  const radius = width * 0.6;
  
  const translateX = Math.sin(angle * Math.PI / 180) * radius;
  const translateZ = (Math.cos(angle * Math.PI / 180) - 1) * radius * 0.5;

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.7, 1, 0.7],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, 0, 1],
    [0.5, 1, 0.5],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 3 },
      { translateX },
      { translateZ },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createFlowAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width * 0.8, 0, width * 0.8],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.8, 1, 0.8],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-2, -1, 0, 1, 2],
    [0, 0.6, 1, 0.6, 0],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { translateX },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createParallaxAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width * 0.9, 0, width * 0.9],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.85, 1, 0.85],
    Extrapolation.CLAMP
  );

  const translateZ = interpolate(
    value,
    [-1, 0, 1],
    [-150, 0, -150],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { perspective: width * 2 },
      { translateX },
      { translateZ },
      { scale },
    ],
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createBlurRotateAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width, 0, width],
    Extrapolation.CLAMP
  );

  const rotate = interpolate(
    value,
    [-1, 0, 1],
    [-30, 0, 30],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.6, 1, 0.6],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, 0, 1],
    [0.3, 1, 0.3],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { translateX },
      { rotate: `${rotate}deg` },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createScaleFadeAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width * 0.5, 0, width * 0.5],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    value,
    [-1, 0, 1],
    [0.5, 1, 0.5],
    Extrapolation.CLAMP
  );

  const opacity = interpolate(
    value,
    [-1, 0, 1],
    [0, 1, 0],
    Extrapolation.CLAMP
  );

  return {
    transform: [
      { translateX },
      { scale },
    ],
    opacity,
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const createStandardAnimation = (width) => (value) => {
  'worklet';
  
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-width, 0, width],
    Extrapolation.CLAMP
  );

  return {
    transform: [{ translateX }],
    zIndex: Math.round(interpolate(value, [-1, 0, 1], [0, 1000, 0])),
  };
};

const getAnimationForFormat = (format, width) => {
  switch (format) {
    case 'cube-3d':
      return createCube3DAnimation(width);
    case 'carousel-3d':
      return createCarousel3DAnimation(width);
    case 'flip-pages':
      return createFlipPagesAnimation(width);
    case 'stack-cards':
      return createStackCardsAnimation;
    case 'tinder':
      return createTinderAnimation(width);
    case 'fold':
      return createFoldAnimation(width);
    case 'circular':
      return createCircularAnimation(width);
    case 'flow':
      return createFlowAnimation(width);
    case 'parallax':
      return createParallaxAnimation(width);
    case 'blur-rotate':
      return createBlurRotateAnimation(width);
    case 'scale-fade':
      return createScaleFadeAnimation(width);
    case 'standard':
    default:
      return createStandardAnimation(width);
  }
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

  const customAnimation = useMemo(() => {
    return getAnimationForFormat(format, width);
  }, [format, width]);

  const handleVideoEnd = useCallback((index) => {
    if (!isMountedRef.current || isTransitioning) return;
    
    if (index < videos.length - 1) {
      setIsTransitioning(true);
      const nextIndex = index + 1;
      
      setTimeout(() => {
        if (carouselRef.current && isMountedRef.current) {
          setActiveIndex(nextIndex);
          try {
            carouselRef.current.scrollTo({ index: nextIndex, animated: true });
          } catch (e) {
            console.log('Scroll error:', e.message);
          }
          
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsTransitioning(false);
            }
          }, 1000);
        }
      }, 100);
    } else {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    }
  }, [videos.length, onComplete, isTransitioning]);

  const handleSnapToItem = useCallback((index) => {
    if (isMountedRef.current && !isTransitioning) {
      setActiveIndex(index);
    }
  }, [isTransitioning]);

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
          customAnimation={customAnimation}
          onSnapToItem={handleSnapToItem}
          panGestureHandlerProps={{
            activeOffsetX: [-10, 10],
          }}
          renderItem={({ index, item }) => (
            <VideoSlide
              item={item}
              index={index}
              width={width}
              height={height}
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
