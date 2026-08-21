import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, ActivityIndicator, ImageBackground,
  Linking, Share, AppState, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { storageService } from '../services/storageService';

const ACCENT = 'rgba(90,170,255,0.85)';  // light blue — icons & selected states
const GOLD   = 'rgba(228,180,85,0.90)';  // gold — text headings

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

const PARTICIPANT_OPTIONS = [
  { label: '1-9',   clipCount: 3, maxClipDuration: 45 },
  { label: '10-20', clipCount: 1, maxClipDuration: 30 },
  { label: '21-40', clipCount: 1, maxClipDuration: 5  },
  { label: '40+',   clipCount: 1, maxClipDuration: 3  },
];

const BG_SOURCE = require('../../assets/edit-room-bg.jpg.jpg');

export const CastingScreen = () => {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const { go, back } = useNav();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);

  // ── Fade-in ──
  const cardOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(cardOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ── Zustand ──
  const currentStoryId        = useAppState((s) => s.currentStoryId);
  const storyName             = useAppState((s) => s.storyName);
  const navigationParams      = useAppState((s) => s.navigationParams);
  const lastRecordingUri      = useAppState((s) => s.lastRecordingUri);
  const initInstructions      = useAppState((s) => s.playerInstructions);
  const storyMaxClipDuration  = useAppState((s) => s.storyMaxClipDuration);
  const communitySettings     = useAppState((s) => s.communitySettings);
  const setPlayerInstructions   = useAppState((s) => s.setPlayerInstructions);
  const setStoryMaxClipDuration = useAppState((s) => s.setStoryMaxClipDuration);
  const setStoryClipCount       = useAppState((s) => s.setStoryClipCount);
  const storyCreationMode       = useAppState((s) => s.storyCreationMode);
  const videoFormat             = useAppState((s) => s.videoFormat);

  const returnTo = navigationParams?.returnTo || null;
  const communityMode = communitySettings?.communityMode ?? false;

  // ── Privacy state ──
  const [allowSocialMedia, setAllowSocialMedia] = useState(
    communitySettings?.privacySettings?.allowSocialMedia ?? false
  );

  // ── Accordion ──
  const [expandedCard, setExpandedCard] = useState('instructions');
  const toggleCard = (id) => setExpandedCard((prev) => (prev === id ? null : id));

  // ── Participant state ──
  const initRange = PARTICIPANT_OPTIONS.find((o) => o.maxClipDuration === storyMaxClipDuration)?.label || '1-9';
  const [participantRange, setParticipantRange] = useState(initRange);
  const selectedParticipantOpt = PARTICIPANT_OPTIONS.find((o) => o.label === participantRange) || PARTICIPANT_OPTIONS[0];
  const clipTime = selectedParticipantOpt.maxClipDuration;

  // ── Instructions state ──
  const [genericInstructions, setGenericInstructions] = useState(initInstructions?.generic || '');
  const [inputMode, setInputMode]             = useState('audio');
  const [isRecording, setIsRecording]         = useState(false);
  const [audioRecording, setAudioRecording]   = useState(null);
  const [instructionAudioUri, setInstructionAudioUri] = useState(initInstructions?.audioUri || null);
  const [recordingSecs, setRecordingSecs]     = useState(0);
  const [isPlayingAudio, setIsPlayingAudio]   = useState(false);
  const [isTranscribing, setIsTranscribing]   = useState(false);
  const [isDictating, setIsDictating]         = useState(false);
  const [dictationSecs, setDictationSecs]     = useState(0);
  const dictationRecording  = useRef(null);
  const dictationTimerRef   = useRef(null);
  const audioSound          = useRef(null);
  const recordingTimerRef   = useRef(null);
  const sentToWhatsApp      = useRef(false);
  const _navigateRef        = useRef(null);

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);
  const [sharedCount, setSharedCount] = useState(0);

  // ── Share / invite link ──
  const participantLink = useMemo(() => {
    if (!currentStoryId) return '';
    return `${API_BASE_URL}/join/${currentStoryId}`;
  }, [currentStoryId]);

  const messageTemplate = useMemo(() => {
    if (!participantLink) return storyName || '';
    return t('whatsapp.message_with_link', { storyName, participantLink });
  }, [storyName, participantLink, t]);

  // bare WhatsApp open — no save (used on "invite more" return)
  const openWhatsApp = async () => {
    try {
      sentToWhatsApp.current = true;
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(messageTemplate)}`);
      setSharedCount((prev) => prev + 1);
    } catch {
      sentToWhatsApp.current = false;
      try {
        const result = await Share.share({ message: messageTemplate, title: storyName });
        if (result.action === Share.sharedAction) setSharedCount((prev) => prev + 1);
      } catch (e) { console.error('Share error', e); }
    }
  };

  const handleShareWhatsApp = async () => {
    const ok = await doSave();
    if (!ok) return;
    Alert.alert(
      isHe ? 'הזמן משתתפים' : 'Invite Participants',
      isHe
        ? 'אחרי שתשלח את ההזמנות ב-WhatsApp, חזור ל-Rilio כדי להמשיך.'
        : 'After sending your invitations in WhatsApp, return to Rilio to continue.',
      [
        { text: isHe ? 'ביטול' : 'Cancel', style: 'cancel' },
        { text: isHe ? 'המשך ל-WhatsApp' : 'Continue to WhatsApp', onPress: openWhatsApp },
      ],
    );
  };

  const handleNativeShare = async () => {
    const ok = await doSave();
    if (!ok) return;
    try {
      const result = await Share.share({ message: messageTemplate, title: storyName });
      if (result.action === Share.sharedAction) setSharedCount((prev) => prev + 1);
    } catch (e) { console.error('Share error', e); }
  };

  const handleTestAsPlayer = async () => {
    if (!currentStoryId) return;
    try {
      const result = await storiesService.getStory(currentStoryId);
      if (result.success) {
        useAppState.getState().enterPlayerMode(currentStoryId, result.story);
      }
    } catch (e) { console.error('Test player error', e); }
  };

  useEffect(() => {
    return () => {
      if (audioSound.current) audioSound.current.unloadAsync().catch(() => {});
      clearInterval(dictationTimerRef.current);
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Detect return from WhatsApp
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && sentToWhatsApp.current) {
        sentToWhatsApp.current = false;
        Alert.alert(
          isHe ? 'סיימת להזמין?' : 'Have you finished inviting participants?',
          null,
          [
            {
              text: isHe ? 'הזמן עוד' : 'Invite More Participants',
              onPress: openWhatsApp,
            },
            {
              text: isHe ? 'סיימתי' : "I'm Done",
              style: 'default',
              onPress: () => {
                Alert.alert(
                  isHe ? 'ההזמנות נשלחו!' : 'Invitations Sent!',
                  isHe
                    ? 'נעדכן אותך כשמשתתפים ישלחו את הסרטונים שלהם.'
                    : "Your invitations have been sent. We'll notify you as participants submit their videos.",
                  [{ text: isHe ? 'לפרויקטים שלי' : 'My Projects', onPress: () => useAppState.getState().navigateTo('MyStories') }],
                );
              },
            },
          ],
          { cancelable: false },
        );
      }
    });
    return () => subscription.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Audio functions ──
  const startAudioRec = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert(t('common.error'), 'נדרשת הרשאת מיקרופון'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setAudioRecording(recording);
      setIsRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch (e) { console.error('Audio rec start failed', e); }
  };

  const stopAudioRec = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    try {
      await audioRecording.stopAndUnloadAsync();
      const uri = audioRecording.getURI();
      setInstructionAudioUri(uri);
      setAudioRecording(null);
    } catch (e) { console.error('Audio rec stop failed', e); }
  };

  const playAudioRec = async () => {
    if (!instructionAudioUri) return;
    if (audioSound.current) await audioSound.current.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: instructionAudioUri }, { volume: 1.0 });
    audioSound.current = sound;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    setIsPlayingAudio(true);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) setIsPlayingAudio(false); });
  };

  const startDictation = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert(t('common.error'), 'נדרשת הרשאת מיקרופון'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      dictationRecording.current = recording;
      setIsDictating(true);
      setDictationSecs(0);
      dictationTimerRef.current = setInterval(() => setDictationSecs((s) => s + 1), 1000);
    } catch (e) { console.error('Dictation start failed', e); }
  };

  const stopDictation = async () => {
    clearInterval(dictationTimerRef.current);
    setIsDictating(false);
    if (!dictationRecording.current) return;
    try {
      await dictationRecording.current.stopAndUnloadAsync();
      const uri = dictationRecording.current.getURI();
      dictationRecording.current = null;
      setInstructionAudioUri(uri);
      setIsTranscribing(true);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const formData = new FormData();
      formData.append('video', { uri, name: 'dictation.m4a', type: 'audio/m4a' });
      const res  = await fetch(`${API_BASE_URL}/api/transcribe`, { method: 'POST', headers: UPLOAD_HEADERS, body: formData });
      const json = await res.json();
      if (json.success && json.text) {
        setGenericInstructions((prev) => (prev ? prev + ' ' + json.text : json.text).slice(0, 400));
      } else {
        Alert.alert(t('common.error'), t('instructions.transcribe_error'));
      }
    } catch (e) {
      console.error('Dictation transcribe failed', e);
      Alert.alert(t('common.error'), t('instructions.transcribe_error'));
    } finally {
      setIsTranscribing(false);
      setDictationSecs(0);
    }
  };

  // ── Save ──
  // Returns true on success, false on error (does NOT navigate)
  const doSave = async () => {
    if (isSaving) return false;
    setIsSaving(true);
    try {
      setPlayerInstructions({ generic: genericInstructions, video1Time: clipTime, video2Time: clipTime, video3Time: clipTime });
      setStoryMaxClipDuration(clipTime);
      setStoryClipCount(selectedParticipantOpt.clipCount);

      if (!currentStoryId) return true;

      let uploadedVideoUri = null;
      let instructionAudioUrl = null;

      if (lastRecordingUri) {
        const result = await storageService.uploadVideo(lastRecordingUri, currentStoryId, 'key');
        if (result.success) uploadedVideoUri = result.url;
        else { Alert.alert(t('common.error'), t('instructions.error_upload')); return false; }
      } else {
        const snap = await storiesService.getStory(currentStoryId);
        const draft = snap?.story;
        if (draft?.draftVideoStatus === 'uploading') {
          Alert.alert(
            isHe ? 'העלאה בתהליך' : 'Upload in Progress',
            isHe ? 'הסרטון שלך עדיין מועלה ברקע. נסה שוב בעוד רגע.' : 'Your video is still uploading in the background. Please try again in a moment.',
          );
          return false;
        } else if (draft?.draftVideoStatus === 'ready' && draft?.draftVideoUrl) {
          uploadedVideoUri = draft.draftVideoUrl;
          console.log('♻️ Recovered draft video from Firebase:', uploadedVideoUri);
        } else if (draft?.draftVideoStatus === 'failed') {
          console.warn('Draft upload had failed — proceeding without video');
        }
      }

      if (instructionAudioUri) {
        const result = await storageService.uploadAudio(instructionAudioUri, currentStoryId);
        if (result.success) instructionAudioUrl = result.url;
      }

      const updateFields = {
        instructions: genericInstructions,
        instructionAudioUrl,
        videoTimings: { video1: clipTime, video2: clipTime, video3: clipTime },
        maxParticipants: participantRange,
        maxClipDuration: clipTime,
        clipCount: selectedParticipantOpt.clipCount,
        privacySettings: { allowSocialMedia },
        draftVideoUrl: null,
        draftVideoStatus: null,
      };
      if (uploadedVideoUri) updateFields.videoUri = uploadedVideoUri;

      await storiesService.updateStory(currentStoryId, updateFields);
      if (communityMode && returnTo !== 'EditRoom') {
        await storiesService.updateStory(currentStoryId, { status: 'active' });
      }
      return true;
    } catch (error) {
      console.error('CastingScreen save error:', error);
      Alert.alert(t('common.error'), t('instructions.error_upload_generic'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Only used in community mode / returnTo flow
  const handleSave = async () => {
    const ok = await doSave();
    if (ok) _navigate();
  };

  const _navigate = () => {
    if (returnTo === 'EditRoom') { go('EditRoom'); return; }
    if (storyCreationMode === 'community') { go('EditRoom'); return; }
    const is3DFormat = videoFormat && videoFormat !== 'standard';
    go(is3DFormat ? 'FinalVideo' : 'Processing');
  };
  _navigateRef.current = _navigate;

  // ── Summaries ──
  const getParticipantSummary = () =>
    isHe ? `${participantRange} משתתפים · ${clipTime}ש׳` : `${participantRange} participants · ${clipTime}s`;

  const getInstructionSummary = () => {
    if (genericInstructions) return genericInstructions.slice(0, 35) + (genericInstructions.length > 35 ? '...' : '');
    if (instructionAudioUri) return isHe ? '🎙 הוקלט' : '🎙 Recorded';
    return isHe ? 'לחץ להוספה' : 'Tap to add';
  };

  const CARDS = [
    { id: 'instructions', icon: 'chatbubbles', label: isHe ? 'הנחיות למשתתפים' : 'Player Instructions', summary: getInstructionSummary() },
    { id: 'participants', icon: 'people',      label: isHe ? 'כמות משתתפים'     : 'Participants',        summary: getParticipantSummary() },
  ];

  return (
    <ImageBackground source={BG_SOURCE} style={{ flex: 1 }} resizeMode="cover">
      <View style={styles.overlay} />

      <Animated.View style={{ flex: 1, opacity: cardOpacity }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isHe ? 'ליהוק' : 'Casting'}</Text>
            {!!storyName && <Text style={styles.headerSubtitle} numberOfLines={1}>{storyName}</Text>}
          </View>
          <View style={{ width: 40 }} />
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
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCard(card.id)} activeOpacity={0.8}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIconBg, isOpen && styles.cardIconBgOpen]}>
                      <Ionicons name={card.icon} size={18} color={isOpen ? 'white' : ACCENT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{card.label}</Text>
                      {!isOpen && <Text style={styles.cardSummary} numberOfLines={1}>{card.summary}</Text>}
                    </View>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(200,155,70,0.45)" />
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.cardContent}>
                    {card.id === 'participants'  && renderParticipants()}
                    {card.id === 'instructions'  && renderInstructions()}
                  </View>
                )}

                {/* Wave decoration */}
                <View pointerEvents="none" style={styles.cardWave1} />
                <View pointerEvents="none" style={styles.cardWave2} />
              </View>
            );
          })}

          {/* Privacy / publishing */}
          <View style={styles.glassCard}>
            <View style={[styles.cardHeader, { pointerEvents: 'none' }]}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIconBg}>
                  <Ionicons name="eye-outline" size={18} color={ACCENT} />
                </View>
                <Text style={styles.cardTitle}>{isHe ? 'שיתוף ופרסום' : 'Sharing & Publishing'}</Text>
              </View>
            </View>
            <View style={[styles.cardContent, { gap: 8 }]}>
              <TouchableOpacity
                style={[styles.privacyOption, !allowSocialMedia && styles.privacyOptionSelected]}
                onPress={() => setAllowSocialMedia(false)}
                activeOpacity={0.75}
              >
                <Ionicons name="lock-closed-outline" size={18} color={!allowSocialMedia ? 'white' : ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyOptionTitle, !allowSocialMedia && { color: GOLD }]}>
                    {isHe ? 'פרטי' : 'Private'}
                  </Text>
                  <Text style={styles.privacyOptionDesc}>
                    {isHe ? 'הסרטון נשמר עבור המשתתפים בלבד' : 'Video saved for participants only'}
                  </Text>
                </View>
                {!allowSocialMedia && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.privacyOption, allowSocialMedia && styles.privacyOptionSelected]}
                onPress={() => setAllowSocialMedia(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="globe-outline" size={18} color={allowSocialMedia ? 'white' : ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyOptionTitle, allowSocialMedia && { color: GOLD }]}>
                    {isHe ? 'ציבורי / רשת חברתית' : 'Public / Social Media'}
                  </Text>
                  <Text style={styles.privacyOptionDesc}>
                    {isHe ? 'השחקנים יתבקשו לאשר פרסום' : 'Players will be asked to consent to publishing'}
                  </Text>
                </View>
                {allowSocialMedia && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
              </TouchableOpacity>
            </View>
            <View pointerEvents="none" style={styles.cardWave1} />
            <View pointerEvents="none" style={styles.cardWave2} />
          </View>

          {/* Share / invite section */}
          <View style={styles.shareSection}>
            <Text style={styles.shareSectionTitle}>
              {isHe ? 'שלח הזמנה לשחקנים' : 'Invite Players'}
            </Text>

            <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp} disabled={isSaving} activeOpacity={0.85}>
              {isSaving
                ? <ActivityIndicator color="white" />
                : <>
                    <Ionicons name="logo-whatsapp" size={24} color="white" />
                    <Text style={styles.whatsappBtnText}>{t('whatsapp.btn_whatsapp')}</Text>
                    {sharedCount > 0 && (
                      <View style={styles.sharedBadge}>
                        <Text style={styles.sharedBadgeText}>{sharedCount}</Text>
                      </View>
                    )}
                  </>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.nativeShareBtn} onPress={handleNativeShare} disabled={isSaving} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={20} color={ACCENT} />
              <Text style={styles.nativeShareBtnText}>{t('whatsapp.btn_other_share')}</Text>
            </TouchableOpacity>

            {storyCreationMode === 'community' && (
              <TouchableOpacity style={styles.testBtn} onPress={handleTestAsPlayer} activeOpacity={0.85}>
                <Ionicons name="flask-outline" size={16} color="rgba(90,170,255,0.40)" />
                <Text style={styles.testBtnText}>{t('whatsapp.btn_test')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Floating save button — only in community/returnTo flow */}
        {(communityMode || returnTo === 'EditRoom') && (
          <View style={[styles.saveBar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
              {isSaving
                ? <ActivityIndicator color="rgba(228,180,85,0.95)" />
                : <>
                    <Ionicons name="send" size={18} color="rgba(228,180,85,0.95)" />
                    <Text style={styles.saveBtnText}>{isHe ? 'שמור והמשך' : 'Save & Continue'}</Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Section renderers */}
      {null}
    </ImageBackground>
  );

  function renderParticipants() {
    return (
      <>
        <Text style={{ fontSize: 13, color: 'rgba(200,155,70,0.60)', marginBottom: 14 }}>
          {isHe ? 'כמה משתתפים צפויים לפרויקט?' : 'How many participants do you expect?'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {PARTICIPANT_OPTIONS.map((opt) => {
            const selected = participantRange === opt.label;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.timeBtn, { paddingHorizontal: 18 }, selected && styles.timeBtnSelected]}
                onPress={() => setParticipantRange(opt.label)}
              >
                <Text style={[styles.timeBtnText, selected && styles.timeBtnTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(200,155,70,0.40)', marginTop: 10 }}>
          {isHe
            ? `כל שחקן יצלם ${selectedParticipantOpt.clipCount === 3 ? '3 קטעים של' : 'קטע של'} עד ${clipTime} שניות`
            : `Each player records ${selectedParticipantOpt.clipCount === 3 ? '3 clips of' : 'a clip of'} up to ${clipTime}s`}
        </Text>
      </>
    );
  }

  function renderInstructions() {
    return (
      <>
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'text' && styles.modeTabActive]}
            onPress={() => setInputMode('text')}
          >
            <Ionicons name="pencil-outline" size={14} color={inputMode === 'text' ? 'white' : ACCENT} />
            <Text style={[styles.modeTabText, inputMode === 'text' && styles.modeTabTextActive]}>
              {isHe ? 'טקסט' : 'Text'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'audio' && styles.modeTabActive]}
            onPress={() => setInputMode('audio')}
          >
            <Ionicons name="mic-outline" size={14} color={inputMode === 'audio' ? 'white' : ACCENT} />
            <Text style={[styles.modeTabText, inputMode === 'audio' && styles.modeTabTextActive]}>
              {isHe ? 'שמע' : 'Audio'}
            </Text>
          </TouchableOpacity>
        </View>

        {inputMode === 'text' ? (
          <>
            <TextInput
              style={styles.instrInput}
              placeholder={t('instructions.general_placeholder')}
              placeholderTextColor="rgba(200,155,70,0.30)"
              value={genericInstructions}
              onChangeText={(v) => setGenericInstructions(v.slice(0, 400))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign={isHe ? 'right' : 'left'}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ fontSize: 11, color: 'rgba(200,155,70,0.35)' }}>{genericInstructions.length}/400</Text>
              <TouchableOpacity
                style={[styles.dictateBtn, isDictating && styles.dictateBtnActive]}
                onPress={isDictating ? stopDictation : startDictation}
                disabled={isTranscribing}
              >
                {isTranscribing
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name={isDictating ? 'stop' : 'mic'} size={14} color="white" />}
                <Text style={{ fontSize: 12, color: 'white', fontWeight: '600', marginLeft: 4 }}>
                  {isTranscribing
                    ? (isHe ? 'מתמלל...' : 'Transcribing...')
                    : isDictating
                      ? formatSecs(dictationSecs)
                      : (isHe ? 'הכתבה' : 'Dictate')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 14 }}>
            {!instructionAudioUri ? (
              <>
                <TouchableOpacity
                  style={[styles.micBtn, isRecording && styles.micBtnActive]}
                  onPress={isRecording ? stopAudioRec : startAudioRec}
                >
                  <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color="white" />
                </TouchableOpacity>
                <Text style={{ fontSize: 14, color: 'rgba(200,155,70,0.55)' }}>
                  {isRecording
                    ? `${isHe ? 'מקליט' : 'Recording'} ${formatSecs(recordingSecs)}`
                    : (isHe ? 'לחץ להקלטה' : 'Tap to record')}
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                  <Text style={{ color: GOLD, fontWeight: '600' }}>
                    {isHe ? 'הוקלט' : 'Recorded'} ({formatSecs(recordingSecs)})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.audioActionBtn} onPress={playAudioRec}>
                    <Ionicons name={isPlayingAudio ? 'pause' : 'play'} size={16} color="white" />
                    <Text style={{ fontSize: 13, color: 'white', marginLeft: 4 }}>{isHe ? 'נגן' : 'Play'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.audioActionBtn, { backgroundColor: 'rgba(55,58,72,0.70)' }]}
                    onPress={() => { setInstructionAudioUri(null); setRecordingSecs(0); }}
                  >
                    <Ionicons name="refresh" size={16} color={ACCENT} />
                    <Text style={{ fontSize: 13, color: 'rgba(200,155,70,0.65)', marginLeft: 4 }}>
                      {isHe ? 'הקלט שוב' : 'Re-record'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </>
    );
  }
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,50,120,0.52)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(38,40,50,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,155,70,0.15)',
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: GOLD, letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 12, color: 'rgba(200,155,70,0.55)', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  glassCard: {
    backgroundColor: 'rgba(55,58,72,0.91)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIconBg: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(90,170,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconBgOpen: { backgroundColor: 'rgba(90,170,255,0.65)' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: GOLD },
  cardSummary: { fontSize: 12, color: 'rgba(200,155,70,0.50)', marginTop: 2 },
  cardContent: { paddingHorizontal: 16, paddingBottom: 18, paddingTop: 4 },
  cardWave1: {
    position: 'absolute', bottom: -18, right: -10,
    width: 90, height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(200,155,70,0.04)',
    transform: [{ rotate: '-12deg' }],
  },
  cardWave2: {
    position: 'absolute', bottom: -10, right: 40,
    width: 60, height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(200,155,70,0.03)',
    transform: [{ rotate: '-8deg' }],
  },
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: 'rgba(38,40,50,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,155,70,0.15)',
  },
  saveBtn: {
    backgroundColor: 'rgba(180,140,60,0.15)',
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.40)',
    borderBottomWidth: 3, borderBottomColor: 'rgba(160,120,40,0.60)',
    shadowColor: 'rgba(200,155,70,1)', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 5, elevation: 3,
  },
  saveBtnText: { color: 'rgba(228,180,85,0.95)', fontSize: 16, fontWeight: '700' },
  // Participant
  timeBtn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: 'rgba(55,58,72,0.70)',
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.18)',
  },
  timeBtnSelected: { backgroundColor: 'rgba(90,170,255,0.25)', borderColor: ACCENT },
  timeBtnText: { fontSize: 14, color: 'rgba(200,155,70,0.60)', fontWeight: '500' },
  timeBtnTextSelected: { color: 'white', fontWeight: '700' },
  // Instructions
  modeTabs: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  modeTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(55,58,72,0.70)',
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.15)',
  },
  modeTabActive: { backgroundColor: 'rgba(90,170,255,0.65)', borderColor: ACCENT },
  modeTabText: { fontSize: 13, color: 'rgba(200,155,70,0.55)', fontWeight: '500' },
  modeTabTextActive: { color: 'white' },
  instrInput: {
    backgroundColor: 'rgba(38,40,50,0.70)',
    borderRadius: 12, padding: 14, minHeight: 100,
    color: GOLD, fontSize: 14, lineHeight: 22,
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.18)',
  },
  dictateBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(90,170,255,0.25)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  dictateBtnActive: { backgroundColor: '#e74c3c' },
  micBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(90,170,255,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#e74c3c' },
  audioActionBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(90,170,255,0.55)', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20,
  },
  // Privacy
  privacyOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(55,58,72,0.70)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.12)',
  },
  privacyOptionSelected: {
    backgroundColor: 'rgba(90,170,255,0.12)',
    borderColor: ACCENT,
  },
  privacyOptionTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(200,155,70,0.65)', marginBottom: 2 },
  privacyOptionDesc: { fontSize: 12, color: 'rgba(200,155,70,0.35)' },
  // Share section
  shareSection: {
    backgroundColor: 'rgba(55,58,72,0.91)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    padding: 16,
    gap: 10,
  },
  shareSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
    marginBottom: 2,
  },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 12, paddingVertical: 14,
  },
  whatsappBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  sharedBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4,
  },
  sharedBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  nativeShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(55,58,72,0.70)',
    borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(200,155,70,0.20)',
  },
  nativeShareBtnText: { color: 'rgba(200,155,70,0.75)', fontSize: 15 },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  testBtnText: { color: 'rgba(200,155,70,0.40)', fontSize: 13 },
});
