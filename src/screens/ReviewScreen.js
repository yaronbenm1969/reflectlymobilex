import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import theme from '../theme/theme';

export const ReviewScreen = ({ route }) => {
  const { go, back } = useNav();
  const lastRecordingUri = useAppState((state) => state.lastRecordingUri);
  const videoUri = route?.params?.videoUri || lastRecordingUri;
  const [isReady, setIsReady] = useState(false);

  console.log('📺 ReviewScreen rendered with videoUri:', videoUri);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setIsReady(true);
        console.log('✅ ReviewScreen ready for interactions');
      }, 300);
    });

    return () => task.cancel();
  }, []);

  const handleDone = () => {
    if (!isReady) {
      console.log('⏸️ Done button ignored - screen not ready');
      return;
    }
    console.log('✅ Done button pressed - going Home');
    go('Home');
  };

  const handleRecordAgain = () => {
    if (!isReady) {
      console.log('⏸️ Record Again ignored - screen not ready');
      return;
    }
    console.log('🔄 Record Again pressed');
    go('Record');
  };

  const handleAddMusic = () => {
    if (!isReady) {
      console.log('⏸️ Add Music ignored - screen not ready');
      return;
    }
    console.log('🎵 Add Music pressed');
    go('FormatSelection', { videoUri });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Review Recording</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.videoContainer}>
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={60} color={theme.colors.primary} />
            <Text style={styles.videoText}>Video recorded successfully!</Text>
            <Text style={styles.videoSubtext}>
              In a full implementation, the video player would be here
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleRecordAgain}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            <Text style={styles.actionText}>Record Again</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleAddMusic}
          >
            <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
            <Text style={styles.actionText}>Add Music</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleDone}
          >
            <Ionicons name="checkmark" size={20} color={theme.colors.success} />
            <Text style={styles.actionText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: 50,
    paddingBottom: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  videoContainer: {
    flex: 1,
    marginBottom: theme.spacing[6],
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
    ...theme.shadows.md,
  },
  videoText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[3],
    textAlign: 'center',
  },
  videoSubtext: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing[4],
  },
  actionButton: {
    alignItems: 'center',
    padding: theme.spacing[3],
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    minWidth: 80,
    ...theme.shadows.sm,
  },
  actionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginTop: theme.spacing[1],
    fontSize: 12,
  },
});
