import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNav } from '../hooks/useNav';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const AboutScreen = () => {
  const { back } = useNav();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>About</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.heroCard}>
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Text style={styles.appName}>Reflectly</Text>
            <Text style={styles.version}>Version 1.0.0</Text>
            <Text style={styles.tagline}>Share your story, invite reflections</Text>
          </LinearGradient>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>About Reflectly</Text>
          <Text style={styles.description}>
            Reflectly is an interactive video storytelling platform that enables you to record personal stories, 
            invite friends to record reflection clips, and automatically generate beautifully edited final videos.
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Record your story in segments</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Invite friends via WhatsApp</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>They record their reflections</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Get an AI-edited final video</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresList}>
            <View style={styles.feature}>
              <Ionicons name="videocam" size={20} color={theme.colors.primary} />
              <Text style={styles.featureText}>High-quality video recording</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="people" size={20} color={theme.colors.primary} />
              <Text style={styles.featureText}>Collaborative storytelling</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
              <Text style={styles.featureText}>Music and audio enhancement</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
              <Text style={styles.featureText}>AI-powered video editing</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="share" size={20} color={theme.colors.primary} />
              <Text style={styles.featureText}>Easy sharing via WhatsApp</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Info</Text>
          <View style={styles.techInfo}>
            <View style={styles.techItem}>
              <Text style={styles.techLabel}>Platform</Text>
              <Text style={styles.techValue}>React Native + Expo</Text>
            </View>
            <View style={styles.techItem}>
              <Text style={styles.techLabel}>Build</Text>
              <Text style={styles.techValue}>Expo Snack Demo</Text>
            </View>
            <View style={styles.techItem}>
              <Text style={styles.techLabel}>SDK Version</Text>
              <Text style={styles.techValue}>Expo SDK 52</Text>
            </View>
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
  heroCard: {
    marginBottom: theme.spacing[4],
    overflow: 'hidden',
  },
  heroGradient: {
    padding: theme.spacing[6],
    alignItems: 'center',
  },
  appName: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 32,
    marginBottom: theme.spacing[2],
  },
  version: {
    ...theme.typography.body,
    color: theme.colors.white,
    opacity: 0.9,
    marginBottom: theme.spacing[3],
  },
  tagline: {
    ...theme.typography.body,
    color: theme.colors.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  section: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[3],
    fontSize: 18,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    lineHeight: 24,
  },
  stepsList: {
    gap: theme.spacing[3],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  stepNumberText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  featuresList: {
    gap: theme.spacing[3],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginLeft: theme.spacing[3],
  },
  techInfo: {
    gap: theme.spacing[2],
  },
  techItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
  },
  techLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  techValue: {
    ...theme.typography.body,
    color: theme.colors.subtext,
  },
});