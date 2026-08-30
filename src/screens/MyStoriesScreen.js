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
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');
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

// ── Story Card ────────────────────────────────────────────────────────────────
const StoryCard = ({ story, onOpenStory, onWatch, onWatchCreator, onInvite, onDelete, confirmingDeleteId, setConfirmingDeleteId, t }) => {
  const bgOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(bgOpacity, { toValue: 0, duration: 900, useNativeDriver: true }).start();
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  const videoUrl = story.finalVideoUrl || story.videoUrl || null;
  const creatorVideoUrl = story.videoUri || null;
  const isCompleted = !!videoUrl || story.status === 'completed';

  return (
    <View style={styles.storyCard}>
      {/* Background image — fades out after ~1s leaving grey card */}
      <Animated.Image
        source={require('../../assets/Home- beckground.jpg.jpg')}
        style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity, borderRadius: 18 }]}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10,12,22,0.60)', borderRadius: 18 }]} />

      {/* Wave decoration */}
      <View style={styles.cardWaveContainer} pointerEvents="none">
        <View style={styles.cardWave1} />
        <View style={styles.cardWave2} />
      </View>

      {/* New videos banner — gold */}
      {(story.pendingReflectionsCount || 0) > 0 && (
        <TouchableOpacity style={styles.newVideosBanner} onPress={() => onOpenStory(story)} activeOpacity={0.8}>
          <Ionicons name="videocam" size={14} color="#0a0a0a" />
          <Text style={styles.newVideosBannerText}>
            {story.lastPlayerName
              ? (story.pendingReflectionsCount > 1
                ? t('myStories.new_videos_one_more', { playerName: story.lastPlayerName, count: story.pendingReflectionsCount - 1 })
                : t('myStories.new_videos_one', { playerName: story.lastPlayerName }))
              : t('myStories.new_videos_count', { count: story.pendingReflectionsCount })}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(0,0,0,0.55)" />
        </TouchableOpacity>
      )}

      {/* Declined consent banner */}
      {!!story.declinedConsentName && (
        <TouchableOpacity style={styles.declinedBanner} onPress={() => onInvite(story)} activeOpacity={0.8}>
          <Ionicons name="close-circle-outline" size={14} color="#fff" />
          <Text style={styles.declinedBannerText}>
            {t('myStories.declined_banner', { playerName: story.declinedConsentName })}
          </Text>
          <Ionicons name="person-add-outline" size={14} color="rgba(90,170,255,0.85)" />
        </TouchableOpacity>
      )}

      {/* Main row */}
      <TouchableOpacity style={styles.storyMain} onPress={() => isCompleted ? onWatch() : onOpenStory(story)}>
        <View style={[styles.storyThumbnail, isCompleted && styles.storyThumbnailDone]}>
          <Ionicons
            name={isCompleted ? 'play-circle' : 'videocam'}
            size={28}
            color="rgba(255,255,255,0.85)"
          />
        </View>
        <View style={styles.storyInfo}>
          <Text style={styles.storyTitle}>{story.name || story.storyName || ''}</Text>
          <Text style={styles.storyStatusDesc}>{t(`myStories.status_desc_${story.status || 'draft'}`)}</Text>
          {story.communitySettings?.communityMode && story.currentPlayers > 0 && (
            <Text style={styles.storyParticipants}>
              {t('myStories.participants_joined', { count: story.currentPlayers })}
            </Text>
          )}
          <Text style={styles.storyMeta}>{story.completedAt || story.createdAt || story.updatedAt
            ? (() => { const d = (story.completedAt || story.createdAt || story.updatedAt); return (d?.toDate ? d.toDate() : new Date(d)).toLocaleDateString('he-IL'); })()
            : ''}</Text>
        </View>
        <View style={styles.playButton}>
          <Ionicons name={isCompleted ? 'play' : 'chevron-forward'} size={isCompleted ? 14 : 18} color="rgba(255,255,255,0.6)" />
        </View>
      </TouchableOpacity>

      {/* Stats strip — always shown */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Ionicons name="videocam-outline" size={12} color="#7ecfe0" />
          <Text style={styles.statText}>{story.currentPlayers || 0} שיקופים</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={12} color="#7ecfe0" />
          <Text style={styles.statText}>{story.maxParticipants || story.currentPlayers || 1} משתתפים</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.statItem}>
          <Ionicons
            name={story.communitySettings?.communityMode ? 'lock-open-outline' : 'lock-closed-outline'}
            size={12}
            color="#7ecfe0"
          />
          <Text style={styles.statText}>{story.communitySettings?.communityMode ? 'ציבורי' : 'פרטי'}</Text>
        </View>
      </View>

      {/* Edit Room button — always visible */}
      <TouchableOpacity style={styles.editRoomBtn} onPress={() => onOpenStory(story)}>
        <Ionicons name="create-outline" size={17} color="rgba(228,180,85,0.95)" />
        <Text style={styles.editRoomBtnText}>מעבר לחדר עריכה</Text>
        <Ionicons name="chevron-forward" size={15} color="rgba(228,180,85,0.55)" />
      </TouchableOpacity>

      {/* Completed actions */}
      {isCompleted && (
        <View style={styles.completedActions}>
          <TouchableOpacity style={styles.completedAction} onPress={onWatch}>
            <Ionicons name="play-circle-outline" size={15} color="rgba(255,255,255,0.75)" />
            <Text style={styles.completedActionText}>{t('myStories.watch')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.completedAction} onPress={onWatchCreator}>
            <Ionicons name={creatorVideoUrl ? 'play-circle-outline' : 'videocam-off-outline'} size={15}
              color={creatorVideoUrl ? 'rgba(200,155,70,0.75)' : 'rgba(255,255,255,0.25)'} />
            <Text style={[styles.completedActionText, !creatorVideoUrl && styles.completedActionTextDim]}>
              {creatorVideoUrl ? 'צפה בסרטון מוביל' : 'ללא סרטון מוביל'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.completedAction} onPress={() => onOpenStory(story)}>
            <Ionicons name="create-outline" size={15} color="rgba(255,255,255,0.4)" />
            <Text style={[styles.completedActionText, styles.completedActionTextDim]}>{t('finalVideo.btn_edit')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Invite button — not completed */}
      {!isCompleted && (
        <TouchableOpacity style={styles.inviteButton} onPress={() => onInvite(story)}>
          <Ionicons name="person-add-outline" size={14} color="rgba(90,170,255,0.85)" />
          <Text style={styles.inviteButtonText}>{t('myStories.invite_btn')}</Text>
        </TouchableOpacity>
      )}

      {/* Creator video button — not completed */}
      {!isCompleted && (
        <TouchableOpacity
          style={[styles.creatorVideoBtn, !creatorVideoUrl && styles.creatorVideoBtnDim]}
          onPress={onWatchCreator}
        >
          <Ionicons name={creatorVideoUrl ? 'play-circle-outline' : 'videocam-off-outline'} size={17}
            color={creatorVideoUrl ? 'rgba(228,180,85,0.95)' : 'rgba(200,155,70,0.35)'} />
          <Text style={[styles.creatorVideoBtnText, !creatorVideoUrl && styles.creatorVideoBtnTextDim]}>
            {creatorVideoUrl ? 'צפה בסרטון המוביל' : 'סרטון מוביל לא נשמר'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Delete */}
      {confirmingDeleteId === story.id ? (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmText}>{t('myStories.delete_confirm')}</Text>
          <TouchableOpacity style={styles.confirmYes} onPress={() => onDelete(story.id)}>
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
};

export const MyStoriesScreen = () => {
  const { t } = useTranslation();
  const { back, go } = useNav();
  const user = useAppState((state) => state.user);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  const setVideoFormat = useAppState((state) => state.setVideoFormat);

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
      case 'draft': return 'rgba(90,170,255,0.85)';
      case 'shared': return '#2196F3';
      case 'processing': return '#FF9800';
      case 'completed': return 'rgba(90,170,255,0.85)';
      default: return 'rgba(90,170,255,0.85)';
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
      <Image
        source={require('../../assets/Home- beckground.jpg.jpg')}
        style={styles.bgImage}
        resizeMode="contain"
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
              const creatorVideoUrl = story.videoUri || null;
              return (
                <StoryCard
                  key={story.id}
                  story={story}
                  t={t}
                  confirmingDeleteId={confirmingDeleteId}
                  setConfirmingDeleteId={setConfirmingDeleteId}
                  onOpenStory={openStory}
                  onWatch={() => {
                    if (videoUrl) {
                      setWatchData({ url: videoUrl, name: story.name, story });
                    } else {
                      setStoryName(story.name);
                      setCurrentStoryId(story.id);
                      setVideoFormat(story.format);
                      go('FinalVideo', { fromProjects: true });
                    }
                  }}
                  onWatchCreator={() => {
                    if (creatorVideoUrl) {
                      setWatchData({ url: creatorVideoUrl, name: story.name, story });
                    } else {
                      Alert.alert('סרטון מוביל', 'הסרטון לא נשמר עדיין. כנס לעריכת הפרויקט ושמור שוב כדי להוסיף אותו לפלואו.');
                    }
                  }}
                  onInvite={handleInvite}
                  onDelete={deleteStory}
                />
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
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,50,120,0.52)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 18,
    backgroundColor: 'rgba(38, 40, 50, 0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(200,155,70,0.15)',
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
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(200,155,70,0.85)',
    letterSpacing: 0.5,
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
    color: 'rgba(200,155,70,0.55)',
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: 'rgba(228,180,85,0.90)',
    fontSize: 18,
    fontWeight: '300',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(208,163,72,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  loginButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.35)',
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
    backgroundColor: 'rgba(55, 58, 72, 0.91)',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardWaveContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  cardWave1: {
    position: 'absolute',
    width: 280,
    height: 60,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 70,
    backgroundColor: 'rgba(135, 139, 162, 0.13)',
    top: -10,
    left: -80,
    transform: [{ rotate: '-8deg' }],
  },
  cardWave2: {
    position: 'absolute',
    width: 220,
    height: 80,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 70,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 10,
    backgroundColor: 'rgba(100, 104, 124, 0.10)',
    bottom: -15,
    right: -50,
    transform: [{ rotate: '7deg' }],
  },
  newVideosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,155,70,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newVideosBannerText: {
    flex: 1,
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: 'rgba(200,155,70,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  storyThumbnailDone: {
    backgroundColor: 'rgba(200,155,70,0.12)',
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    color: 'rgba(240,195,90,1.0)',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(220,170,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  storyStatusDesc: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '300',
    marginTop: 4,
    textAlign: 'right',
  },
  storyParticipants: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  storyMeta: {
    color: 'rgba(255,255,255,0.40)',
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

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(28,30,44,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200,155,70,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '500',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(200,155,70,0.30)',
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
    borderTopColor: 'rgba(200,155,70,0.15)',
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
    color: 'rgba(228,180,85,0.85)',
  },
  completedActionTextDim: {
    color: 'rgba(200,155,70,0.50)',
  },

  // Invite — raised 3D button
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: 'rgba(60,130,230,0.18)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(90,170,255,0.45)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(40,100,200,0.65)',
    shadowColor: 'rgba(50,120,220,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 4,
  },
  inviteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(130,195,255,0.95)',
  },

  // Creator video — raised gold button
  creatorVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: 'rgba(180,140,60,0.15)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.40)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(160,120,40,0.60)',
    shadowColor: 'rgba(200,155,70,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
  creatorVideoBtnDim: {
    backgroundColor: 'rgba(80,80,80,0.10)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(100,100,100,0.25)',
    shadowOpacity: 0,
    elevation: 0,
  },
  creatorVideoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(228,180,85,0.95)',
  },
  creatorVideoBtnTextDim: {
    color: 'rgba(200,155,70,0.30)',
  },

  // Edit Room button — always visible
  editRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    backgroundColor: 'rgba(180,140,60,0.20)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(228,180,85,0.55)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(160,120,40,0.70)',
    shadowColor: 'rgba(200,155,70,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  editRoomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(228,180,85,0.95)',
    flex: 1,
    textAlign: 'center',
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
