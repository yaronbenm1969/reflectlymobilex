import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const CameraSettingsScreen = () => {
  const { back } = useNav();
  const { isCountdownEnabled, setCountdownEnabled } = useAppState();
  const [flashMode, setFlashMode] = useState('auto');
  const [videoQuality, setVideoQuality] = useState('high');

  const qualityOptions = [
    { id: 'low', name: 'Low Quality', description: 'Smaller file size' },
    { id: 'medium', name: 'Medium Quality', description: 'Balanced quality and size' },
    { id: 'high', name: 'High Quality', description: 'Best quality, larger files' },
  ];

  const flashOptions = [
    { id: 'off', name: 'Off', icon: 'flash-off' },
    { id: 'auto', name: 'Auto', icon: 'flash' },
    { id: 'on', name: 'On', icon: 'flash' },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Camera Settings</Text>
        <View style={styles.placeholder} />
      </SafeAreaView>

      <ScrollView style={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Recording Options</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Recording Countdown</Text>
              <Text style={styles.settingDescription}>
                3-second countdown before recording starts
              </Text>
            </View>
            <Switch
              value={isCountdownEnabled}
              onValueChange={setCountdownEnabled}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={isCountdownEnabled ? theme.colors.white : '#f4f3f4'}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Video Quality</Text>
          {qualityOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionItem}
              onPress={() => setVideoQuality(option.id)}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionName}>{option.name}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              {videoQuality === option.id && (
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Flash Mode</Text>
          <View style={styles.flashOptions}>
            {flashOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.flashOption,
                  flashMode === option.id && styles.flashOptionSelected
                ]}
                onPress={() => setFlashMode(option.id)}
              >
                <Ionicons 
                  name={option.icon} 
                  size={24} 
                  color={flashMode === option.id ? theme.colors.primary : theme.colors.subtext}
                />
                <Text style={[
                  styles.flashOptionText,
                  flashMode === option.id && styles.flashOptionTextSelected
                ]}>
                  {option.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Maximum Recording Time</Text>
            <Text style={styles.infoValue}>3 minutes</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Default Camera</Text>
            <Text style={styles.infoValue}>Front-facing</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Video Format</Text>
            <Text style={styles.infoValue}>MP4</Text>
          </View>
        </Card>
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
    paddingVertical: theme.spacing[3],
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
  section: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[4],
    fontSize: 18,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[3],
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing[3],
  },
  settingName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  settingDescription: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  optionDescription: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  flashOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  flashOption: {
    alignItems: 'center',
    padding: theme.spacing[3],
    borderRadius: theme.radii.md,
    minWidth: 80,
  },
  flashOptionSelected: {
    backgroundColor: `${theme.colors.primary}15`,
  },
  flashOptionText: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  flashOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.subtext,
  },
});