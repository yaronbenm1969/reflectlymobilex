import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, StyleSheet, Image, Text, TouchableOpacity } from 'react-native';
import { Video } from 'expo-av';
import Carousel from 'react-native-reanimated-carousel';
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

  const rawVideoUrl = item.videoUrl || item.url;
  const playerName = item.playerName || item.participantName || `משתתף ${index + 1}`;
  const thumbnail = item.thumbnail || item.thumbnailUrl;

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
          if (response.ok) {
            const data = await response.json();
            if (data.convertedUrl) {
              console.log(`✅ Video ${index} converted:`, data.convertedUrl);
              setConvertedUrl(data.convertedUrl);
            }
          }
        } catch (error) {
          console.error(`❌ Video ${index} conversion failed:`, error);
        }
        setIsConverting(false);
      } else if (rawVideoUrl && !rawVideoUrl.includes('.webm')) {
        setConvertedUrl(rawVideoUrl);
      }
    };
    convertIfNeeded();
  }, [rawVideoUrl, index]);

  useEffect(() => {
    if (isActive && videoRef.current && convertedUrl) {
      setShowThumbnail(false);
      videoRef.current.playAsync();
      setIsPlaying(true);
    } else if (!isActive && videoRef.current) {
      videoRef.current.pauseAsync();
      videoRef.current.setPositionAsync(0);
      setShowThumbnail(true);
      setIsPlaying(false);
    }
  }, [isActive, convertedUrl]);

  const handlePlaybackStatusUpdate = (status) => {
    if (status.didJustFinish && onVideoEnd) {
      onVideoEnd(index);
    }
  };

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
          shouldPlay={isActive}
          isLooping={false}
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

const getCarouselMode = (format) => {
  switch (format) {
    case 'cube-3d':
    case 'carousel-3d':
    case 'parallax':
      return 'parallax';
    case 'stack-cards':
    case 'tinder':
      return 'horizontal-stack';
    case 'fold':
      return 'vertical-stack';
    default:
      return 'parallax';
  }
};

const getModeConfig = (format) => {
  switch (format) {
    case 'cube-3d':
      return { parallaxScrollingScale: 0.8, parallaxScrollingOffset: 50, parallaxAdjacentItemScale: 0.7 };
    case 'carousel-3d':
      return { parallaxScrollingScale: 0.9, parallaxScrollingOffset: 40, parallaxAdjacentItemScale: 0.8 };
    case 'stack-cards':
    case 'tinder':
      return { stackInterval: 18, scaleInterval: 0.04, opacityInterval: 0.2 };
    case 'fold':
      return { stackInterval: 8 };
    default:
      return { parallaxScrollingScale: 0.85, parallaxScrollingOffset: 30 };
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
  const carouselRef = useRef(null);

  console.log('🎬 Video3DPlayer format:', format, 'videos:', videos.length);
  
  const mode = getCarouselMode(format);
  const modeConfig = getModeConfig(format);

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
          mode={mode}
          modeConfig={modeConfig}
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
