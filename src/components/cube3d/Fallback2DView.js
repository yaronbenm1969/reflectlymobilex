import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_WIDTH * 0.7;

export default function Fallback2DView({
  clips = [],
  thumbnails = {},
  onClipEnd,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const currentClip = clips[currentIndex];

  const handleVideoEnd = useCallback(() => {
    const nextIndex = (currentIndex + 1) % clips.length;
    setCurrentIndex(nextIndex);
    onClipEnd?.(currentClip?.clipId, nextIndex);
  }, [currentIndex, clips.length, currentClip?.clipId, onClipEnd]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (status.didJustFinish) {
      handleVideoEnd();
    }
  }, [handleVideoEnd]);

  const selectClip = useCallback((index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  if (!currentClip) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>אין קליפים להצגה</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: currentClip.videoUri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          isLooping={false}
          isMuted={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={(error) => console.log('❌ Fallback video error:', error)}
        />
        <View style={styles.clipInfo}>
          <Text style={styles.clipTitle}>{currentClip.title || `קליפ ${currentIndex + 1}`}</Text>
          <Text style={styles.clipProgress}>{currentIndex + 1} / {clips.length}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbsContent}
        style={styles.thumbsScroll}
      >
        {clips.map((clip, index) => {
          const thumbUri = thumbnails[clip.clipId];
          const isActive = index === currentIndex;

          return (
            <TouchableOpacity
              key={clip.clipId}
              style={[styles.thumbContainer, isActive && styles.activeThumb]}
              onPress={() => selectClip(index)}
              activeOpacity={0.7}
            >
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.thumb} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>{index + 1}</Text>
                </View>
              )}
              {isActive && (
                <View style={styles.playingIndicator}>
                  <Text style={styles.playingText}>▶</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.subtext,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  clipInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clipTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clipProgress: {
    color: '#fff',
    fontSize: 12,
  },
  thumbsScroll: {
    marginTop: 12,
  },
  thumbsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumb: {
    borderColor: theme.colors.primary,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingText: {
    color: '#fff',
    fontSize: 20,
  },
});
