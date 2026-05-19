import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

// Full-screen player modal with download / share / edit actions
const VideoPlayerModal = ({ url, storyName, onClose, onEdit }) => {
  const { t } = useTranslation();
  const player = useVideoPlayer(url, (p) => { p.play(); });
  const [isSaving, setIsSaving] = useState(false);

  const handleDownload = async () => {
    try {
      setIsSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permission_required'), t('finalVideo.permission_gallery_save'));
        return;
      }
      const safeName = (storyName || 'video').replace(/[^a-zA-Z\u05D0-\u05EA0-9]/g, '_');
      const localPath = FileSystem.cacheDirectory + `${safeName}_${Date.now()}.mp4`;
      const result = await FileSystem.downloadAsync(url, localPath);
      if (result.status !== 200) throw new Error('Download failed');
      try {
        await MediaLibrary.createAssetAsync(localPath);
      } catch {
        await MediaLibrary.saveToLibraryAsync(localPath);
      }
      Alert.alert(t('finalVideo.saved_success'), t('finalVideo.saved_single'));
    } catch (err) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsSaving(true);
      const safeName = (storyName || 'video').replace(/[^a-zA-Z\u05D0-\u05EA0-9]/g, '_');
      const localPath = FileSystem.cacheDirectory + `${safeName}_share_${Date.now()}.mp4`;
      const result = await FileSystem.downloadAsync(url, localPath);
      if (result.status !== 200) throw new Error('Download failed');
      await Sharing.shareAsync(localPath, { mimeType: 'video/mp4', dialogTitle: storyName });
    } catch (err) {
      Alert.alert('שגיאה', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>
        <VideoView
          player={player}
          style={modalStyles.video}
          contentFit="contain"
          nativeControls
        />
        <View style={modalStyles.actions}>
          <TouchableOpacity style={modalStyles.actionBtn} onPress={handleDownload} disabled={isSaving}>
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="download-outline" size={26} color="#fff" />}
            <Text style={modalStyles.actionLabel}>{t('finalVideo.btn_download')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={modalStyles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={26} color="#fff" />
            <Text style={modalStyles.actionLabel}>{t('finalVideo.btn_share')}</Text>
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity style={modalStyles.actionBtn} onPress={() => { onClose(); onEdit(); }}>
              <Ionicons name="create-outline" size={26} color="#fff" />
              <Text style={modalStyles.actionLabel}>{t('finalVideo.btn_edit')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
  },
  video: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 20,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
  },
});

export const MyStoriesScreen = () => {
  const { t } = useTranslation();
  const { back, go } = useNav();
  const user = useAppState((state) => state.user);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  // watchData = { url, name, storyId } or null
  const [watchData, setWatchData] = useState(null);

  useEffect(() => {
    loadStories();
  }, [user]);

  const loadStories = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await storiesService.getUserStories(user.uid);

    if (result.success) {
      setStories(result.stories);
    } else {
      console.error('Failed to load stories:', result.error);
    }
    setLoading(false);
  };

  const openStory = (story) => {
    setStoryName(story.name);
    setCurrentStoryId(story.id);
    go('EditRoom');
  };

  // For completed stories (have a final video): tap card → open player modal
  // For incomplete stories: tap card → EditRoom
  const handleStoryPress = (story) => {
    const videoUrl = story.finalVideoUrl || story.videoUrl || null;
    if (videoUrl) {
      setWatchData({ url: videoUrl, name: story.name, story });
    } else {
      openStory(story);
    }
  };

  const deleteStory = async (storyId) => {
    const result = await storiesService.deleteStory(storyId);
    if (result.success) {
      setStories(stories.filter(s => s.id !== storyId));
    }
    setConfirmingDeleteId(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL');
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return t('myStories.status_draft');
      case 'shared': return t('myStories.status_shared');
      case 'processing': return t('myStories.status_processing');
      case 'completed': return t('myStories.status_completed');
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#999';
      case 'shared': return '#2196F3';
      case 'processing': return '#FF9800';
      case 'completed': return '#4CAF50';
      default: return '#999';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('myStories.title')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadStories}>
          <Ionicons name="refresh" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>{t('myStories.loading')}</Text>
          </View>
        ) : !user ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.emptyTitle}>{t('myStories.login_required_title')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('myStories.login_required_subtitle')}
            </Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => go('Auth')}
            >
              <Text style={styles.loginButtonText}>{t('myStories.login_button')}</Text>
            </TouchableOpacity>
          </View>
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.emptyTitle}>{t('myStories.empty_title')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('myStories.empty_subtitle')}
            </Text>
          </View>
        ) : (
          <View style={styles.storiesGrid}>
            {stories.map((story) => {
              const videoUrl = story.finalVideoUrl || story.videoUrl || null;
              const isCompleted = !!videoUrl;
              return (
                <Card key={story.id} style={styles.storyCard}>
                  <TouchableOpacity style={styles.storyMain} onPress={() => handleStoryPress(story)}>
                    <View style={[styles.storyThumbnail, isCompleted && styles.storyThumbnailDone]}>
                      <Ionicons
                        name={isCompleted ? 'play-circle' : 'videocam'}
                        size={32}
                        color={isCompleted ? theme.colors.accent : theme.colors.secondary}
                      />
                    </View>
                    <View style={styles.storyInfo}>
                      <Text style={styles.storyTitle}>{story.name}</Text>
                      <Text style={styles.storyMeta}>
                        {formatDate(story.createdAt)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(story.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(story.status) }]}>
                          {getStatusText(story.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.playButton}>
                      <Ionicons
                        name={isCompleted ? 'play' : 'chevron-forward'}
                        size={isCompleted ? 16 : 20}
                        color={theme.colors.accent}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Action row for completed stories */}
                  {isCompleted && (
                    <View style={styles.completedActions}>
                      <TouchableOpacity
                        style={styles.completedAction}
                        onPress={() => setWatchData({ url: videoUrl, name: story.name, story })}
                      >
                        <Ionicons name="play-circle-outline" size={16} color={theme.colors.accent} />
                        <Text style={styles.completedActionText}>{t('myStories.watch_final')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.completedAction}
                        onPress={() => openStory(story)}
                      >
                        <Ionicons name="create-outline" size={16} color={theme.colors.subtext} />
                        <Text style={[styles.completedActionText, { color: theme.colors.subtext }]}>
                          {t('finalVideo.btn_edit')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {confirmingDeleteId === story.id ? (
                    <View style={styles.deleteConfirm}>
                      <Text style={styles.deleteConfirmText}>{t('myStories.delete_confirm')}</Text>
                      <TouchableOpacity style={styles.confirmYes} onPress={() => deleteStory(story.id)}>
                        <Text style={styles.confirmYesText}>{t('myStories.delete_confirm_yes')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmNo} onPress={() => setConfirmingDeleteId(null)}>
                        <Text style={styles.confirmNoText}>{t('myStories.delete_confirm_no')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => setConfirmingDeleteId(story.id)}>
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {watchData && (
        <VideoPlayerModal
          url={watchData.url}
          storyName={watchData.name}
          onClose={() => setWatchData(null)}
          onEdit={() => openStory(watchData.story)}
        />
      )}
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
    paddingVertical: theme.spacing[3],
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[8],
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[3],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[8],
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[3],
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  loginButton: {
    marginTop: theme.spacing[4],
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.lg,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  storiesGrid: {
    gap: theme.spacing[3],
  },
  storyCard: {
    padding: 0,
    overflow: 'hidden',
  },
  storyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[4],
  },
  storyThumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  storyThumbnailDone: {
    backgroundColor: `${theme.colors.accent}15`,
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  storyMeta: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
    textAlign: 'right',
  },
  statusBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    gap: theme.spacing[4],
  },
  completedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  completedActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  deleteButton: {
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
    gap: theme.spacing[2],
  },
  deleteConfirmText: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '500',
    marginRight: theme.spacing[1],
  },
  confirmYes: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
  },
  confirmYesText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmNo: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
  },
  confirmNoText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
});
