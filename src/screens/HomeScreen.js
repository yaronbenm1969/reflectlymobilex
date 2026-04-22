import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../ui/AppButton';
import { Card } from '../ui/Card';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import theme from '../theme/theme';

const logoImage = require('../../assets/logo.png');

const PARTICIPANT_OPTIONS = [
  { label: '1-10', clipCount: 3, maxClipDuration: 60 },
  { label: '11-20', clipCount: 1, maxClipDuration: 30 },
  { label: '21-40', clipCount: 1, maxClipDuration: 15 },
  { label: '40+', clipCount: 1, maxClipDuration: 10 },
];

export const HomeScreen = () => {
  const { t, i18n } = useTranslation();
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const setStoryName = useAppState((state) => state.setStoryName);
  const setCurrentStoryId = useAppState((state) => state.setCurrentStoryId);
  const setCurrentInviteCode = useAppState((state) => state.setCurrentInviteCode);
  const setStoryClipCount = useAppState((state) => state.setStoryClipCount);
  const setStoryMaxClipDuration = useAppState((state) => state.setStoryMaxClipDuration);
  const user = useAppState((state) => state.user);
  const [localStoryName, setLocalStoryName] = useState(storyName || '');
  const [isCreating, setIsCreating] = useState(false);
  const [participantRange, setParticipantRange] = useState('1-10');
  
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
      maxParticipants: participantRange,
      clipCount: selectedOption.clipCount,
      maxClipDuration: selectedOption.maxClipDuration,
      language: i18n.language || 'he',
    }, {
      displayName: user.displayName || '',
      email: user.email || '',
    });

    if (result.success) {
      setCurrentStoryId(result.storyId);
      setCurrentInviteCode(result.inviteCode);
      setStoryClipCount(selectedOption.clipCount);
      setStoryMaxClipDuration(selectedOption.maxClipDuration);
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


  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.safeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().setSideMenuOpen(true)}
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.logoTitleContainer}>
              <Image 
                source={logoImage} 
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Reflectly</Text>
            </View>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().navigateTo('Settings')}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            {t('home.header_subtitle')}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.buttonContainer}>
          <Card style={styles.actionCard}>
            <Text style={styles.cardTitle}>{t('home.card_title')}</Text>
            
            <TextInput
              style={styles.storyNameInput}
              placeholder={t('home.story_input_placeholder')}
              placeholderTextColor={theme.colors.subtext}
              value={localStoryName}
              onChangeText={setLocalStoryName}
              textAlign="right"
            />
            
            <Text style={styles.participantLabel}>{t('home.participants_label')}</Text>
            <View style={styles.participantSelector}>
              {PARTICIPANT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.participantOption,
                    participantRange === opt.label && styles.participantOptionActive,
                  ]}
                  onPress={() => setParticipantRange(opt.label)}
                >
                  <Text style={[
                    styles.participantOptionText,
                    participantRange === opt.label && styles.participantOptionTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.cardDescription}>
              {t('home.card_description')}
            </Text>
            
            <AppButton
              title={isCreating ? t('home.button_creating') : t('home.button_create_new')}
              onPress={navigateToRecord}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.primaryButton}
              disabled={!localStoryName.trim() || isCreating}
            />
            
            <AppButton
              title={t('home.button_my_stories')}
              onPress={() => go('MyStories')}
              variant="secondary"
              size="lg"
              fullWidth
              style={styles.secondaryButton}
            />
          </Card>


          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={theme.colors.secondary} />
              <Text style={styles.infoTitle}>{t('home.info_title')}</Text>
            </View>
            <Text style={styles.infoText}>
              {'1. '}{t('home.info_step_1')}{'\n'}
              {'2. '}{t('home.info_step_2')}{'\n'}
              {'3. '}{t('home.info_step_3')}{'\n'}
              {'4. '}{t('home.info_step_4')}{'\n'}
              {'5. '}{t('home.info_step_5')}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingBottom: theme.spacing[6],
    paddingTop: 50,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.white,
    textAlign: 'center',
    opacity: 0.9,
    marginTop: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing[4],
  },
  buttonContainer: {
    paddingTop: theme.spacing[6],
    gap: theme.spacing[4],
  },
  actionCard: {
    padding: theme.spacing[6],
    alignItems: 'center',
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  storyNameInput: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: theme.spacing[4],
  },
  participantLabel: {
    ...theme.typography.h4,
    color: theme.colors.text,
    textAlign: 'right',
    alignSelf: 'flex-end',
    marginBottom: theme.spacing[2],
  },
  participantSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: theme.spacing[4],
    gap: 8,
  },
  participantOption: {
    flex: 1,
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radii.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
  },
  participantOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  participantOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  participantOptionTextActive: {
    color: theme.colors.white,
  },
  cardDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[5],
    lineHeight: 24,
  },
  primaryButton: {
    marginBottom: theme.spacing[3],
  },
  secondaryButton: {
    marginTop: theme.spacing[2],
  },
  infoCard: {
    padding: theme.spacing[5],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[3],
  },
  infoTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginLeft: theme.spacing[2],
  },
  infoText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    lineHeight: 24,
    textAlign: 'right',
  },
});
