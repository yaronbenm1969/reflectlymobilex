import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Dimensions, StyleSheet, Image, Text, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import Carousel from 'react-native-reanimated-carousel';
import Animated, {
  Extrapolation,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getAnimationStyle = (type, pageWidth, pageHeight) => {
  switch (type) {
    case 'cube-3d':
      return (value) => {
        'worklet';
        const zIndex = interpolate(value, [-1, 0, 1], [-1000, 0, -1000]);
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth], Extrapolation.CLAMP);
        const scale = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7], Extrapolation.CLAMP);
        const rotateY = `${interpolate(value, [-1, 0, 1], [-90, 0, 90], Extrapolation.CLAMP)}deg`;
        return {
          transform: [{ perspective: 1000 }, { scale }, { translateX }, { rotateY }],
          zIndex,
        };
      };
      
    case 'carousel-3d':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.5, 0, pageWidth * 0.5]);
        const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);
        const rotateY = `${interpolate(value, [-1, 0, 1], [45, 0, -45], Extrapolation.CLAMP)}deg`;
        const zIndex = interpolate(value, [-1, 0, 1], [0, 1, 0]);
        return {
          transform: [{ perspective: 800 }, { translateX }, { scale }, { rotateY }],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.7, 1, 0.7]),
        };
      };
      
    case 'flip-pages':
      return (value) => {
        'worklet';
        const rotateY = `${interpolate(value, [-1, 0, 1], [180, 0, -180], Extrapolation.CLAMP)}deg`;
        const opacity = interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP);
        return {
          transform: [{ perspective: 1200 }, { rotateY }],
          opacity,
          backfaceVisibility: 'hidden',
        };
      };
      
    case 'stack-cards':
      return (value) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP);
        const translateY = interpolate(value, [-1, 0, 1], [-30, 0, 30], Extrapolation.CLAMP);
        const zIndex = interpolate(value, [-1, 0, 1], [0, 1, 0]);
        return {
          transform: [{ scale }, { translateY }],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.5, 1, 0.5]),
        };
      };
      
    case 'tinder':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth]);
        const rotate = `${interpolate(value, [-1, 0, 1], [-15, 0, 15], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP);
        return {
          transform: [{ translateX }, { rotate }, { scale }],
          opacity: interpolate(value, [-1, 0, 1], [0.5, 1, 0.5]),
        };
      };
      
    case 'fold':
      return (value) => {
        'worklet';
        const rotateX = `${interpolate(value, [-1, 0, 1], [90, 0, -90], Extrapolation.CLAMP)}deg`;
        const translateY = interpolate(value, [-1, 0, 1], [-pageHeight * 0.5, 0, pageHeight * 0.5]);
        return {
          transform: [{ perspective: 1000 }, { rotateX }, { translateY }],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP),
        };
      };
      
    case 'circular':
      return (value) => {
        'worklet';
        const rotate = `${interpolate(value, [-1, 0, 1], [-360, 0, 360], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP);
        return {
          transform: [{ rotate }, { scale }],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0.3, 1, 0.3], Extrapolation.CLAMP),
        };
      };
      
    case 'flow':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.3, 0, pageWidth * 0.3]);
        const scale = interpolate(value, [-1, 0, 1], [0.85, 1, 0.85], Extrapolation.CLAMP);
        return {
          transform: [{ translateX }, { scale }],
          opacity: interpolate(value, [-1, 0, 1], [0.6, 1, 0.6]),
        };
      };
      
    case 'parallax':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.5, 0, pageWidth * 0.5]);
        const scale = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7], Extrapolation.CLAMP);
        const zIndex = interpolate(value, [-1, 0, 1], [-100, 0, -100]);
        return {
          transform: [{ translateX }, { scale }],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.4, 1, 0.4]),
        };
      };
      
    case 'blur-rotate':
      return (value) => {
        'worklet';
        const rotate = `${interpolate(value, [-1, 0, 1], [30, 0, -30], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);
        return {
          transform: [{ rotate }, { scale }],
          opacity: interpolate(value, [-0.8, 0, 0.8], [0.2, 1, 0.2], Extrapolation.CLAMP),
        };
      };
      
    case 'scale-fade':
      return (value) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP);
        return {
          transform: [{ scale }],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP),
        };
      };
      
    default:
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth]);
        return { transform: [{ translateX }] };
      };
  }
};

const VideoSlide = ({ item, index, isActive, onVideoEnd }) => {
  const videoRef = useRef(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isActive && videoRef.current) {
      setShowThumbnail(false);
      videoRef.current.playAsync();
      setIsPlaying(true);
    } else if (!isActive && videoRef.current) {
      videoRef.current.pauseAsync();
      videoRef.current.setPositionAsync(0);
      setShowThumbnail(true);
      setIsPlaying(false);
    }
  }, [isActive]);

  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish && onVideoEnd) {
      onVideoEnd(index);
    }
  };

  const thumbnail = item.thumbnail || item.thumbnailUrl;
  const videoUrl = item.videoUrl || item.url;
  const playerName = item.playerName || item.participantName || `משתתף ${index + 1}`;

  return (
    <View style={styles.slideContainer}>
      {showThumbnail && thumbnail ? (
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
      ) : (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode="cover"
          shouldPlay={isActive}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      )}
      
      <View style={styles.slideInfo}>
        <Text style={styles.slidePlayerName}>{playerName}</Text>
        {isActive && <View style={styles.activeDot} />}
      </View>
    </View>
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
  const carouselRef = useRef(null);

  const animationStyle = useCallback(
    getAnimationStyle(format, width, height),
    [format, width, height]
  );

  const handleVideoEnd = (index) => {
    if (index < videos.length - 1) {
      const nextIndex = index + 1;
      setActiveIndex(nextIndex);
      if (carouselRef.current) {
        carouselRef.current.scrollTo({ index: nextIndex, animated: true });
      }
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleSnapToItem = (index) => {
    setActiveIndex(index);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

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
          customAnimation={animationStyle}
          onSnapToItem={handleSnapToItem}
          renderItem={({ index, item }) => (
            <VideoSlide
              item={item}
              index={index}
              isActive={index === activeIndex && isPlaying}
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
});

export default Video3DPlayer;
