import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_VIDEO_CONVERTER_URL || 'https://reflectlymobilex.onrender.com';

export const MusicSelectionScreen = () => {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const { go, back } = useNav();
  const setSelectedMusic         = useAppState((state) => state.setSelectedMusic);
  const selectedMusic            = useAppState((state) => state.selectedMusic);
  const currentStoryId           = useAppState((state) => state.currentStoryId);
  const setPreferredMusicEngine  = useAppState((state) => state.setPreferredMusicEngine);
  const navigationParams         = useAppState((state) => state.navigationParams);

  // Hardcoded fallback — same data as server's SET_META, shown immediately
  const FALLBACK_SETS = [
    { set: 1,  key: 'Dm', bpm: 48,  tone: 'אובדן, עצב עמוק',    toneEn: 'loss, grief',           icon: 'rainy-outline',   trackCount: 0, previewUrl: null },
    { set: 2,  key: 'Am', bpm: 58,  tone: 'מלנכוליה, ערגה',      toneEn: 'melancholy, longing',   icon: 'moon-outline',    trackCount: 0, previewUrl: null },
    { set: 3,  key: 'C',  bpm: 64,  tone: 'תקווה, ריפוי',         toneEn: 'hope, healing',         icon: 'sunny-outline',   trackCount: 0, previewUrl: null },
    { set: 4,  key: 'G',  bpm: 70,  tone: 'חמימות, משפחה',        toneEn: 'warmth, family',        icon: 'heart-outline',   trackCount: 0, previewUrl: null },
    { set: 5,  key: 'D',  bpm: 76,  tone: 'הישג, גאווה',          toneEn: 'achievement, pride',    icon: 'trophy-outline',  trackCount: 0, previewUrl: null },
    { set: 6,  key: 'G',  bpm: 82,  tone: 'חגיגי, שמחה',          toneEn: 'celebratory, joyful',   icon: 'star-outline',    trackCount: 0, previewUrl: null },
    { set: 7,  key: 'D',  bpm: 92,  tone: 'אירוע גדול, קהילה',    toneEn: 'grand event, community',icon: 'people-outline',  trackCount: 0, previewUrl: null },
    { set: 8,  key: 'A',  bpm: 104, tone: 'ספורט, אנרגיה',        toneEn: 'sport, energy',         icon: 'flash-outline',   trackCount: 0, previewUrl: null },
    { set: 9,  key: 'F',  bpm: 66,  tone: 'אינטימי, אישי',        toneEn: 'intimate, personal',    icon: 'flower-outline',  trackCount: 0, previewUrl: null },
    { set: 10, key: 'C',  bpm: 60,  tone: 'אוניברסלי, אמביינט',  toneEn: 'universal, ambient',    icon: 'globe-outline',   trackCount: 0, previewUrl: null },
    { set: 11, key: 'Em', bpm: 110, tone: 'דיגיטלי, מודרני',      toneEn: 'digital, modern',       icon: 'pulse-outline',   trackCount: 0, previewUrl: null },
  ];
  const [sunoSets, setSunoSets]             = useState(FALLBACK_SETS);
  const [loadingSets, setLoadingSets]       = useState(false);
  // selectedMusic could be 'suno-set-2' (new) or 'gentle-warmth' (old) or 'none'
  const initialSet = selectedMusic === 'none' ? 'none'
    : selectedMusic === 'ai-generated' ? 'ai-generated'
    : selectedMusic?.startsWith('suno-set-') ? parseInt(selectedMusic.replace('suno-set-', ''))
    : null;
  const [currentSelection, setCurrentSelection] = useState(initialSet);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const soundRef = useRef(null);

  // Enrich sets from server in background (adds previewUrl + real trackCount)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/api/suno-sets`, { signal: controller.signal });
        const data = await res.json();
        if (data.success && data.sets?.length) setSunoSets(data.sets);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Could not enrich Suno sets:', err.message);
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    return () => { stopPreview(); };
  }, []);

  const stopPreview = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    setPlayingPreview(null);
  };

  const handleSelect = (setNum) => {
    setCurrentSelection(setNum);
  };

  const handlePreviewToggle = async (setNum, previewUrl) => {
    if (playingPreview === setNum) {
      await stopPreview();
      return;
    }
    if (!previewUrl) return;

    await stopPreview();
    setIsLoadingPreview(true);
    setPlayingPreview(setNum);

    try {
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true, volume: 0.4, isLooping: true }
      );
      soundRef.current = sound;
    } catch (err) {
      console.error('Preview error:', err.message);
      setPlayingPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    await stopPreview();
    if (!currentSelection) return;

    if (currentSelection === 'none') {
      setSelectedMusic('none');
      setPreferredMusicEngine('suno');
      if (currentStoryId) {
        await storiesService.updateStory(currentStoryId, { music: 'none', lockedSet: null, musicAmbient: null });
      }
      go(navigationParams?.returnTo || 'Instructions');
      return;
    }

    if (currentSelection === 'ai-generated') {
      setSelectedMusic('ai-generated');
      setPreferredMusicEngine('musicgen');
      if (currentStoryId) {
        await storiesService.updateStory(currentStoryId, { music: 'ai-generated', lockedSet: null, musicAmbient: null });
      }
      go(navigationParams?.returnTo || 'Instructions');
      return;
    }

    const chosenSet = sunoSets.find(s => s.set === currentSelection);
    setSelectedMusic(`suno-set-${currentSelection}`);
    setPreferredMusicEngine('suno');

    if (currentStoryId && chosenSet) {
      const musicData = {
        music:      `suno-set-${currentSelection}`,
        lockedSet:  currentSelection,
        musicAmbient: {
          id:         `suno-set-${currentSelection}`,
          name:       chosenSet.toneEn,
          nameHe:     chosenSet.tone,
          key:        chosenSet.key,
          bpm:        chosenSet.bpm,
          url:        chosenSet.previewUrl || null,
          previewTrackId: chosenSet.previewTrackId || null,
        },
      };
      await storiesService.updateStory(currentStoryId, musicData);
      console.log(`🎵 Locked Set ${currentSelection} (${chosenSet.tone})`);
    }

    go(navigationParams?.returnTo || 'Instructions');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('musicSelection.title')} onBack={back} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{t('musicSelection.description')}</Text>

        {/* No music option */}
        <TouchableOpacity
          style={[styles.noneOption, currentSelection === 'none' && styles.noneOptionSelected]}
          onPress={() => handleSelect('none')}
        >
          <Ionicons name="volume-mute-outline" size={20} color={currentSelection === 'none' ? theme.colors.primary : theme.colors.subtext} />
          <Text style={[styles.noneText, currentSelection === 'none' && styles.noneTextSelected]}>
            {t('musicSelection.no_music')}
          </Text>
          {currentSelection === 'none' && (
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        {/* AI MusicGen — premium option */}
        <TouchableOpacity
          style={[styles.aiOption, currentSelection === 'ai-generated' && styles.aiOptionSelected]}
          onPress={() => handleSelect('ai-generated')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={currentSelection === 'ai-generated'
              ? [theme.colors.gradient.start, theme.colors.gradient.end]
              : ['#f5f0ff', '#eef0ff']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.aiOptionGradient}
          >
            <View style={styles.aiOptionLeft}>
              <Text style={styles.aiOptionIcon}>✨</Text>
              <View>
                <View style={styles.aiOptionTitleRow}>
                  <Text style={[styles.aiOptionTitle, currentSelection === 'ai-generated' && styles.aiOptionTitleSelected]}>
                    {t('musicSelection.ai_title')}
                  </Text>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PRO</Text>
                  </View>
                </View>
                <Text style={[styles.aiOptionDesc, currentSelection === 'ai-generated' && styles.aiOptionDescSelected]}>
                  {t('musicSelection.ai_desc')}
                </Text>
              </View>
            </View>
            {currentSelection === 'ai-generated' && (
              <Ionicons name="checkmark-circle" size={24} color="white" />
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Suno sets grid */}
        {loadingSets ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {sunoSets.map((setItem) => {
              const isSelected = currentSelection === setItem.set;
              const isPreviewing = playingPreview === setItem.set;
              return (
                <TouchableOpacity
                  key={setItem.set}
                  style={[styles.musicCard, isSelected && styles.musicCardSelected]}
                  onPress={() => handleSelect(setItem.set)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                      <Ionicons
                        name={setItem.icon || 'musical-notes-outline'}
                        size={22}
                        color={isSelected ? '#fff' : theme.colors.primary}
                      />
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                  </View>

                  <Text style={[styles.cardName, isSelected && styles.cardNameSelected]}>
                    {isHe ? setItem.tone : setItem.toneEn}
                  </Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardMeta}>
                      <Text style={styles.metaText}>{setItem.key}</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>{setItem.bpm} BPM</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>{setItem.trackCount} טרקים</Text>
                    </View>
                    {setItem.previewUrl && (
                      <TouchableOpacity
                        style={[styles.previewButton, isPreviewing && styles.previewButtonActive]}
                        onPress={(e) => {
                          e.stopPropagation && e.stopPropagation();
                          handlePreviewToggle(setItem.set, setItem.previewUrl);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isLoadingPreview && isPreviewing ? (
                          <ActivityIndicator size={14} color={theme.colors.accent} />
                        ) : (
                          <Ionicons
                            name={isPreviewing ? 'pause' : 'play'}
                            size={14}
                            color={isPreviewing ? '#fff' : theme.colors.accent}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <AppButton
            title={t('musicSelection.btn_save')}
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!currentSelection}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: theme.colors.bg },
  content:              { flex: 1, padding: theme.spacing[4] },
  description:          { ...theme.typography.body, color: theme.colors.subtext, textAlign: 'center', marginBottom: theme.spacing[4], lineHeight: 24 },
  noneOption:           { flexDirection: 'row', alignItems: 'center', padding: theme.spacing[3], borderRadius: theme.radii.md, borderWidth: 1.5, borderColor: '#e0e0e0', marginBottom: theme.spacing[4], gap: 10 },
  noneOptionSelected:   { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}08` },
  noneText:             { flex: 1, fontSize: 15, color: theme.colors.subtext, fontWeight: '500' },
  noneTextSelected:     { color: theme.colors.primary },
  grid:                 { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  musicCard:            { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 2, borderColor: '#f0f0f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  musicCardSelected:    { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}06`, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  cardHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconContainer:        { width: 40, height: 40, borderRadius: 12, backgroundColor: `${theme.colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  iconContainerSelected:{ backgroundColor: theme.colors.primary },
  cardName:             { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8, textAlign: 'right', lineHeight: 20 },
  cardNameSelected:     { color: theme.colors.primary },
  cardFooter:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta:             { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  metaText:             { fontSize: 10, color: theme.colors.subtext, fontWeight: '600', opacity: 0.6 },
  metaDot:              { fontSize: 10, color: theme.colors.subtext, opacity: 0.4 },
  previewButton:        { width: 28, height: 28, borderRadius: 14, backgroundColor: `${theme.colors.accent}15`, alignItems: 'center', justifyContent: 'center' },
  previewButtonActive:  { backgroundColor: theme.colors.accent },
  actions:              { paddingTop: theme.spacing[5], paddingBottom: theme.spacing[8] },
  aiOption:             { borderRadius: theme.radii.xl, overflow: 'hidden', marginBottom: theme.spacing[4], borderWidth: 2, borderColor: 'transparent', ...theme.shadows.sm },
  aiOptionSelected:     { borderColor: theme.colors.primary },
  aiOptionGradient:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing[4] },
  aiOptionLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  aiOptionIcon:         { fontSize: 28 },
  aiOptionTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aiOptionTitle:        { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  aiOptionTitleSelected:{ color: 'white' },
  aiOptionDesc:         { fontSize: 12, color: theme.colors.subtext, lineHeight: 16 },
  aiOptionDescSelected: { color: 'rgba(255,255,255,0.85)' },
  premiumBadge:         { backgroundColor: theme.colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  premiumBadgeText:     { fontSize: 10, fontWeight: '800', color: 'white', letterSpacing: 0.5 },
});
