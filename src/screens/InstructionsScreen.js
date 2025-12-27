import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const InstructionsScreen = () => {
  const { go, back } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const playerInstructions = useAppState((state) => state.playerInstructions);
  const setPlayerInstructions = useAppState((state) => state.setPlayerInstructions);
  const privacySettings = useAppState((state) => state.privacySettings);
  const setPrivacySettings = useAppState((state) => state.setPrivacySettings);

  const [genericInstructions, setGenericInstructions] = useState(playerInstructions.generic || '');
  const [video1Time, setVideo1Time] = useState(playerInstructions.video1Time || 30);
  const [video2Time, setVideo2Time] = useState(playerInstructions.video2Time || 30);
  const [video3Time, setVideo3Time] = useState(playerInstructions.video3Time || 30);
  const [allowSocialMedia, setAllowSocialMedia] = useState(privacySettings.allowSocialMedia);

  const handleContinue = () => {
    setPlayerInstructions({
      generic: genericInstructions,
      video1Time,
      video2Time,
      video3Time,
    });
    setPrivacySettings({
      allowSocialMedia,
      privateOnly: !allowSocialMedia,
    });
    go('WhatsAppShare');
  };

  const timeOptions = [15, 30, 45, 60, 90, 120];

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
        <Text style={styles.title}>הוראות לשחקנים</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.storyNameLabel}>
          סיפור: <Text style={styles.storyNameValue}>{storyName}</Text>
        </Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>הוראות כלליות</Text>
          <Text style={styles.sectionDescription}>
            מה תרצה שהחברים שלך יעשו בתגובה לסיפור?
          </Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder="למשל: ספרו על רגע דומה שחוויתם..."
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
          <Text style={styles.sectionTitle}>זמן לכל סרטון</Text>
          <Text style={styles.sectionDescription}>
            כמה זמן לתת לכל אחד מ-3 סרטוני השיקוף?
          </Text>
          
          <TimeSelector
            label="סרטון 1"
            value={video1Time}
            onChange={setVideo1Time}
          />
          <TimeSelector
            label="סרטון 2"
            value={video2Time}
            onChange={setVideo2Time}
          />
          <TimeSelector
            label="סרטון 3"
            value={video3Time}
            onChange={setVideo3Time}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>הגדרות פרטיות</Text>
          <View style={styles.privacyRow}>
            <Text style={styles.privacyLabel}>אפשר פרסום ברשתות חברתיות</Text>
            <Switch
              value={allowSocialMedia}
              onValueChange={setAllowSocialMedia}
              trackColor={{ false: '#ddd', true: theme.colors.primary }}
              thumbColor={allowSocialMedia ? theme.colors.white : '#f4f3f4'}
            />
          </View>
          <Text style={styles.privacyDescription}>
            {allowSocialMedia
              ? 'הסרטון הסופי יוכל להיות משותף ברשתות חברתיות'
              : 'הסרטון הסופי יהיה לצפייה פרטית בלבד'}
          </Text>
        </Card>

        <View style={styles.actions}>
          <AppButton
            title="המשך לשליחת הזמנות"
            onPress={handleContinue}
            variant="primary"
            size="lg"
            fullWidth
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
});
