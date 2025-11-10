import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const TermsScreen = () => {
  const { back } = useNav();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Privacy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Terms of Service</Text>
          <Text style={styles.sectionContent}>
            This is a demo application created for showcase purposes. By using this app, you agree to these terms:
            {'\n\n'}
            • This app is for demonstration purposes only
            • No real user data is collected or stored
            • Recordings are stored locally on your device
            • The app may contain placeholder content and mock features
            {'\n\n'}
            For a production version, comprehensive terms of service would be provided here.
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.sectionContent}>
            Your privacy is important to us. This demo app:
            {'\n\n'}
            • Does not collect personal information
            • Does not transmit data to external servers
            • Stores recordings locally on your device only
            • Does not use tracking or analytics
            • Does not share data with third parties
            {'\n\n'}
            In a production version, a complete privacy policy would detail all data practices.
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Camera & Microphone Permissions</Text>
          <Text style={styles.sectionContent}>
            This app requests access to:
            {'\n\n'}
            • Camera: To record video stories
            • Microphone: To record audio with videos
            • Storage: To save recordings locally
            {'\n\n'}
            These permissions are used only for the core functionality of recording and storing your videos. 
            No data is transmitted outside of your device.
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.sectionContent}>
            For questions about these terms or privacy practices:
            {'\n\n'}
            Email: demo@reflectly.app
            {'\n'}
            Website: reflectly.app
            {'\n\n'}
            This is placeholder contact information for demo purposes.
          </Text>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date().toLocaleDateString()}
          </Text>
          <Text style={styles.footerText}>
            Reflectly Demo v1.0.0
          </Text>
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
    marginBottom: theme.spacing[3],
    fontSize: 18,
  },
  sectionContent: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[1],
  },
});