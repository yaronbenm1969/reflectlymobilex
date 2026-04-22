import React, { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import { storageService } from '../services/storageService';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

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
          
          const updateResult = await storiesService.updateStory(currentStoryId, {
            videoUri: uploadResult.url,
            instructions: genericInstructions,
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

  const timeOptions = [5, 15, 30, 45, 60, 90, 120];

  const TimeSelector = ({ label, value, onChange }) => (
    <View style={styles.timeSelectorContainer}>
      <Text style={styles.timeSelectorLabel}>{label}</Text>
      <View style={styles.timeButtons}>
        {timeOptions.map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeButton,
              value === time && styles.timeButtonSelected,
            ]}
            onPress={() => onChange(time)}
          >
            <Text
              style={[
                styles.timeButtonText,
                value === time && styles.timeButtonTextSelected,
              ]}
            >
              {time}s
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('instructions.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.storyNameLabel}>
          {t('instructions.story_label')} <Text style={styles.storyNameValue}>{storyName}</Text>
        </Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('instructions.general_title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('instructions.general_desc')}
          </Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder={t('instructions.general_placeholder')}
            placeholderTextColor={theme.colors.subtext}
            value={genericInstructions}
            onChangeText={setGenericInstructions}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            textAlign="right"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('instructions.timing_title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('instructions.timing_desc')}
          </Text>

          <TimeSelector
            label={t('instructions.video_1')}
            value={video1Time}
            onChange={setVideo1Time}
          />
          <TimeSelector
            label={t('instructions.video_2')}
            value={video2Time}
            onChange={setVideo2Time}
          />
          <TimeSelector
            label={t('instructions.video_3')}
            value={video3Time}
            onChange={setVideo3Time}
          />
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
  instructionsInput: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    padding: theme.spacing[3],
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 100,
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
