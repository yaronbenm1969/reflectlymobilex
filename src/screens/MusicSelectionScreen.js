import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, InteractionManager, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const AMBIENT_LIBRARY = [
  { 
    id: 'reflective-space', 
    name: 'Reflective Space',
    nameHe: 'מרחב פנימי',
    description: 'שקט פנימי, מרחב נשימה. פאדים רכים + פסנתר מינימלי.',
    icon: 'water-outline',
    key: 'D',
    bpm: 60
  },
  { 
    id: 'gentle-warmth', 
    name: 'Gentle Warmth',
    nameHe: 'חום עדין',
    description: 'חום אנושי, קרבה. כלי מיתר רכים + הרמוניה פתוחה.',
    icon: 'heart-outline',
    key: 'G',
    bpm: 65
  },
  { 
    id: 'soft-hope', 
    name: 'Soft Hope',
    nameHe: 'תקווה שקטה',
    description: 'תקווה שקטה, לא מתפרצת. מעבר מודאלי בהיר, ללא שיאים.',
    icon: 'sunny-outline',
    key: 'C',
    bpm: 70
  },
  { 
    id: 'tender-vulnerability', 
    name: 'Tender Vulnerability',
    nameHe: 'עדינות רגשית',
    description: 'עדינות רגשית, חשיפה. טקסטורה דקה מאוד, כמעט שקופה.',
    icon: 'flower-outline',
    key: 'Am',
    bpm: 58
  },
  { 
    id: 'quiet-strength', 
    name: 'Quiet Strength',
    nameHe: 'כוח שקט',
    description: 'יציבות שקטה. תו עוגן נמוך + תנועה איטית מעליו.',
    icon: 'shield-outline',
    key: 'E',
    bpm: 62
  },
  { 
    id: 'light-movement', 
    name: 'Light Movement',
    nameHe: 'תנועה עדינה',
    description: 'אנרגיה עדינה, מתאים לריקוד רגשי. פולס רך, בלי תופים.',
    icon: 'walk-outline',
    key: 'A',
    bpm: 80
  },
  { 
    id: 'floating-memory', 
    name: 'Floating Memory',
    nameHe: 'זיכרון מרחף',
    description: 'תחושת זיכרון / חלום. הרמוניות מרחפות, ריוורב עמוק.',
    icon: 'cloud-outline',
    key: 'Dm',
    bpm: 55
  },
  { 
    id: 'subtle-uplift', 
    name: 'Subtle Uplift',
    nameHe: 'התעלות עדינה',
    description: 'הרמה רגשית איטית לאורך זמן. התפתחות עדינה מאוד.',
    icon: 'trending-up-outline',
    key: 'Bb',
    bpm: 72
  },
  { 
    id: 'open-horizon', 
    name: 'Open Horizon',
    nameHe: 'אופק פתוח',
    description: 'תחושת פתיחות וסיום אופטימי. אקורדים פתוחים, אור עדין.',
    icon: 'globe-outline',
    key: 'D',
    bpm: 75
  },
  { 
    id: 'electric-pulse', 
    name: 'Electric Pulse',
    nameHe: 'פעימה חשמלית',
    description: 'טכנו מינימלי, אנרגיה עולה. בס עמוק + סינתים אטמוספריים.',
    icon: 'flash-outline',
    key: 'Fm',
    bpm: 122
  },
  { 
    id: 'world-celebration', 
    name: 'World Celebration',
    nameHe: 'חגיגה עולמית',
    description: 'מסיבה עולמית, ג\'מבה וקונגות. פיוז\'ן מזרח תיכוני-אפריקאי.',
    icon: 'earth-outline',
    key: 'G',
    bpm: 110
  },
];

export const MusicSelectionScreen = ({ route }) => {
  const { go, back } = useNav();
  const setSelectedMusic = useAppState((state) => state.setSelectedMusic);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const [currentSelection, setCurrentSelection] = useState(selectedMusic || null);
  const [isReady, setIsReady] = useState(false);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setIsReady(true);
      }, 300);
    });

    return () => task.cancel();
  }, []);

  useEffect(() => {
    return () => {
      stopPreview();
    };
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

  const handleSelect = (optionId) => {
    setCurrentSelection(optionId);
  };

  const handlePreviewToggle = async (trackId) => {
    if (playingPreview === trackId) {
      await stopPreview();
      return;
    }

    await stopPreview();
    setIsLoadingPreview(true);
    setPlayingPreview(trackId);

    try {
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const url = `https://storage.googleapis.com/reflectly-playback.firebasestorage.app/music/library/${trackId}/phase1.mp3`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.4, isLooping: true }
      );
      soundRef.current = sound;
      setIsLoadingPreview(false);
    } catch (err) {
      console.error('Preview error:', err.message);
      setPlayingPreview(null);
      setIsLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    await stopPreview();
    if (!isReady) {
      return;
    }
    if (currentSelection) {
      setSelectedMusic(currentSelection);
    }
    
    const selectedOption = AMBIENT_LIBRARY.find(o => o.id === currentSelection);
    
    if (currentStoryId) {
      const musicData = {
        music: currentSelection || 'none',
      };
      
      if (selectedOption) {
        musicData.musicAmbient = {
          id: selectedOption.id,
          name: selectedOption.name,
          key: selectedOption.key,
          bpm: selectedOption.bpm,
        };

        try {
          const API_URL = process.env.EXPO_PUBLIC_VIDEO_CONVERTER_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';
          const trackRes = await fetch(`${API_URL}/api/ambient-track/${selectedOption.id}`);
          const trackData = await trackRes.json();
          if (trackData.success && trackData.track?.url) {
            musicData.musicAmbient.url = trackData.track.url;
            console.log('🎵 Ambient track URL found:', trackData.track.url);
          }
        } catch (err) {
          console.log('⚠️ Could not fetch ambient track URL:', err.message);
        }
      }
      
      const result = await storiesService.updateStory(currentStoryId, musicData);
      console.log('💾 Firebase music update result:', result);
    }
    
    go('Instructions');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>מוזיקת רקע</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          בחר/י אווירה מוזיקלית שתתנגן ברקע בזמן הצילום ותעניק השראה למשתתפים
        </Text>

        <TouchableOpacity
          style={[
            styles.noneOption,
            currentSelection === 'none' && styles.noneOptionSelected
          ]}
          onPress={() => handleSelect('none')}
        >
          <Ionicons name="volume-mute-outline" size={20} color={currentSelection === 'none' ? theme.colors.primary : theme.colors.subtext} />
          <Text style={[styles.noneText, currentSelection === 'none' && styles.noneTextSelected]}>
            ללא מוזיקה
          </Text>
          {currentSelection === 'none' && (
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        <View style={styles.grid}>
          {AMBIENT_LIBRARY.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.musicCard,
                currentSelection === option.id && styles.musicCardSelected
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[
                  styles.iconContainer,
                  currentSelection === option.id && styles.iconContainerSelected
                ]}>
                  <Ionicons 
                    name={option.icon} 
                    size={22} 
                    color={currentSelection === option.id ? '#fff' : theme.colors.primary} 
                  />
                </View>
                {currentSelection === option.id && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                )}
              </View>
              
              <Text style={[
                styles.cardName,
                currentSelection === option.id && styles.cardNameSelected
              ]}>
                {option.nameHe}
              </Text>
              
              <Text style={styles.cardNameEn}>{option.name}</Text>
              
              <Text style={styles.cardDescription} numberOfLines={2}>
                {option.description}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>{option.key}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{option.bpm} BPM</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.previewButton,
                    playingPreview === option.id && styles.previewButtonActive,
                  ]}
                  onPress={(e) => {
                    e.stopPropagation && e.stopPropagation();
                    handlePreviewToggle(option.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isLoadingPreview && playingPreview === option.id ? (
                    <ActivityIndicator size={14} color={theme.colors.accent} />
                  ) : (
                    <Ionicons
                      name={playingPreview === option.id ? 'pause' : 'play'}
                      size={14}
                      color={playingPreview === option.id ? '#fff' : theme.colors.accent}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actions}>
          <AppButton
            title="שמור בחירה"
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: 50,
    paddingBottom: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
    lineHeight: 24,
  },
  noneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3],
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    marginBottom: theme.spacing[4],
    gap: 10,
  },
  noneOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  noneText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.subtext,
    fontWeight: '500',
  },
  noneTextSelected: {
    color: theme.colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  musicCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  musicCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}06`,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: theme.colors.primary,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
    textAlign: 'right',
  },
  cardNameSelected: {
    color: theme.colors.primary,
  },
  cardNameEn: {
    fontSize: 11,
    color: theme.colors.subtext,
    marginBottom: 6,
    opacity: 0.7,
  },
  cardDescription: {
    fontSize: 12,
    color: theme.colors.subtext,
    lineHeight: 18,
    textAlign: 'right',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  metaText: {
    fontSize: 10,
    color: theme.colors.subtext,
    fontWeight: '600',
    opacity: 0.6,
  },
  metaDot: {
    fontSize: 10,
    color: theme.colors.subtext,
    opacity: 0.4,
  },
  actions: {
    paddingTop: theme.spacing[5],
    paddingBottom: theme.spacing[8],
  },
});
