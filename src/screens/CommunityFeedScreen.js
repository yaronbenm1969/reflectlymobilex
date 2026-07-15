import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { usersService } from '../services/usersService';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

const CreatorVideoModal = ({ uri, onClose }) => {
  const player = useVideoPlayer(uri, (p) => { p.play(); });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>
        <VideoView
          player={player}
          style={modalStyles.video}
          contentFit="contain"
          nativeControls
        />
      </View>
    </Modal>
  );
};

export const CommunityFeedScreen = () => {
  const { t, i18n } = useTranslation();
  const myLang = i18n.language || 'he';
  const { go, back } = useNav();
  const user = useAppState((state) => state.user);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);
  const setPendingAfterAuth = useAppState((state) => state.setPendingAfterAuth);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [thumbnailMap, setThumbnailMap] = useState({});
  const [creatorThumbMap, setCreatorThumbMap] = useState({});
  const [videoModalUri, setVideoModalUri] = useState(null);

  useEffect(() => {
    loadCommunityStories();
  }, []);

  const loadCommunityStories = async () => {
    setLoading(true);
    const result = await storiesService.getCommunityStories();
    if (result.success) {
      const open = result.stories.filter((s) => {
        const cs = s.communitySettings || {};
        const current = s.currentPlayers || 0;
        const max = cs.maxPlayers || 9;
        return current < max;
      });
      setStories(open);
      loadThumbnails(open);
    }
    setLoading(false);
  };

  const loadThumbnails = async (storyList) => {
    const results = await Promise.all(
      storyList.map(async (story) => {
        const { reflections } = await storiesService.getStoryReflections(story.id, 4);
        const uris = [];
        for (const ref of reflections) {
          const videoUrl = ref.videoUrl || ref.convertedUrl || ref.url;
          if (!videoUrl) continue;
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1500 });
            uris.push(uri);
          } catch (e) {}
        }
        let creatorThumb = null;
        if (story.videoUri) {
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(story.videoUri, { time: 0 });
            creatorThumb = uri;
          } catch (e) {}
        }
        return { storyId: story.id, uris, creatorThumb };
      })
    );
    const map = {};
    const creatorMap = {};
    results.forEach(({ storyId, uris, creatorThumb }) => {
      map[storyId] = uris;
      if (creatorThumb) creatorMap[storyId] = creatorThumb;
    });
    setThumbnailMap(map);
    setCreatorThumbMap(creatorMap);
  };

  const handleApply = async (story) => {
    if (!user) {
      Alert.alert(
        t('community.auth_required_title'),
        t('community.auth_required_text'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('community.auth_required_register'),
            onPress: () => {
              setPendingAfterAuth({ action: 'communityApply' });
              go('Auth');
            },
          },
        ]
      );
      return;
    }

    const profileRes = await usersService.getUserProfile(user.uid);
    const profile = profileRes.success ? profileRes.profile : null;
    if (!profile?.bio?.trim()) {
      Alert.alert(
        t('community.profile_required_title'),
        t('community.profile_required_text'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('community.profile_required_fill'),
            onPress: () => go('MemberOnboarding', { afterSave: 'CommunityFeed' }),
          },
        ]
      );
      return;
    }

    const cs = story.communitySettings || {};
    const approvalMode = cs.approvalMode || 'manual';
    console.log('🏘️ community join:', story.id, 'approvalMode=', cs.approvalMode, '→', approvalMode);

    setApplyingId(story.id);
    try {
      const profileSnapshot = profile ? {
        bio: profile.bio || '',
        actingExperience: profile.actingExperience || '',
        demoReelUrl: profile.demoReelUrl || '',
        photoUrl: profile.photoUrl || null,
      } : null;

      if (approvalMode === 'open') {
        await storiesService.applyToStory(story.id, user.uid, user.displayName, true, story.userId, profileSnapshot, story.name);
        enterPlayerMode(story.id, story);
      } else {
        const result = await storiesService.applyToStory(story.id, user.uid, user.displayName, false, story.userId, profileSnapshot, story.name);
        if (result.success) {
          Alert.alert(
            t('community.application_sent_title'),
            t('community.application_sent_text'),
            [{ text: t('common.ok') }]
          );
        }
      }
    } catch (e) {
      console.error('Apply error:', e);
    }
    setApplyingId(null);
  };

  const getSpotsLeft = (story) => {
    const cs = story.communitySettings || {};
    const current = story.currentPlayers || 0;
    const max = cs.maxPlayers || 9;
    return max - current;
  };

  const LANG_LABELS = { he: 'עברית 🇮🇱', en: 'English 🇺🇸' };

  const renderStory = (story) => {
    const cs = story.communitySettings || {};
    const spotsLeft = getSpotsLeft(story);
    const isManual = cs.approvalMode === 'manual';
    const isApplying = applyingId === story.id;
    const current = story.currentPlayers || 0;
    const max = cs.maxPlayers || 9;
    const progressPct = Math.min(current / max, 1);
    const creatorThumb = creatorThumbMap[story.id];
    const hasVideo = !!story.videoUri;

    return (
      <Card key={story.id} style={styles.storyCard}>
        <View style={styles.cardTop}>
          <TouchableOpacity
            style={styles.iconWrap}
            onPress={() => hasVideo && setVideoModalUri(story.videoUri)}
            activeOpacity={hasVideo ? 0.75 : 1}
          >
            {creatorThumb ? (
              <>
                <Image source={{ uri: creatorThumb }} style={styles.iconThumb} />
                <View style={styles.playOverlay}>
                  <Ionicons name="play" size={16} color="#fff" />
                </View>
              </>
            ) : hasVideo ? (
              <>
                <View style={styles.iconPlaceholder}>
                  <Ionicons name="film-outline" size={24} color={theme.colors.secondary} />
                </View>
                <View style={styles.playOverlay}>
                  <Ionicons name="play" size={16} color="#fff" />
                </View>
              </>
            ) : (
              <Ionicons name="videocam" size={28} color={theme.colors.secondary} />
            )}
          </TouchableOpacity>
          <View style={styles.cardInfo}>
            <Text style={styles.storyName}>{story.name}</Text>
            {story.creatorName ? (
              <Text style={styles.creatorName}>{t('community.creator_label', { creatorName: story.creatorName })}</Text>
            ) : null}
            <View style={styles.badgesRow}>
              <View style={styles.spotsBadge}>
                <Ionicons name="person-add-outline" size={13} color={theme.colors.accent} />
                <Text style={styles.spotsText}>{t('community.spots_left', { count: spotsLeft })}</Text>
              </View>
              <View style={[styles.approvalBadge, isManual && styles.approvalBadgeManual]}>
                <Ionicons
                  name={isManual ? 'checkmark-circle-outline' : 'lock-open-outline'}
                  size={13}
                  color={isManual ? '#e67e22' : '#27ae60'}
                />
                <Text style={[styles.approvalText, isManual && styles.approvalTextManual]}>
                  {isManual ? t('community.approval_manual') : t('community.approval_open')}
                </Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{t('community.progress_label', { current, max })}</Text>
            </View>
          </View>
        </View>
        {(thumbnailMap[story.id] || []).length > 0 && (
          <View style={styles.facesRow}>
            {(thumbnailMap[story.id] || []).map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={[styles.faceCircle, { marginLeft: idx === 0 ? 0 : -10 }]}
              />
            ))}
            {current > 4 && (
              <View style={[styles.faceCircle, styles.faceMore, { marginLeft: -10 }]}>
                <Text style={styles.faceMoreText}>+{current - 4}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.callToAction}>
          {t('community.call_to_action', { name: story.name })}
        </Text>
        <AppButton
          title={isApplying ? t('community.applying') : isManual ? t('community.btn_apply') : t('community.btn_join')}
          onPress={() => handleApply(story)}
          variant="primary"
          size="md"
          fullWidth
          disabled={isApplying}
          style={styles.joinButton}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('community.title')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadCommunityStories}>
          <Ionicons name="refresh" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.stateText}>{t('community.loading')}</Text>
          </View>
        ) : stories.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="people-outline" size={60} color={theme.colors.subtext} />
            <Text style={styles.stateTitle}>{t('community.empty_title')}</Text>
            <Text style={styles.stateText}>{t('community.empty_text')}</Text>
          </View>
        ) : (() => {
            const myStories = stories.filter(s => (s.language || 'he') === myLang);
            const otherStories = stories.filter(s => (s.language || 'he') !== myLang);
            const otherByLang = {};
            otherStories.forEach(s => {
              const lang = s.language || 'he';
              if (!otherByLang[lang]) otherByLang[lang] = [];
              otherByLang[lang].push(s);
            });
            return (
              <View style={styles.list}>
                {myStories.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>
                        {LANG_LABELS[myLang] || myLang}
                      </Text>
                    </View>
                    {myStories.map(renderStory)}
                  </>
                )}
                {Object.entries(otherByLang).map(([lang, langStories]) => (
                  <View key={lang}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>
                        {LANG_LABELS[lang] || lang}
                      </Text>
                    </View>
                    {langStories.map(renderStory)}
                  </View>
                ))}
                {myStories.length === 0 && otherStories.length === 0 && (
                  <View style={styles.centerState}>
                    <Ionicons name="people-outline" size={60} color={theme.colors.subtext} />
                    <Text style={styles.stateTitle}>{t('community.empty_title')}</Text>
                    <Text style={styles.stateText}>{t('community.empty_text')}</Text>
                  </View>
                )}
              </View>
            );
          })()
        }
      </ScrollView>

      {videoModalUri && (
        <CreatorVideoModal uri={videoModalUri} onClose={() => setVideoModalUri(null)} />
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
  contentContainer: {
    paddingBottom: 90,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[8],
  },
  stateTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[3],
  },
  stateText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  list: {
    gap: theme.spacing[3],
  },
  storyCard: {
    padding: theme.spacing[4],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing[3],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing[3],
    overflow: 'hidden',
  },
  iconThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
  },
  iconPlaceholder: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.secondary}15`,
  },
  playOverlay: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  storyName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  creatorName: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    textAlign: 'right',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${theme.colors.accent}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  spotsText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#27ae6015',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  approvalBadgeManual: {
    backgroundColor: '#e67e2215',
  },
  approvalText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '500',
  },
  approvalTextManual: {
    color: '#e67e22',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing[2],
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
  },
  progressText: {
    fontSize: 11,
    color: theme.colors.subtext,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'right',
  },
  facesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[3],
    marginTop: theme.spacing[1],
  },
  faceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.white,
    backgroundColor: '#ddd',
    overflow: 'hidden',
  },
  faceMore: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMoreText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  instructions: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'right',
    marginBottom: theme.spacing[3],
    fontSize: 14,
  },
  callToAction: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'right',
    fontStyle: 'italic',
    marginBottom: theme.spacing[3],
    lineHeight: 20,
  },
  joinButton: {
    marginTop: theme.spacing[1],
  },
  sectionHeader: {
    paddingVertical: theme.spacing[2],
  },
  sectionHeaderText: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    fontWeight: '700',
    textAlign: 'right',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 55,
    right: 20,
    zIndex: 10,
  },
  video: {
    width: '100%',
    height: 400,
  },
});

export default CommunityFeedScreen;
