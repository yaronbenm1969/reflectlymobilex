import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const FinalVideoScreen = () => {
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const privacySettings = useAppState((state) => state.privacySettings);
  const resetStory = useAppState((state) => state.resetStory);
  const finalVideoUri = useAppState((state) => state.finalVideoUri);
  const reflections = useAppState((state) => state.reflections);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const videoRef = useRef(null);

  const participantCount = new Set(reflections.map(r => r.recipientId || r.participantId || 'anonymous')).size;

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleShare = async () => {
    try {
      if (finalVideoUri && await Sharing.isAvailableAsync()) {
        const localUri = FileSystem.cacheDirectory + 'shared_video.mp4';
        
        const downloadResult = await FileSystem.downloadAsync(finalVideoUri, localUri);
        
        if (downloadResult.status === 200) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'video/mp4',
            dialogTitle: `שתף את הסרטון: ${storyName}`,
          });
        } else {
          throw new Error('Failed to download for sharing');
        }
      } else {
        await Share.share({
          message: `צפה בסרטון שלי: "${storyName}" 🎬`,
          title: storyName,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הסרטון');
    }
  };

  const handleDownload = async () => {
    if (!finalVideoUri) {
      Alert.alert('שגיאה', 'אין סרטון להורדה');
      return;
    }
    
    try {
      setIsDownloading(true);
      
      const filename = `${storyName.replace(/[^a-zA-Zא-ת0-9]/g, '_')}_${Date.now()}.mp4`;
      const localUri = FileSystem.documentDirectory + filename;
      
      const downloadResult = await FileSystem.downloadAsync(finalVideoUri, localUri);
      
      if (downloadResult.status === 200) {
        Alert.alert(
          'הורדה הצליחה!',
          'הסרטון נשמר במכשיר שלך',
          [{ text: 'מעולה!' }]
        );
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('שגיאה', 'לא ניתן להוריד את הסרטון');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNewStory = () => {
    resetStory();
    go('Home');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>הסרטון מוכן! 🎉</Text>
          <Text style={styles.storyName}>{storyName}</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.videoContainer}>
          {finalVideoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: finalVideoUri }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode="contain"
              onPlaybackStatusUpdate={(status) => {
                setIsPlaying(status.isPlaying);
              }}
            />
          ) : (
            <View style={styles.videoPreview}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={64}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.noVideoText}>אין סרטון זמין</Text>
            </View>
          )}
          
          <View style={styles.videoInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{participantCount} משתתפים</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="videocam-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{reflections.length} שיקופים</Text>
            </View>
          </View>
        </View>

        <View style={styles.privacyBadge}>
          <Ionicons 
            name={privacySettings.allowSocialMedia ? 'globe-outline' : 'lock-closed-outline'} 
            size={18} 
            color={privacySettings.allowSocialMedia ? theme.colors.success : theme.colors.primary} 
          />
          <Text style={styles.privacyText}>
            {privacySettings.allowSocialMedia 
              ? 'ניתן לפרסום ברשתות חברתיות' 
              : 'צפייה פרטית בלבד'}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleDownload}
            disabled={isDownloading}
          >
            <View style={styles.actionIcon}>
              {isDownloading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="download-outline" size={28} color={theme.colors.primary} />
              )}
            </View>
            <Text style={styles.actionLabel}>הורד</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <View style={styles.actionIcon}>
              <Ionicons name="share-social-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionLabel}>שתף</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => go('EditRoom')}>
            <View style={styles.actionIcon}>
              <Ionicons name="create-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionLabel}>ערוך</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomActions}>
          <AppButton
            title="צור סיפור חדש"
            onPress={handleNewStory}
            variant="primary"
            size="lg"
            fullWidth
          />
          
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={() => go('Home')}
          >
            <Text style={styles.homeButtonText}>חזור לדף הבית</Text>
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
    paddingTop: 60,
    paddingBottom: theme.spacing[6],
    paddingHorizontal: theme.spacing[4],
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  storyName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: theme.spacing[2],
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  videoContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  videoPlayer: {
    width: '100%',
    height: 220,
  },
  videoPreview: {
    height: 220,
    backgroundColor: theme.colors.gradient.end,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoText: {
    color: 'white',
    marginTop: theme.spacing[2],
    fontSize: 14,
  },
  videoInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[6],
    padding: theme.spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  infoText: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[4],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
  },
  privacyText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing[6],
    paddingVertical: theme.spacing[4],
  },
  actionButton: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  actionLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingVertical: theme.spacing[4],
  },
  homeButton: {
    alignItems: 'center',
    marginTop: theme.spacing[3],
  },
  homeButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary,
  },
});
