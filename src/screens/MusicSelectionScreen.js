import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const API_URL = process.env.EXPO_PUBLIC_VIDEO_CONVERTER_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

export const MusicSelectionScreen = () => {
  const { t, i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const { go, back } = useNav();
  const setSelectedMusic    = useAppState((state) => state.setSelectedMusic);
  const selectedMusic       = useAppState((state) => state.selectedMusic);
  const currentStoryId      = useAppState((state) => state.currentStoryId);

  const [sunoSets, setSunoSets]             = useState([]);
  const [loadingSets, setLoadingSets]       = useState(true);
  // selectedMusic could be 'suno-set-2' (new) or 'gentle-warmth' (old) or 'none'
  const initialSet = selectedMusic === 'none' ? 'none'
    : selectedMusic?.startsWith('suno-set-') ? parseInt(selectedMusic.replace('suno-set-', ''))
    : null;
  const [currentSelection, setCurrentSelection] = useState(initialSet);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const soundRef = useRef(null);

  // Load available Suno sets from server
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/api/suno-sets`);
        const data = await res.json();
        if (data.success) setSunoSets(data.sets || []);
      } catch (err) {
        console.warn('Could not load Suno sets:', err.message);
      } finally {
        setLoadingSets(false);
      }
    })();
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
      if (currentStoryId) {
        await storiesService.updateStory(currentStoryId, { music: 'none', lockedSet: null, musicAmbient: null });
      }
      go('Instructions');
      return;
    }

    const chosenSet = sunoSets.find(s => s.set === currentSelection);
    setSelectedMusic(`suno-set-${currentSelection}`);

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

    go('Instructions');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('musicSelection.title')}</Text>
        <View style={styles.placeholder} />
      </View>

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
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing[4], paddingTop: 50, paddingBottom: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backButton:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:                { ...theme.typography.h3, color: theme.colors.text },
  placeholder:          { width: 40 },
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
});
