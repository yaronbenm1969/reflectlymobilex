import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Modal, ActivityIndicator, Animated,
  ImageBackground, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { SimpleFormatPreview } from '../components/SimpleFormatPreview';
import { backgroundsService } from '../services/backgroundsService';
import { storiesService } from '../services/storiesService';
import { storageService } from '../services/storageService';
import theme from '../theme/theme';

const ACCENT = 'rgba(90,170,255,0.85)'; // light blue — selected states & icons
const GOLD  = 'rgba(228,180,85,0.90)';  // gold — selected text only

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.videoConverterUrl ||
  'https://reflectlymobilex.onrender.com';

const UPLOAD_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
  ...(process.env.EXPO_PUBLIC_ACCESS_CODE
    ? { 'x-app-access-code': process.env.EXPO_PUBLIC_ACCESS_CODE }
    : {}),
};

const FALLBACK_SETS = [
  { set: 1,  key: 'Dm', bpm: 48,  tone: 'אובדן, עצב עמוק',   toneEn: 'loss, grief',            icon: 'rainy-outline',   trackCount: 0, previewUrl: null },
  { set: 2,  key: 'Am', bpm: 58,  tone: 'מלנכוליה, ערגה',     toneEn: 'melancholy, longing',    icon: 'moon-outline',    trackCount: 0, previewUrl: null },
  { set: 3,  key: 'C',  bpm: 64,  tone: 'תקווה, ריפוי',        toneEn: 'hope, healing',          icon: 'sunny-outline',   trackCount: 0, previewUrl: null },
  { set: 4,  key: 'G',  bpm: 70,  tone: 'חמימות, משפחה',       toneEn: 'warmth, family',         icon: 'heart-outline',   trackCount: 0, previewUrl: null },
  { set: 5,  key: 'D',  bpm: 76,  tone: 'הישג, גאווה',         toneEn: 'achievement, pride',     icon: 'trophy-outline',  trackCount: 0, previewUrl: null },
  { set: 6,  key: 'G',  bpm: 82,  tone: 'חגיגי, שמחה',         toneEn: 'celebratory, joyful',    icon: 'star-outline',    trackCount: 0, previewUrl: null },
  { set: 7,  key: 'D',  bpm: 92,  tone: 'אירוע גדול, קהילה',   toneEn: 'grand event, community', icon: 'people-outline',  trackCount: 0, previewUrl: null },
  { set: 8,  key: 'A',  bpm: 104, tone: 'ספורט, אנרגיה',       toneEn: 'sport, energy',          icon: 'flash-outline',   trackCount: 0, previewUrl: null },
  { set: 9,  key: 'F',  bpm: 66,  tone: 'אינטימי, אישי',       toneEn: 'intimate, personal',     icon: 'flower-outline',  trackCount: 0, previewUrl: null },
  { set: 10, key: 'C',  bpm: 60,  tone: 'אוניברסלי, אמביינט', toneEn: 'universal, ambient',     icon: 'globe-outline',   trackCount: 0, previewUrl: null },
  { set: 11, key: 'Em', bpm: 110, tone: 'דיגיטלי, מודרני',     toneEn: 'digital, modern',        icon: 'pulse-outline',   trackCount: 0, previewUrl: null },
];

// ── Participant → clip duration mapping (same as HomeScreen) ──────────────────
const PARTICIPANT_OPTIONS = [
  { label: '1-9',   clipCount: 3, maxClipDuration: 45 },
  { label: '10-20', clipCount: 1, maxClipDuration: 30 },
  { label: '21-40', clipCount: 1, maxClipDuration: 5  },
  { label: '40+',   clipCount: 1, maxClipDuration: 3  },
];

// ── Thumbnail for video backgrounds ──────────────────────────────────────────
const VideoThumb = ({ uri, style }) => {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    if (!uri) return;
    VideoThumbnails.getThumbnailAsync(uri, { time: 0 })
      .then(({ uri: t }) => setThumb(t))
      .catch(() => {});
  }, [uri]);
  if (!thumb) {
    return (
      <View style={[style, { backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="videocam" size={22} color="#a78bfa" />
      </View>
    );
  }
  return <Image source={{ uri: thumb }} style={style} />;
};

// ── Full-screen video preview modal ──────────────────────────────────────────
const VideoPreviewModal = ({ item, onSelect, onClose }) => {
  const { t } = useTranslation();
  const player = useVideoPlayer(item?.url || '', (p) => { p.loop = true; });
  useEffect(() => {
    if (item?.url) player.play(); else player.pause();
  }, [item?.url]);
  if (!item) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
        <View style={{ flexDirection: 'row', gap: 12, padding: 20, backgroundColor: 'white' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 12, alignItems: 'center', paddingVertical: 14 }}
            onPress={() => { onSelect(item.url, item.mediaType); onClose(); }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{t('playerRecord.bg_select')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: `${theme.colors.secondary}15`, borderRadius: 12, alignItems: 'center', paddingVertical: 14 }}
            onPress={onClose}
          >
            <Text style={{ color: theme.colors.subtext, fontSize: 15 }}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── EditStudioScreen ──────────────────────────────────────────────────────────
export const EditStudioScreen = () => {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const { go, back } = useNav();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Fade-in content after 1s (let background show first)
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ── Zustand ──
  const currentStoryId        = useAppState((s) => s.currentStoryId);
  const lastRecordingUri      = useAppState((s) => s.lastRecordingUri);
  const storyName             = useAppState((s) => s.storyName);
  const navigationParams      = useAppState((s) => s.navigationParams);
  const communitySettings     = useAppState((s) => s.communitySettings);
  const initFormat            = useAppState((s) => s.videoFormat);
  const initMusic             = useAppState((s) => s.selectedMusic);
  const initBgUrl             = useAppState((s) => s.backgroundVideoUrl);
  const initBgMediaType       = useAppState((s) => s.backgroundMediaType);
  const setVideoFormat          = useAppState((s) => s.setVideoFormat);
  const setSelectedMusic        = useAppState((s) => s.setSelectedMusic);
  const setPreferredMusicEngine = useAppState((s) => s.setPreferredMusicEngine);
  const setBackgroundVideoUrl   = useAppState((s) => s.setBackgroundVideoUrl);
  const setBackgroundMediaType  = useAppState((s) => s.setBackgroundMediaType);

  const returnTo = navigationParams?.returnTo || null;
  const communityMode = communitySettings?.communityMode ?? false;

  // ── Accordion ──
  const [expandedCard, setExpandedCard] = useState('music');
  const toggleCard = (id) => setExpandedCard((prev) => (prev === id ? null : id));

  // ── Music state ──
  const parseInitMusic = () => {
    if (!initMusic) return null;
    if (initMusic === 'none') return 'none';
    if (initMusic === 'ai-generated') return 'ai-generated';
    if (initMusic?.startsWith('suno-set-')) return parseInt(initMusic.replace('suno-set-', ''));
    return null;
  };
  const [sunoSets, setSunoSets]             = useState(FALLBACK_SETS);
  const [musicSelection, setMusicSelection] = useState(parseInitMusic);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const musicSoundRef = useRef(null);

  // ── Background state ──
  const [bgMediaList, setBgMediaList]       = useState([]);
  const [bgFilter, setBgFilter]             = useState('all');
  const [localBgUrl, setLocalBgUrl]         = useState(initBgUrl || null);
  const [localBgMediaType, setLocalBgMediaType] = useState(initBgMediaType || null);
  const [previewBg, setPreviewBg]           = useState(null);
  const [isBgLoading, setIsBgLoading]       = useState(false);

  // ── Format state ──
  const [localFormat, setLocalFormat]       = useState(initFormat || null);
  const [previewFormat, setPreviewFormat]   = useState(null);

  // ── Completion tracking (for auto-progression) ──
  const [bgDone, setBgDone] = useState(!!initBgUrl);

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);

  // ── Load data on mount ──
  useEffect(() => {
    setIsBgLoading(true);
    backgroundsService.getActiveBackgrounds().then((list) => {
      setBgMediaList(list);
      setIsBgLoading(false);
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/suno-sets`, { signal: controller.signal });
        const data = await res.json();
        if (data.success && data.sets?.length) setSunoSets(data.sets);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('EditStudio: could not enrich suno sets:', err.message);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
      stopMusicPreview();
    };
  }, []);

  const stopMusicPreview = async () => {
    if (musicSoundRef.current) {
      try { await musicSoundRef.current.stopAsync(); await musicSoundRef.current.unloadAsync(); } catch (e) {}
      musicSoundRef.current = null;
    }
    setPlayingPreview(null);
  };

  const handleMusicPreviewToggle = async (setNum, previewUrl) => {
    if (playingPreview === setNum) { await stopMusicPreview(); return; }
    if (!previewUrl) return;
    await stopMusicPreview();
    setIsLoadingPreview(true);
    setPlayingPreview(setNum);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true, volume: 0.4, isLooping: true }
      );
      musicSoundRef.current = sound;
    } catch (err) {
      console.error('Music preview error:', err.message);
      setPlayingPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const selectBg = (url, mediaType) => {
    setLocalBgUrl(url);
    setLocalBgMediaType(mediaType);
    setBgDone(true);
    setExpandedCard('format');
  };
  const resetBg = () => {
    setLocalBgUrl(null);
    setLocalBgMediaType(null);
    setBgDone(true);
    setExpandedCard('format');
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, base64: true });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isImage = asset.type === 'image';
      selectBg(isImage ? `data:image/jpeg;base64,${asset.base64}` : asset.uri, isImage ? 'image' : 'video');
    }
  };

  // ── Collapsed summaries ──
  const getMusicSummary = () => {
    if (!musicSelection) return isHe ? 'בחר מוזיקה' : 'Choose music';
    if (musicSelection === 'none') return isHe ? 'ללא מוזיקה' : 'No music';
    if (musicSelection === 'ai-generated') return '✨ AI';
    const s = sunoSets.find((x) => x.set === musicSelection);
    return s ? (isHe ? s.tone : s.toneEn) : `Set ${musicSelection}`;
  };

  const getBgSummary = () => {
    if (!localBgUrl) return isHe ? 'ברירת מחדל' : 'Default';
    if (localBgUrl.startsWith('data:')) return isHe ? 'מהגלריה' : 'Custom';
    const item = bgMediaList.find((b) => b.url === localBgUrl);
    return item ? (item.nameHe || item.nameEn || (isHe ? 'רקע שנבחר' : 'Selected')) : (isHe ? 'רקע שנבחר' : 'Selected');
  };

  const getFormatSummary = () => {
    if (!localFormat) return isHe ? 'בחר סגנון' : 'Choose style';
    return t(`formatSelection.fmt_${localFormat.replace(/-/g, '')}`);
  };

  // ── Save ──
  // overrideFormat: pass when calling immediately after setLocalFormat (avoids stale closure)
  const handleSave = async (overrideFormat) => {
    await stopMusicPreview();
    setIsSaving(true);
    const formatToSave = overrideFormat ?? localFormat;
    try {
      // Sync to Zustand
      if (formatToSave) setVideoFormat(formatToSave);
      setBackgroundVideoUrl(localBgUrl);
      setBackgroundMediaType(localBgMediaType);
      if (musicSelection === 'none')               { setSelectedMusic('none');                            setPreferredMusicEngine('suno'); }
      else if (musicSelection === 'ai-generated')  { setSelectedMusic('ai-generated');                   setPreferredMusicEngine('musicgen'); }
      else if (typeof musicSelection === 'number') { setSelectedMusic(`suno-set-${musicSelection}`);     setPreferredMusicEngine('suno'); }

      if (!currentStoryId) {
        _navigate();
        return;
      }

      // Build music fields
      const chosenSet = typeof musicSelection === 'number' ? sunoSets.find((s) => s.set === musicSelection) : null;
      const musicFields = {};
      if (musicSelection === 'none') {
        Object.assign(musicFields, { music: 'none', lockedSet: null, musicAmbient: null });
      } else if (musicSelection === 'ai-generated') {
        Object.assign(musicFields, { music: 'ai-generated', lockedSet: null, musicAmbient: null });
      } else if (chosenSet) {
        Object.assign(musicFields, {
          music: `suno-set-${musicSelection}`,
          lockedSet: musicSelection,
          musicAmbient: {
            id: `suno-set-${musicSelection}`,
            name: chosenSet.toneEn,
            nameHe: chosenSet.tone,
            key: chosenSet.key,
            bpm: chosenSet.bpm,
            url: chosenSet.previewUrl || null,
            previewTrackId: chosenSet.previewTrackId || null,
          },
        });
      }

      const updateFields = {
        format: formatToSave || 'cinematic',
        backgroundVideoUrl: localBgUrl || null,
        backgroundMediaType: localBgMediaType || null,
        ...musicFields,
      };

      // Upload creator's recording and save videoUri so the join page can show it to players
      if (lastRecordingUri) {
        try {
          const uploadResult = await storageService.uploadVideo(lastRecordingUri, currentStoryId, 'key');
          if (uploadResult.success) updateFields.videoUri = uploadResult.url;
        } catch (e) {
          console.warn('EditStudio: videoUri upload failed (non-fatal)', e.message);
        }
      }

      await storiesService.updateStory(currentStoryId, updateFields);

      if (communityMode && returnTo !== 'EditRoom') {
        await storiesService.updateStory(currentStoryId, { status: 'active' });
      }

      _navigate();
    } catch (error) {
      console.error('EditStudio save error:', error);
      Alert.alert(t('common.error'), t('instructions.error_upload_generic'));
    } finally {
      setIsSaving(false);
    }
  };

  const _navigate = () => {
    if (returnTo === 'EditRoom') go('EditRoom');
    else go('Casting');
  };

  // ── Card definitions ──
  const CARDS = [
    { id: 'music',      icon: 'musical-notes', label: isHe ? 'מוזיקה'     : 'Music',       summary: getMusicSummary(),   done: musicSelection !== null },
    { id: 'background', icon: 'image',         label: isHe ? 'רקע לסרטון' : 'Background',  summary: getBgSummary(),      done: bgDone },
    { id: 'format',     icon: 'cube',          label: isHe ? 'סגנון הצגה' : 'Video Style', summary: getFormatSummary(),  done: localFormat !== null },
  ];

  const bgListData = [
    { firestoreId: '__default__', nameHe: t('playerRecord.bg_default'), mediaType: 'default', url: null },
    ...bgMediaList.filter((b) => bgFilter === 'all' || b.mediaType === bgFilter),
  ];

  return (
    <ImageBackground
      source={require('../../assets/edit-room-bg.jpg.jpg')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <Animated.View style={{ flex: 1, opacity: cardOpacity }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isHe ? 'עריכת סטודיו' : 'Edit Studio'}</Text>
          {!!storyName && <Text style={styles.headerSubtitle} numberOfLines={1}>{storyName}</Text>}
        </View>
        {localFormat ? (
          <View style={styles.headerPreview}>
            <SimpleFormatPreview type={localFormat} size={38} />
          </View>
        ) : (
          <View style={styles.headerPreviewPlaceholder} />
        )}
      </View>

      {/* Accordion cards */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {CARDS.map((card) => {
          const isOpen = expandedCard === card.id;
          return (
            <View key={card.id} style={styles.glassCard}>
              <View style={styles.cardWave1} pointerEvents="none" />
              <View style={styles.cardWave2} pointerEvents="none" />
              <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCard(card.id)} activeOpacity={0.8}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.cardIconBg, isOpen && styles.cardIconBgOpen, card.done && !isOpen && styles.cardIconBgDone]}>
                    {card.done && !isOpen
                      ? <Ionicons name="checkmark" size={18} color="white" />
                      : <Ionicons name={card.icon} size={18} color={isOpen ? 'white' : 'rgba(90,170,255,0.85)'} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{card.label}</Text>
                    {!isOpen && <Text style={[styles.cardSummary, card.done && styles.cardSummaryDone]} numberOfLines={1}>{card.summary}</Text>}
                  </View>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.cardContent}>
                  {card.id === 'music'        && renderMusic()}
                  {card.id === 'background'   && renderBackground()}
                  {card.id === 'format'       && renderFormat()}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Floating save button — only shown when returning from EditRoom */}
      {returnTo === 'EditRoom' && (
        <View style={[styles.floatBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.saveBtnText}>{isHe ? 'שמור שינויים' : 'Save Changes'}</Text>
                <Ionicons name="save-outline" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      </Animated.View>

      {/* Background preview modals */}
      <VideoPreviewModal
        item={previewBg?.mediaType === 'video' ? previewBg : null}
        onSelect={selectBg}
        onClose={() => setPreviewBg(null)}
      />
      {previewBg?.mediaType === 'image' && (
        <Modal visible animationType="fade" onRequestClose={() => setPreviewBg(null)}>
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <Image source={{ uri: previewBg.url }} style={{ flex: 1 }} resizeMode="contain" />
            <View style={{ flexDirection: 'row', gap: 12, padding: 20, backgroundColor: 'white' }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 12, alignItems: 'center', paddingVertical: 14 }}
                onPress={() => { selectBg(previewBg.url, previewBg.mediaType); setPreviewBg(null); }}
              >
                <Text style={{ color: 'rgba(228,180,85,1.0)', fontSize: 16, fontWeight: '600' }}>{t('playerRecord.bg_select')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: `${theme.colors.secondary}15`, borderRadius: 12, alignItems: 'center', paddingVertical: 14 }}
                onPress={() => setPreviewBg(null)}
              >
                <Text style={{ color: theme.colors.subtext, fontSize: 15 }}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Format preview modal */}
      <Modal
        visible={previewFormat !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewFormat(null)}
      >
        <View style={styles.fmtModalOverlay}>
          <View style={styles.fmtModalContent}>
            <View style={styles.fmtModalHeader}>
              <Text style={styles.fmtModalTitle}>
                {previewFormat ? t(`formatSelection.fmt_${previewFormat.replace(/-/g, '')}`) : ''}
              </Text>
              <TouchableOpacity style={styles.fmtModalClose} onPress={() => setPreviewFormat(null)}>
                <Ionicons name="close" size={26} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden' }}>
              {previewFormat && <SimpleFormatPreview type={previewFormat} size={200} />}
            </View>
            <TouchableOpacity
              style={{ backgroundColor: ACCENT, borderRadius: 12, alignItems: 'center', paddingVertical: 14, width: '100%' }}
              onPress={() => {
                setLocalFormat(previewFormat);
                setPreviewFormat(null);
                if (!returnTo && musicSelection !== null && bgDone) {
                  handleSave(previewFormat);
                }
              }}
            >
              <Text style={{ color: 'rgba(228,180,85,1.0)', fontSize: 16, fontWeight: '600' }}>{t('formatSelection.btn_select_format')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );

  // ── Section renderers (declared after return — hoisted) ───────────────────

  function renderMusic() {
    return (
      <>
        <TouchableOpacity
          style={[styles.musicNoneRow, musicSelection === 'none' && styles.musicNoneRowSelected]}
          onPress={() => { setMusicSelection('none'); setExpandedCard('background'); }}
        >
          <Ionicons name="volume-mute-outline" size={18} color={musicSelection === 'none' ? ACCENT : 'rgba(200,155,70,0.50)'} />
          <Text style={[styles.musicNoneText, musicSelection === 'none' && { color: GOLD }]}>
            {isHe ? 'ללא מוזיקה' : 'No music'}
          </Text>
          {musicSelection === 'none' && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.musicAiRow, musicSelection === 'ai-generated' && styles.musicAiRowSelected]}
          onPress={() => { setMusicSelection('ai-generated'); setExpandedCard('background'); }}
          activeOpacity={0.8}
        >
          <Text style={styles.aiIcon}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>{isHe ? 'מוזיקה AI — ייחודית' : 'AI Music — Unique'}</Text>
            <Text style={styles.aiDesc}>{isHe ? 'יוצרת מוזיקה מותאמת אישית' : 'Creates personalized music'}</Text>
          </View>
          {musicSelection === 'ai-generated' && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
        </TouchableOpacity>

        <View style={styles.musicGrid}>
          {sunoSets.map((setItem) => {
            const isSelected  = musicSelection === setItem.set;
            const isPreviewing = playingPreview === setItem.set;
            return (
              <TouchableOpacity
                key={setItem.set}
                style={[styles.musicCard, isSelected && styles.musicCardSelected]}
                onPress={() => { setMusicSelection(setItem.set); setExpandedCard('background'); }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={[styles.musicIcon, isSelected && styles.musicIconSelected]}>
                    <Ionicons name={setItem.icon || 'musical-notes-outline'} size={17} color={isSelected ? 'white' : 'rgba(90,170,255,0.85)'} />
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={ACCENT} />}
                </View>
                <Text style={[styles.musicCardName, isSelected && { color: ACCENT }]} numberOfLines={2}>
                  {isHe ? setItem.tone : setItem.toneEn}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(200,155,70,0.35)' }}>{setItem.bpm} BPM</Text>
                  {setItem.previewUrl && (
                    <TouchableOpacity
                      style={[styles.musicPreviewBtn, isPreviewing && styles.musicPreviewBtnActive]}
                      onPress={() => handleMusicPreviewToggle(setItem.set, setItem.previewUrl)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isLoadingPreview && isPreviewing
                        ? <ActivityIndicator size={12} color={theme.colors.accent} />
                        : <Ionicons name={isPreviewing ? 'pause' : 'play'} size={12} color={isPreviewing ? 'white' : theme.colors.accent} />}
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  function renderBackground() {
    const filters = [
      ['all',   isHe ? 'הכל'    : 'All'],
      ['image', isHe ? 'תמונות' : 'Images'],
      ['video', isHe ? 'וידאו'  : 'Videos'],
    ];
    return (
      <>
        <View style={styles.bgFilterRow}>
          {filters.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.bgFilterTab, bgFilter === key && styles.bgFilterTabActive]}
              onPress={() => setBgFilter(key)}
            >
              <Text style={[styles.bgFilterText, bgFilter === key && styles.bgFilterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Ionicons name="images-outline" size={16} color={ACCENT} />
          <Text style={styles.galleryBtnText}>{isHe ? 'בחר מהגלריה' : 'From Gallery'}</Text>
        </TouchableOpacity>

        {isBgLoading ? (
          <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 20, marginBottom: 12 }} />
        ) : (
          <View style={styles.bgGrid}>
            {bgListData.map((item) => {
              const isSelected = item.url === localBgUrl || (item.url === null && !localBgUrl);
              return (
                <TouchableOpacity
                  key={item.firestoreId}
                  style={[styles.bgGridItem, isSelected && styles.bgGridItemSelected]}
                  onPress={() => (item.url === null ? resetBg() : selectBg(item.url, item.mediaType))}
                >
                  {item.mediaType === 'default' ? (
                    <View style={styles.bgThumb}>
                      <Ionicons name="sparkles" size={22} color="#a78bfa" />
                    </View>
                  ) : item.mediaType === 'image' ? (
                    <Image source={{ uri: item.url }} style={styles.bgThumb} />
                  ) : (
                    <VideoThumb uri={item.url} style={styles.bgThumb} />
                  )}
                  {(item.mediaType === 'image' || item.mediaType === 'video') && (
                    <TouchableOpacity style={styles.bgPreviewBtn} onPress={() => setPreviewBg(item)}>
                      <Ionicons name="eye" size={10} color="white" />
                    </TouchableOpacity>
                  )}
                  {isSelected && (
                    <View style={styles.bgCheckBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  }

  function renderFormat() {
    const formatOptions = [
      { id: 'cube-3d',     icon: 'cube',        name: t('formatSelection.fmt_cube3d'),     desc: t('formatSelection.fmt_cube3d_desc') },
      { id: 'carousel-3d', icon: 'albums',       name: t('formatSelection.fmt_carousel3d'), desc: t('formatSelection.fmt_carousel3d_desc') },
      { id: 'film-strip',  icon: 'film-outline', name: t('formatSelection.fmt_filmstrip'),  desc: t('formatSelection.fmt_filmstrip_desc') },
      { id: 'flip-pages',  icon: 'book',         name: t('formatSelection.fmt_flippages'),  desc: t('formatSelection.fmt_flippages_desc') },
      { id: 'cinematic',   icon: 'sparkles',     name: t('formatSelection.fmt_cinematic'),  desc: t('formatSelection.fmt_cinematic_desc') },
      { id: 'spotlight',   icon: 'people',       name: t('formatSelection.fmt_spotlight'),  desc: t('formatSelection.fmt_spotlight_desc') },
    ];
    return (
      <>
        {formatOptions.map((option) => {
          const isSelected = localFormat === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.formatRow, isSelected && styles.formatRowSelected]}
              onPress={() => {
                setLocalFormat(option.id);
                setExpandedCard(null);
                if (!returnTo && musicSelection !== null && bgDone) {
                  handleSave(option.id);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.formatIconBg, isSelected && styles.formatIconBgSelected]}>
                <Ionicons name={option.icon} size={19} color={isSelected ? 'white' : 'rgba(90,170,255,0.85)'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formatName, isSelected && styles.formatNameSelected]}>{option.name}</Text>
                <Text style={styles.formatDesc} numberOfLines={1}>{option.desc}</Text>
              </View>
              <View style={styles.formatPreviewWrap}>
                <SimpleFormatPreview type={option.id} size={44} />
              </View>
              <TouchableOpacity
                style={styles.fmtEyeBtn}
                onPress={() => setPreviewFormat(option.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="eye-outline" size={15} color="rgba(90,170,255,0.65)" />
              </TouchableOpacity>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </>
    );
  }
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 50, 120, 0.52)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(38, 40, 50, 0.97)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(200,155,70,0.85)',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(180,140,60,0.85)',
    marginTop: 2,
  },
  headerPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerPreviewPlaceholder: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  glassCard: {
    backgroundColor: 'rgba(55, 58, 72, 0.91)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  cardIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBgOpen: {
    backgroundColor: 'rgba(90,170,255,0.65)',
  },
  cardIconBgDone: {
    backgroundColor: 'rgba(90,170,255,0.65)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(228,180,85,0.90)',
  },
  cardSummary: {
    fontSize: 12,
    color: 'rgba(200,155,70,0.45)',
    marginTop: 2,
  },
  cardSummaryDone: {
    color: 'rgba(200,155,70,0.85)',
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 2,
  },

  // Instructions
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 11,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: ACCENT,
  },
  modeTabText: {
    fontSize: 13,
    color: 'rgba(200,155,70,0.55)',
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: 'rgba(228,180,85,1.0)',
    fontWeight: '700',
  },
  instrInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.20)',
    padding: 12,
    fontSize: 15,
    color: 'rgba(228,180,85,0.90)',
    minHeight: 96,
  },
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: ACCENT,
  },
  dictateBtnActive: {
    backgroundColor: '#ef4444',
  },
  micBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
  },
  audioActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  timingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(200,155,70,0.65)',
    marginBottom: 8,
    textAlign: 'right',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 8,
  },
  timingRowLabel: {
    fontSize: 12,
    color: 'rgba(200,155,70,0.50)',
    width: 46,
    textAlign: 'right',
  },
  timingButtons: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center',
  },
  timeBtnSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  timeBtnText: {
    fontSize: 11,
    color: 'rgba(200,155,70,0.55)',
    fontWeight: '500',
  },
  timeBtnTextSelected: {
    color: 'rgba(228,180,85,1.0)',
    fontWeight: '700',
  },

  // Music
  musicNoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 8,
  },
  musicNoneRowSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(200,155,70,0.12)',
  },
  musicNoneText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(200,155,70,0.65)',
    fontWeight: '500',
  },
  musicAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  musicAiRowSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(200,155,70,0.12)',
  },
  aiIcon:  { fontSize: 20 },
  aiTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(228,180,85,0.90)' },
  aiDesc:  { fontSize: 11, color: 'rgba(200,155,70,0.45)', marginTop: 2 },
  musicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  musicCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  musicCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(200,155,70,0.12)',
  },
  musicIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicIconSelected: {
    backgroundColor: ACCENT,
  },
  musicCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(200,155,70,0.80)',
    textAlign: 'right',
    lineHeight: 16,
    marginTop: 2,
  },
  musicPreviewBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: `${theme.colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicPreviewBtnActive: {
    backgroundColor: theme.colors.accent,
  },

  // Background
  bgFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 9,
  },
  bgFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  bgFilterTabActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  bgFilterText: {
    fontSize: 12,
    color: 'rgba(200,155,70,0.55)',
    fontWeight: '500',
  },
  bgFilterTextActive: {
    color: 'rgba(228,180,85,1.0)',
    fontWeight: '700',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(90,170,255,0.45)',
    marginBottom: 9,
  },
  galleryBtnText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
  },
  bgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bgGridItem: {
    width: '30.8%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgGridItemSelected: {
    borderColor: ACCENT,
  },
  bgThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgPreviewBtn: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding: 4,
  },
  bgCheckBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
  },

  // Format
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    marginBottom: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  formatRowSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(200,155,70,0.12)',
  },
  formatIconBg: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatIconBgSelected: {
    backgroundColor: ACCENT,
  },
  formatName: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(200,155,70,0.85)',
  },
  formatNameSelected: {
    color: 'rgba(228,180,85,1.0)',
  },
  formatDesc: {
    fontSize: 11,
    color: 'rgba(200,155,70,0.40)',
    marginTop: 1,
  },
  formatPreviewWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  fmtEyeBtn: {
    padding: 5,
  },

  // Floating save bar
  floatBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(38, 40, 50, 0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200,155,70,0.15)',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(180,140,55,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.50)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(160,120,40,0.70)',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(228,180,85,0.95)',
    letterSpacing: 0.2,
  },

  // Wave decoration inside cards
  cardWave1: {
    position: 'absolute',
    width: 180,
    height: 180,
    top: -50,
    right: -40,
    borderRadius: 200,
    borderTopLeftRadius: 80,
    backgroundColor: 'rgba(135,139,162,0.13)',
    transform: [{ rotate: '-8deg' }],
    pointerEvents: 'none',
  },
  cardWave2: {
    position: 'absolute',
    width: 120,
    height: 120,
    bottom: -30,
    left: -20,
    borderRadius: 100,
    borderBottomRightRadius: 40,
    backgroundColor: 'rgba(100,104,124,0.10)',
    transform: [{ rotate: '5deg' }],
    pointerEvents: 'none',
  },

  // Format preview modal
  fmtModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fmtModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  fmtModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  fmtModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  fmtModalClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
