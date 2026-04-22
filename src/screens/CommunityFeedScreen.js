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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { usersService } from '../services/usersService';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const CommunityFeedScreen = () => {
  const { t, i18n } = useTranslation();
  const myLang = i18n.language || 'he';
  const { go, back } = useNav();
  const user = useAppState((state) => state.user);
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  // storyId → [thumbnailUri, ...]
  const [thumbnailMap, setThumbnailMap] = useState({});

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
        return { storyId: story.id, uris };
      })
    );
    const map = {};
    results.forEach(({ storyId, uris }) => { map[storyId] = uris; });
    setThumbnailMap(map);
  };

  const handleApply = async (story) => {
    if (!user) {
      Alert.alert(t('community.auth_required_title'), t('community.auth_required_text'), [
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }

    // Check if profile is complete — need bio at minimum
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
    const approvalMode = cs.approvalMode || 'open';

    setApplyingId(story.id);
    try {
      if (approvalMode === 'open') {
        // Join immediately — navigate to PlayerRecord, increment player count
        await storiesService.applyToStory(story.id, user.uid, user.displayName, true);
        enterPlayerMode(story.id, story);
      } else {
        // Manual approval — submit application and show message
        const result = await storiesService.applyToStory(story.id, user.uid, user.displayName);
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
    return (
      <Card key={story.id} style={styles.storyCard}>
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <Ionicons name="videocam" size={28} color={theme.colors.secondary} />
          </View>
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
        {story.instructions ? (
          <Text style={styles.instructions} numberOfLines={2}>
            {story.instructions}
          </Text>
        ) : null}
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

      <ScrollView style={styles.content}>
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
            // Group other stories by language
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
    width: 52,
    height: 52,
    borderRadius: theme.radii.md,
    backgroundColor: `${theme.colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing[3],
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
  joinButton: {
    marginTop: theme.spacing[1],
  },
});

export default CommunityFeedScreen;
