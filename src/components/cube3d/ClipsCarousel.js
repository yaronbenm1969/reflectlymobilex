import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = 70;

export default function ClipsCarousel({
  clips = [],
  thumbnails = {},
  currentFaceClips = [],
  activeClipId,
  onClipPress,
}) {
  const isOnCube = (clipId) => {
    return currentFaceClips.some(fc => fc?.clipId === clipId);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>קליפים ({clips.length})</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {clips.map((clip, index) => {
          const thumbUri = thumbnails[clip.clipId];
          const onCube = isOnCube(clip.clipId);
          const isActive = clip.clipId === activeClipId;

          return (
            <TouchableOpacity
              key={clip.clipId}
              style={[
                styles.thumbContainer,
                onCube && styles.onCube,
                isActive && styles.active,
              ]}
              onPress={() => onClipPress?.(clip, index)}
              activeOpacity={0.7}
            >
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.thumb} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>{index + 1}</Text>
                </View>
              )}
              {onCube && (
                <View style={styles.cubeBadge}>
                  <Text style={styles.cubeBadgeText}>🎲</Text>
                </View>
              )}
              {isActive && <View style={styles.activeBorder} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    marginHorizontal: 16,
    textAlign: 'right',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbContainer: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  onCube: {
    borderColor: theme.colors.primary + '60',
  },
  active: {
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  cubeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeBadgeText: {
    fontSize: 10,
  },
  activeBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.md,
  },
});
