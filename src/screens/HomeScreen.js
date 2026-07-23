import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { analyticsService } from '../services/analyticsService';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import theme from '../theme/theme';

const HOME_BG_VIDEO_URL = 'https://storage.googleapis.com/reflectly-playback.firebasestorage.app/assets/home-background.mp4';
const HOME_BG_VIDEO_CACHE = `${FileSystem.cacheDirectory}home-background.mp4`;

// Clip count → per-clip duration:
// 1-9 clips  → 60s | 10-20 → 30s | 21-40 → 5s | 40+ → 3s
const PARTICIPANT_OPTIONS = [
  { label: '1-9',   clipCount: 3, maxClipDuration: 45 },
  { label: '10-20', clipCount: 1, maxClipDuration: 30 },
  { label: '21-40', clipCount: 1, maxClipDuration: 5  },
  { label: '40+',   clipCount: 1, maxClipDuration: 3  },
];

export const HomeScreen = () => {
  const { t, i18n } = useTranslation();
  const { go } = useNav();
  const bgVideoRef = useRef(null);
  const storyName = useAppState((state) => state.storyName);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  const setCurrentInviteCode = useAppState((state) => state.setCurrentInviteCode);
  const setStoryClipCount = useAppState((state) => state.setStoryClipCount);
  const setStoryMaxClipDuration = useAppState((state) => state.setStoryMaxClipDuration);
  const user = useAppState((state) => state.user);
  const [localStoryName, setLocalStoryName] = useState(storyName || '');
  const [isCreating, setIsCreating] = useState(false);
  const [bgVideoUri, setBgVideoUri] = useState(HOME_BG_VIDEO_URL);

  // Cache background video locally after first download
  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(HOME_BG_VIDEO_CACHE);
        if (info.exists) {
          setBgVideoUri(HOME_BG_VIDEO_CACHE);
        } else {
          await FileSystem.downloadAsync(HOME_BG_VIDEO_URL, HOME_BG_VIDEO_CACHE);
          setBgVideoUri(HOME_BG_VIDEO_CACHE);
        }
      } catch (e) {
        // fallback to remote URL — already set as default
      }
    })();
  }, []);
  const [participantRange, setParticipantRange] = useState('1-9');
  const [pendingCreatorApps, setPendingCreatorApps] = useState([]); // biz: apps awaiting creator approval
  const [myPlayerApps, setMyPlayerApps] = useState([]);             // player: my pending/approved apps
  const [storiesWithNewVideos, setStoriesWithNewVideos] = useState([]); // creator: stories with new reflections
  const enterPlayerMode = useAppState((state) => state.enterPlayerMode);
  const currentScreen = useAppState((state) => state.currentScreen);
  const storyCreationMode = useAppState((state) => state.storyCreationMode);
  const isCommunity = storyCreationMode === 'community';

  const refreshBanners = (uid) => {
    if (!uid) return;
    storiesService.getPendingApplicationsForCreator(uid).then(res => {
      if (res.success) setPendingCreatorApps(res.applications);
    });
    storiesService.getMyApplications(uid).then(res => {
      if (res.success) setMyPlayerApps(res.applications);
    });
  };

  // Real-time listener: update "new videos" banner the moment Firestore changes
  useEffect(() => {
    if (!user?.uid) { setStoriesWithNewVideos([]); return; }
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const withNew = all.filter(s => (s.pendingReflectionsCount || 0) > 0);
      console.log(`🏠 HomeSnapshot: ${all.length} stories, withNew=${withNew.length}, counts=${all.map(s=>s.pendingReflectionsCount||0).join(',')}`);
      setStoriesWithNewVideos(withNew);
    }, (err) => console.warn('HomeScreen stories snapshot error:', err.message));
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    refreshBanners(user?.uid);
  }, [user?.uid]);

  // Refresh application banners every time we return to HomeScreen
  useEffect(() => {
    if (currentScreen === 'Home') refreshBanners(user?.uid);
  }, [currentScreen]);

  const handleJoinApproved = async (app) => {
    try {
      const storyRes = await storiesService.getStory(app.storyId);
      if (storyRes.success) {
        enterPlayerMode(app.storyId, storyRes.story);
      }
    } catch (e) {}
  };

  // ── All functional logic unchanged ──────────────────────────────────────
  const navigateToRecord = async () => {
    if (!localStoryName.trim()) {
      return;
    }

    if (!user) {
      Alert.alert(t('home.auth_required_title'), t('home.auth_required_message'));
      go('Auth');
      return;
    }

    setIsCreating(true);
    setStoryName(localStoryName.trim());

    const selectedOption = PARTICIPANT_OPTIONS.find(o => o.label === participantRange) || PARTICIPANT_OPTIONS[0];

    const result = await storiesService.createStory(user.uid, {
      name: localStoryName.trim(),
      storyType: isCommunity ? 'community' : 'private',
      maxParticipants: participantRange,
      clipCount: selectedOption.clipCount,
      maxClipDuration: selectedOption.maxClipDuration,
      language: i18n.language || 'he',
      ...(isCommunity && {
        communitySettings: { communityMode: true, maxPlayers: 5, approvalMode: 'open' },
      }),
    }, {
      displayName: user.displayName || '',
      email: user.email || '',
    });

    if (result.success) {
      setCurrentStoryId(result.storyId);
      setCurrentInviteCode(result.inviteCode);
      setStoryClipCount(selectedOption.clipCount);
      setStoryMaxClipDuration(selectedOption.maxClipDuration);
      if (isCommunity) {
        useAppState.getState().setCommunitySettings({ communityMode: true, maxPlayers: 5, approvalMode: 'open' });
      }
      analyticsService.storyCreated(result.storyId);
      console.log('🎬 Story created in Firebase:', result.storyId);
      console.log('📎 Invite code:', result.inviteCode);
    } else {
      Alert.alert(t('common.error'), t('home.error_create_story'));
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    go('Record');
  };
  // ────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Full-screen looping background video at half speed */}
      <Video
        ref={bgVideoRef}
        source={{ uri: bgVideoUri }}
        style={styles.bgVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        rate={1.0}
        pointerEvents="none"
        posterSource={require('../../assets/home-bg-poster.jpg')}
        usePoster
      />
      <View style={styles.bgOverlay} pointerEvents="none" />

      {/* Top bar — floating over video */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => useAppState.getState().setSideMenuOpen(true)}
          accessibilityLabel="Open navigation menu"
        >
          <Ionicons name="menu" size={24} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => useAppState.getState().navigateTo('Settings')}
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Hero title */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Rilio</Text>
        {isCommunity ? (
          <>
            <Text style={styles.heroTaglineCommunity}>{t('home.community_tagline')}</Text>
            <Text style={styles.communitySubtitle}>{t('home.community_subtitle')}</Text>
          </>
        ) : (
          <Text style={styles.heroTagline}>{t('home.tagline')}</Text>
        )}
      </View>

      {/* Creator banner — pending applications to review */}
      {pendingCreatorApps.length > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => {
            useAppState.getState().setCurrentStoryId(pendingCreatorApps[0].storyId);
            go('EditRoom');
          }}
        >
          <Ionicons name="people" size={16} color="#fff" />
          <Text style={styles.pendingBannerText}>
            {pendingCreatorApps.length === 1
              ? `בקשת הצטרפות ממתינה לאישורך`
              : `${pendingCreatorApps.length} בקשות הצטרפות ממתינות לאישורך`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}

      {/* Creator — new videos arrived banners */}
      {storiesWithNewVideos.map(story => (
        <TouchableOpacity
          key={story.id}
          style={[styles.pendingBanner, styles.newVideosBanner]}
          onPress={() => {
            useAppState.getState().setCurrentStoryId(story.id);
            go('EditRoom');
          }}
        >
          <Ionicons name="videocam" size={16} color="#fff" />
          <Text style={styles.pendingBannerText}>
            {`התקבלו ${story.pendingReflectionsCount} סרטונים לפרויקט '${story.name || story.storyName || ''}'`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      ))}

      {/* Player approved banners only — tap to go record */}
      {myPlayerApps.filter(a => a.status === 'approved').map(app => (
        <TouchableOpacity
          key={app.id}
          style={[styles.pendingBanner, styles.approvedBanner]}
          onPress={() => handleJoinApproved(app)}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.pendingBannerText}>
            {`אושרת! לחץ להתחיל לצלם ב'${app.storyName || 'סיפור'}'`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      ))}

      {/* Input area */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.storyInput}
            placeholder={t('home.story_input_placeholder')}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={localStoryName}
            onChangeText={setLocalStoryName}
            onSubmitEditing={navigateToRecord}
            returnKeyType="go"
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.arrowButton, (!localStoryName.trim() || isCreating) && styles.arrowButtonDisabled]}
            onPress={navigateToRecord}
            disabled={!localStoryName.trim() || isCreating}
          >
            {isCreating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-forward" size={22} color="#fff" />
            }
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 148 : 128,
    paddingBottom: 48,
  },
  heroTitle: {
    fontSize: 64,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 4,
  },
  heroTagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    marginTop: 8,
  },
  heroTaglineCommunity: {
    fontSize: 22,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 2,
    marginTop: 12,
  },
  communitySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: 'rgba(132, 70, 176, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  waitingBanner: {
    backgroundColor: 'rgba(180, 120, 0, 0.85)',
  },
  approvedBanner: {
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
  },
  newVideosBanner: {
    backgroundColor: 'rgba(52, 120, 210, 0.9)',
  },
  pendingBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  bannerActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bannerActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerDismissBtn: {
    padding: 4,
  },

  // Input section — extra bottom padding to clear the BottomTabBar
  inputSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  storyInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 18,
    fontSize: 17,
    color: '#fff',
  },
  arrowButton: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.4,
  },

});
