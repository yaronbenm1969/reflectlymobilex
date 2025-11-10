import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const MusicSelectionScreen = ({ route }) => {
  const { go, back } = useNav();
  const setSelectedMusic = useAppState((state) => state.setSelectedMusic);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const [currentSelection, setCurrentSelection] = useState(selectedMusic || null);

  console.log('🎵 MusicSelectionScreen rendered');

  const musicOptions = [
    { id: 'upbeat', name: 'Upbeat', description: 'Energetic and positive' },
    { id: 'calm', name: 'Calm', description: 'Peaceful and relaxing' },
    { id: 'dramatic', name: 'Dramatic', description: 'Emotional and intense' },
    { id: 'romantic', name: 'Romantic', description: 'Sweet and loving' },
    { id: 'none', name: 'No Music', description: 'Keep original audio only' },
  ];

  const handleSave = () => {
    console.log('💾 Save music selection:', currentSelection);
    if (currentSelection) {
      setSelectedMusic(currentSelection);
    }
    go('Home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Select Music</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Choose background music for your story. The music will blend with your recorded audio.
        </Text>

        <Card style={styles.optionsContainer}>
          {musicOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.musicOption,
                currentSelection === option.id && styles.musicOptionSelected
              ]}
              onPress={() => setCurrentSelection(option.id)}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionInfo}>
                  <Text style={[
                    styles.optionName,
                    currentSelection === option.id && styles.optionNameSelected
                  ]}>
                    {option.name}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
                {currentSelection === option.id && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                )}
              </View>
              {option.id !== 'none' && (
                <TouchableOpacity style={styles.playButton}>
                  <Ionicons name="play" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <View style={styles.actions}>
          <AppButton
            title="Save Selection"
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
    marginBottom: theme.spacing[6],
    lineHeight: 24,
  },
  optionsContainer: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  musicOption: {
    padding: theme.spacing[4],
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing[3],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  musicOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}05`,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
  },
  optionNameSelected: {
    color: theme.colors.primary,
  },
  optionDescription: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingBottom: theme.spacing[6],
  },
});