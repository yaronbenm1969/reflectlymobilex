import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../ui/AppButton';
import { Card } from '../ui/Card';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import theme from '../theme/theme';

export const HomeScreen = () => {
  const { go } = useNav();
  const [connectionStatus, setConnectionStatus] = useState('Demo Mode - No Backend');
  
  const navigateToRecord = () => {
    console.log('🎬 Navigate to Record pressed');
    go('Record');
  };

  const buildTimestamp = new Date().toLocaleString();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().setSideMenuOpen(true)}
              accessibilityLabel="Open navigation menu"
            >
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.title}>Reflectly</Text>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => useAppState.getState().navigateTo('Settings')}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            Share your story, invite reflections
          </Text>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.buttonContainer}>
          <Card style={styles.actionCard}>
            <Text style={styles.cardTitle}>Start Your Journey</Text>
            <Text style={styles.cardDescription}>
              Record a personal story and invite friends to share their reflections
            </Text>
            
            <AppButton
              title="Start a New Story"
              onPress={navigateToRecord}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.primaryButton}
            />
            
            <AppButton
              title="My Stories"
              onPress={() => go('MyStories')}
              variant="secondary"
              size="lg"
              fullWidth
              style={styles.secondaryButton}
            />
          </Card>

          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
              <Text style={styles.infoTitle}>How it works</Text>
            </View>
            <Text style={styles.infoText}>
              1. Record your story in segments{'\n'}
              2. Invite friends via WhatsApp{'\n'}
              3. They record their reflections{'\n'}
              4. Get an AI-edited final video
            </Text>
          </Card>
        </View>

        <View style={styles.footer}>
          <Text style={styles.buildInfo}>Expo Snack Build: {buildTimestamp}</Text>
          <Text style={styles.connectionInfo}>{connectionStatus}</Text>
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
    paddingBottom: theme.spacing[6],
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
    marginBottom: theme.spacing[3],
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
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  buildInfo: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    fontFamily: 'monospace',
  },
  connectionInfo: {
    fontSize: 12,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
});