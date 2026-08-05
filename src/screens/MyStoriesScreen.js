import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import theme from '../theme/theme';

// Full-screen player modal — unchanged
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
      Alert.alert(t('common.error'), err.message);
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
  const setVideoFormat = useAppState((state) => state.setVideoFormat);

  const bgVideoRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [watchData, setWatchData] = useState(null);

  // Real-time listener — updates immediately when pendingReflectionsCount or any field changes
  useEffect(() => {
    if (!user?.uid) { setStories([]); setLoading(false); return; }
    setLoading(true);
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('MyStories snapshot error:', err.message);
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  const handleInvite = async (story) => {
    const serverUrl = Constants.expoConfig?.extra?.videoConverterUrl || 'https://reflectlymobilex.onrender.com';
    const joinUrl = `${serverUrl}/join/${story.id}`;
    try {
      await Share.share({
        message: t('myStories.invite_message', { name: story.name, url: joinUrl }),
        title: story.name,
      });
    } catch (e) {}
  };

  const openStory = (story) => {
    setStoryName(story.name);
    setCurrentStoryId(story.id);
    go('EditRoom');
  };

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

  const getStatusDescription = (status) => {
    switch (status) {
      case 'draft': return t('myStories.status_desc_draft');
      case 'shared': return t('myStories.status_desc_shared');
      case 'processing': return t('myStories.status_desc_processing');
      case 'completed': return t('myStories.status_desc_completed');
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={bgVideoRef}
        source={{ uri: 'https://storage.googleapis.com/reflectly-playback.firebasestorage.app/assets/home-background.mp4' }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        pointerEvents="none"
      />
      <View style={styles.bgOverlay} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('myStories.title')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => {}}>
          <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>{t('myStories.loading')}</Text>
          </View>
        ) : !user ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={60} color="rgba(255,255,255,0.25)" />
            <Text style={styles.emptyTitle}>{t('myStories.login_required_title')}</Text>
            <Text style={styles.emptySubtitle}>{t('myStories.login_required_subtitle')}</Text>
            <TouchableOpacity style={styles.loginButton} onPress={() => go('Auth')}>
              <Text style={styles.loginButtonText}>{t('myStories.login_button')}</Text>
            </TouchableOpacity>
          </View>
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={60} color="rgba(255,255,255,0.25)" />
            <Text style={styles.emptyTitle}>{t('myStories.empty_title')}</Text>
            <Text style={styles.emptySubtitle}>{t('myStories.empty_subtitle')}</Text>
          </View>
        ) : (
          <View style={styles.storiesGrid}>
            {stories.map((story) => {
              const videoUrl = story.finalVideoUrl || story.videoUrl || null;
              const creatorVideoUrl = story.sourceVideoUrl || null;
              const isCubeFormat = story.format === 'cube-3d';
              const isCompleted = !!videoUrl || story.status === 'completed' || isCubeFormat;
              return (
                <View key={story.id} style={styles.storyCard}>
                  {/* New videos banner — tappable, navigates to EditRoom */}
                  {(story.pendingReflectionsCount || 0) > 0 && (
                    <TouchableOpacity
                      style={styles.newVideosBanner}
                      onPress={() => openStory(story)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="videocam" size={14} color="#fff" />
                      <Text style={styles.newVideosBannerText}>
                        {story.lastPlayerName
                          ? (story.pendingReflectionsCount > 1
                            ? t('myStories.new_videos_one_more', { playerName: story.lastPlayerName, count: story.pendingReflectionsCount - 1 })
                            : t('myStories.new_videos_one', { playerName: story.lastPlayerName }))
                          : t('myStories.new_videos_count', { count: story.pendingReflectionsCount })}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                  {/* Declined consent banner — tappable, opens invite sheet */}
                  {!!story.declinedConsentName && (
                    <TouchableOpacity
                      style={styles.declinedBanner}
                      onPress={() => handleInvite(story)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#fff" />
                      <Text style={styles.declinedBannerText}>
                        {t('myStories.declined_banner', { playerName: story.declinedConsentName })}
                      </Text>
                      <Ionicons name="person-add-outline" size={14} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.storyMain} onPress={() => handleStoryPress(story)}>
                    <View style={[styles.storyThumbnail, isCompleted && styles.storyThumbnailDone]}>
                      <Ionicons
                        name={isCompleted ? 'play-circle' : 'videocam'}
                        size={28}
                        color={isCompleted ? 'rgba(255,255,255,0.85)' : 'rgba(132,70,176,0.85)'}
                      />
                    </View>
                    <View style={styles.storyInfo}>
                      <Text style={styles.storyTitle}>{story.name || story.storyName || ''}</Text>
                      <Text style={styles.storyStatusDesc}>
                        {getStatusDescription(story.status)}
                      </Text>
                      {story.communitySettings?.communityMode && story.currentPlayers > 0 && (
                        <Text style={styles.storyParticipants}>
                          {t('myStories.participants_joined', { count: story.currentPlayers })}
                        </Text>
                      )}
                      <Text style={styles.storyMeta}>{formatDate(story.completedAt || story.createdAt || story.updatedAt)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(story.status) + '28' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(story.status) }]}>
                          {getStatusText(story.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.playButton}>
                      <Ionicons
                        name={isCompleted ? 'play' : 'chevron-forward'}
                        size={isCompleted ? 14 : 18}
                        color="rgba(255,255,255,0.6)"
                      />
                    </View>
                  </TouchableOpacity>

                  {isCompleted && (
                    <View style={styles.completedActions}>
                      <TouchableOpacity
                        style={styles.completedAction}
                        onPress={() => {
                          if (videoUrl) {
                            setWatchData({ url: videoUrl, name: story.name, story });
                          } else {
                            setStoryName(story.name);
                            setCurrentStoryId(story.id);
                            setVideoFormat(story.format);
                            go('FinalVideo');
                          }
                        }}
                      >
                        <Ionicons name="play-circle-outline" size={15} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.completedActionText}>{t('myStories.watch')}</Text>
                      </TouchableOpacity>
                      {!!creatorVideoUrl && (
                        <TouchableOpacity
                          style={styles.completedAction}
                          onPress={() => setWatchData({ url: creatorVideoUrl, name: story.name, story })}
                        >
                          <Ionicons name="camera-outline" size={15} color="rgba(255,255,255,0.4)" />
                          <Text style={[styles.completedActionText, styles.completedActionTextDim]}>
                            {t('myStories.my_recording')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.completedAction}
                        onPress={() => openStory(story)}
                      >
                        <Ionicons name="create-outline" size={15} color="rgba(255,255,255,0.4)" />
                        <Text style={[styles.completedActionText, styles.completedActionTextDim]}>
                          {t('finalVideo.btn_edit')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isCompleted && !!creatorVideoUrl && (
                    <TouchableOpacity
                      style={styles.completedAction}
                      onPress={() => setWatchData({ url: creatorVideoUrl, name: story.name, story })}
                    >
                      <Ionicons name="camera-outline" size={15} color="rgba(255,255,255,0.4)" />
                      <Text style={[styles.completedActionText, styles.completedActionTextDim]}>
                        {t('myStories.my_recording')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!isCompleted && (
                    <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvite(story)}>
                      <Ionicons name="person-add-outline" size={14} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.inviteButtonText}>{t('myStories.invite_btn')}</Text>
                    </TouchableOpacity>
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
                      <Ionicons name="trash-outline" size={17} color="rgba(231,76,60,0.55)" />
                    </TouchableOpacity>
                  )}
                </View>
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
    backgroundColor: '#000',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
    fontSize: 26,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 3,
  },

  // Scroll
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 90,
  },

  // States
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  loginButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
  },

  // Cards
  storiesGrid: {
    gap: 12,
  },
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  newVideosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,120,210,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newVideosBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  declinedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(192,57,43,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  declinedBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  storyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  storyThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(132,70,176,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  storyThumbnailDone: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  storyStatusDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '300',
    marginTop: 4,
    textAlign: 'right',
  },
  storyParticipants: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  storyMeta: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'right',
  },
  statusBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // Completed actions
  completedActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 20,
  },
  completedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  completedActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  completedActionTextDim: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Invite
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  inviteButtonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Delete
  deleteButton: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  deleteConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  deleteConfirmText: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '500',
  },
  confirmYes: {
    backgroundColor: 'rgba(231,76,60,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmYesText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmNo: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmNoText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
});
