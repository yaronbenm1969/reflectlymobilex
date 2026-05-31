import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import { storageService } from '../services/storageService';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.videoConverterUrl ||
  'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';
const UPLOAD_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
  ...(process.env.EXPO_PUBLIC_ACCESS_CODE ? { 'x-app-access-code': process.env.EXPO_PUBLIC_ACCESS_CODE } : {}),
};

export const InstructionsScreen = () => {
  const { t } = useTranslation();
  const { go, back } = useNav();
  const insets = useSafeAreaInsets();
  const storyName = useAppState((state) => state.storyName);
  const playerInstructions = useAppState((state) => state.playerInstructions);
  const setPlayerInstructions = useAppState((state) => state.setPlayerInstructions);
  const privacySettings = useAppState((state) => state.privacySettings);
  const setPrivacySettings = useAppState((state) => state.setPrivacySettings);
  const communitySettings = useAppState((state) => state.communitySettings);
  const setCommunitySettings = useAppState((state) => state.setCommunitySettings);
  const lastRecordingUri = useAppState((state) => state.lastRecordingUri);
  const currentStoryId = useAppState((state) => state.currentStoryId);

  const [genericInstructions, setGenericInstructions] = useState(playerInstructions.generic || '');
  const [video1Time, setVideo1Time] = useState(playerInstructions.video1Time || 30);
  const [video2Time, setVideo2Time] = useState(playerInstructions.video2Time || 30);
  const [video3Time, setVideo3Time] = useState(playerInstructions.video3Time || 30);
  const [allowSocialMedia, setAllowSocialMedia] = useState(privacySettings.allowSocialMedia);
  const [publishingEnabled, setPublishingEnabled] = useState(privacySettings.publishingEnabled ?? true);
  const [communityMode, setCommunityMode] = useState(communitySettings.communityMode ?? false);
  const [maxPlayers, setMaxPlayers] = useState(communitySettings.maxPlayers ?? 5);
  const [approvalMode, setApprovalMode] = useState(communitySettings.approvalMode ?? 'open');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Instructions input mode
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'audio'
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecording, setAudioRecording] = useState(null);
  const [instructionAudioUri, setInstructionAudioUri] = useState(playerInstructions.audioUri || null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationSecs, setDictationSecs] = useState(0);
  const dictationRecording = useRef(null);
  const dictationTimerRef = useRef(null);
  const audioSound = useRef(null);
  const recordingTimerRef = useRef(null);

  const handleContinue = async () => {
    setPlayerInstructions({
      generic: genericInstructions,
      video1Time,
      video2Time,
      video3Time,
    });
    setPrivacySettings({
      allowSocialMedia,
      privateOnly: !allowSocialMedia,
      publishingEnabled,
    });
    setCommunitySettings({ communityMode, maxPlayers, approvalMode });
    
    if (lastRecordingUri && currentStoryId) {
      setIsUploading(true);
      console.log('📤 Uploading video to Firebase Storage...');
      
      try {
        const uploadResult = await storageService.uploadVideo(lastRecordingUri, currentStoryId, 'key');
        
        if (uploadResult.success) {
          console.log('✅ Video uploaded, URL:', uploadResult.url);

          // Upload audio instruction if exists
          let instructionAudioUrl = null;
          if (instructionAudioUri) {
            console.log('📤 Uploading audio instruction...');
            const audioResult = await storageService.uploadAudio(instructionAudioUri, currentStoryId);
            if (audioResult.success) {
              instructionAudioUrl = audioResult.url;
              console.log('✅ Audio instruction uploaded:', instructionAudioUrl);
            }
          }

          const updateResult = await storiesService.updateStory(currentStoryId, {
            videoUri: uploadResult.url,
            instructions: genericInstructions,
            instructionAudioUrl,
            videoTimings: { video1: video1Time, video2: video2Time, video3: video3Time },
            privacySettings: { allowSocialMedia, privateOnly: !allowSocialMedia, publishingEnabled },
            communitySettings: { communityMode, maxPlayers, approvalMode },
          });
          
          if (updateResult.success) {
            console.log('✅ Story updated with video URL');
          }
        } else {
          Alert.alert(t('common.error'), t('instructions.error_upload'));
          setIsUploading(false);
          return;
        }
      } catch (error) {
        console.error('❌ Upload error:', error);
        Alert.alert(t('common.error'), t('instructions.error_upload_generic'));
        setIsUploading(false);
        return;
      }
      
      setIsUploading(false);
    }

    if (communityMode) {
      // Publish to community — mark story as active and show community feed
      if (currentStoryId) {
        await storiesService.updateStory(currentStoryId, { status: 'active' });
      }
      go('CommunityFeed');
    } else {
      go('WhatsAppShare');
    }
  };

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
    } catch (e) { console.error('Audio record start failed', e); }
  };

  const stopAudioRec = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    try {
      await audioRecording.stopAndUnloadAsync();
      const uri = audioRecording.getURI();
      setInstructionAudioUri(uri);
      setAudioRecording(null);
    } catch (e) { console.error('Audio record stop failed', e); }
  };

  const playAudioRec = async () => {
    if (!instructionAudioUri) return;
    if (audioSound.current) { await audioSound.current.unloadAsync(); }
    const { sound } = await Audio.Sound.createAsync({ uri: instructionAudioUri }, { volume: 1.0 });
    audioSound.current = sound;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    setIsPlayingAudio(true);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) setIsPlayingAudio(false); });
  };

  const formatSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const transcribeAudio = async () => {
    if (!instructionAudioUri || isTranscribing) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('video', { uri: instructionAudioUri, name: 'instruction.m4a', type: 'audio/m4a' });
      const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: 'POST',
        headers: UPLOAD_HEADERS,
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.text) {
        setGenericInstructions(json.text.slice(0, 400));
        setInputMode('text');
      } else {
        Alert.alert(t('common.error'), t('instructions.transcribe_error'));
      }
    } catch (e) {
      console.error('Transcribe failed', e);
      Alert.alert(t('common.error'), t('instructions.transcribe_error'));
    } finally {
      setIsTranscribing(false);
    }
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
      setInstructionAudioUri(uri); // save audio so player can hear it
      setIsTranscribing(true);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const formData = new FormData();
      formData.append('video', { uri, name: 'dictation.m4a', type: 'audio/m4a' });
      const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: 'POST', headers: UPLOAD_HEADERS, body: formData,
      });
      const json = await res.json();
      console.log('🎙 Transcribe response:', res.status, JSON.stringify(json).substring(0, 200));
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={[theme.colors.gradient.start, theme.colors.gradient.end]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('instructions.title')}</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.storyNameLabel}>
          {t('instructions.story_label')} <Text style={styles.storyNameValue}>{storyName}</Text>
        </Text>

        <Card style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {/* Header strip */}
          <LinearGradient colors={['#f3e8ff', '#ede9fe']} style={styles.instrHeader}>
            <Ionicons name="chatbubbles" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.instrHeaderTitle}>{t('instructions.general_title')}</Text>
              <Text style={styles.instrHeaderSub}>{t('instructions.general_motivate')}</Text>
            </View>
          </LinearGradient>

          {/* Mode tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, inputMode === 'text' && styles.modeTabActive]}
              onPress={() => setInputMode('text')}
            >
              <Ionicons name="pencil-outline" size={15} color={inputMode === 'text' ? 'white' : theme.colors.subtext} />
              <Text style={[styles.modeTabText, inputMode === 'text' && styles.modeTabTextActive]}>
                {t('instructions.mode_text')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, inputMode === 'audio' && styles.modeTabActive]}
              onPress={() => setInputMode('audio')}
            >
              <Ionicons name="mic-outline" size={15} color={inputMode === 'audio' ? 'white' : theme.colors.subtext} />
              <Text style={[styles.modeTabText, inputMode === 'audio' && styles.modeTabTextActive]}>
                {t('instructions.mode_audio')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            {inputMode === 'text' ? (
              <>
                <TextInput
                  style={styles.instructionsInput}
                  placeholder={t('instructions.general_placeholder')}
                  placeholderTextColor={theme.colors.subtext}
                  value={genericInstructions}
                  onChangeText={(v) => setGenericInstructions(v.slice(0, 400))}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  textAlign="right"
                />
                <View style={styles.textModeFooter}>
                  <Text style={styles.charCount}>{genericInstructions.length}/400</Text>
                  <TouchableOpacity
                    style={[styles.dictateBtn, isDictating && styles.dictateBtnActive]}
                    onPress={isDictating ? stopDictation : startDictation}
                    disabled={isTranscribing}
                  >
                    {isTranscribing
                      ? <ActivityIndicator size="small" color="white" />
                      : <Ionicons name={isDictating ? 'stop' : 'mic'} size={16} color="white" />}
                    <Text style={styles.dictateBtnText}>
                      {isTranscribing
                        ? t('instructions.transcribing')
                        : isDictating
                          ? `${t('instructions.recording')} ${formatSecs(dictationSecs)}`
                          : t('instructions.dictate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.audioPanel}>
                {!instructionAudioUri ? (
                  <>
                    <TouchableOpacity
                      style={[styles.micBtn, isRecording && styles.micBtnActive]}
                      onPress={isRecording ? stopAudioRec : startAudioRec}
                    >
                      <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.audioHint}>
                      {isRecording
                        ? `${t('instructions.recording')} ${formatSecs(recordingSecs)}`
                        : t('instructions.tap_to_record')}
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.audioRecorded}>
                      <Ionicons name="checkmark-circle" size={28} color={theme.colors.success} />
                      <Text style={styles.audioRecordedText}>{t('instructions.audio_recorded')} ({formatSecs(recordingSecs)})</Text>
                    </View>
                    <View style={styles.audioActions}>
                      <TouchableOpacity style={styles.audioActionBtn} onPress={playAudioRec}>
                        <Ionicons name={isPlayingAudio ? 'pause' : 'play'} size={20} color={theme.colors.primary} />
                        <Text style={styles.audioActionText}>{t('instructions.play')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.audioActionBtn} onPress={() => { setInstructionAudioUri(null); setRecordingSecs(0); }}>
                        <Ionicons name="refresh" size={20} color={theme.colors.subtext} />
                        <Text style={[styles.audioActionText, { color: theme.colors.subtext }]}>{t('instructions.re_record')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('instructions.privacy_title')}</Text>

          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>{t('instructions.allow_publishing')}</Text>
            <Switch
              value={publishingEnabled}
              onValueChange={(value) => {
                if (value) {
                  Alert.alert(
                    t('instructions.publishing_confirm_title'),
                    t('instructions.publishing_confirm_text'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('instructions.publishing_confirm_ok'), onPress: () => setPublishingEnabled(true) },
                    ]
                  );
                } else {
                  setPublishingEnabled(false);
                }
              }}
              trackColor={{ false: '#ddd', true: theme.colors.accent }}
              thumbColor={publishingEnabled ? theme.colors.white : '#f4f3f4'}
            />
          </View>
          <Text style={styles.privacyDescription}>
            {publishingEnabled
              ? t('instructions.publishing_on_desc')
              : t('instructions.publishing_off_desc')}
          </Text>

          <View style={[styles.privacyRow, { marginTop: theme.spacing[4] }]}>
            <Text style={styles.privacyLabel}>{t('instructions.allow_social')}</Text>
            <Switch
              value={allowSocialMedia}
              onValueChange={setAllowSocialMedia}
              trackColor={{ false: '#ddd', true: theme.colors.accent }}
              thumbColor={allowSocialMedia ? theme.colors.white : '#f4f3f4'}
            />
          </View>
          <Text style={styles.privacyDescription}>
            {allowSocialMedia
              ? t('instructions.social_on_desc')
              : t('instructions.social_off_desc')}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('instructions.community_title')}</Text>
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>{t('instructions.community_toggle')}</Text>
            <Switch
              value={communityMode}
              onValueChange={setCommunityMode}
              trackColor={{ false: '#ddd', true: theme.colors.accent }}
              thumbColor={communityMode ? theme.colors.white : '#f4f3f4'}
            />
          </View>
          <Text style={styles.privacyDescription}>
            {communityMode
              ? t('instructions.community_on_desc')
              : t('instructions.community_off_desc')}
          </Text>

          {communityMode && (
            <>
              <Text style={[styles.timeSelectorLabel, { marginTop: theme.spacing[4] }]}>
                {t('instructions.max_players')}
              </Text>
              <View style={styles.timeButtons}>
                {[3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.timeButton, maxPlayers === n && styles.timeButtonSelected]}
                    onPress={() => setMaxPlayers(n)}
                  >
                    <Text style={[styles.timeButtonText, maxPlayers === n && styles.timeButtonTextSelected]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.timeSelectorLabel, { marginTop: theme.spacing[4] }]}>
                {t('instructions.approval_label')}
              </Text>
              <View style={styles.approvalRow}>
                <TouchableOpacity
                  style={[styles.approvalButton, approvalMode === 'open' && styles.approvalButtonSelected]}
                  onPress={() => setApprovalMode('open')}
                >
                  <Ionicons
                    name="lock-open-outline"
                    size={18}
                    color={approvalMode === 'open' ? theme.colors.white : theme.colors.text}
                  />
                  <Text style={[styles.approvalButtonText, approvalMode === 'open' && styles.approvalButtonTextSelected]}>
                    {t('instructions.approval_open')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approvalButton, approvalMode === 'manual' && styles.approvalButtonSelected]}
                  onPress={() => setApprovalMode('manual')}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={approvalMode === 'manual' ? theme.colors.white : theme.colors.text}
                  />
                  <Text style={[styles.approvalButtonText, approvalMode === 'manual' && styles.approvalButtonTextSelected]}>
                    {t('instructions.approval_manual')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyDescription}>
                {approvalMode === 'open'
                  ? t('instructions.approval_open_desc')
                  : t('instructions.approval_manual_desc')}
              </Text>
            </>
          )}
        </Card>

        {isUploading && (
          <Card style={styles.uploadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.uploadingText}>{t('instructions.uploading_text')}</Text>
            <Text style={styles.uploadingSubtext}>{t('instructions.uploading_subtext')}</Text>
          </Card>
        )}

        <View style={styles.actions}>
          <AppButton
            title={isUploading ? t('instructions.btn_uploading') : communityMode ? t('instructions.btn_publish_community') : t('instructions.btn_continue')}
            onPress={handleContinue}
            variant="primary"
            size="lg"
            fullWidth
            disabled={isUploading}
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
    paddingBottom: theme.spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h3,
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  storyNameLabel: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  storyNameValue: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  card: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[2],
    textAlign: 'right',
  },
  sectionDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    marginBottom: theme.spacing[3],
    textAlign: 'right',
  },
  instrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 14,
  },
  instrHeaderTitle: {
    ...theme.typography.h4,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  instrHeaderSub: {
    ...theme.typography.small,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  modeTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ede9fe',
    backgroundColor: '#faf5ff',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary,
  },
  modeTabText: {
    fontSize: 14,
    color: theme.colors.subtext,
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  tipBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#86efac',
  },
  tipText: {
    fontSize: 13,
    color: '#166534',
    textAlign: 'right',
    lineHeight: 18,
  },
  instructionsInput: {
    backgroundColor: '#faf5ff',
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    padding: theme.spacing[3],
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 120,
  },
  textModeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.subtext,
  },
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
  },
  dictateBtnActive: {
    backgroundColor: '#ef4444',
  },
  dictateBtnText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  audioPanel: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  audioHint: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
  audioRecorded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioRecordedText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
  },
  audioActions: {
    flexDirection: 'row',
    gap: 16,
  },
  audioActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
  },
  audioActionText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  timeSelectorContainer: {
    marginBottom: theme.spacing[3],
  },
  timeSelectorLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing[2],
    textAlign: 'right',
  },
  timeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
  },
  timeButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  timeButtonText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  timeButtonTextSelected: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  privacyLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  privacyDescription: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    textAlign: 'right',
  },
  actions: {
    paddingVertical: theme.spacing[4],
  },
  approvalRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  approvalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  approvalButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  approvalButtonText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500',
  },
  approvalButtonTextSelected: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  uploadingCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    alignItems: 'center',
  },
  uploadingText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[3],
    textAlign: 'center',
  },
  uploadingSubtext: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
    textAlign: 'center',
  },
});
