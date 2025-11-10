import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

export const HelpScreen = () => {
  const { back } = useNav();
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const faqItems = [
    {
      id: '1',
      question: 'How do I start recording a story?',
      answer: 'Tap the "Start a New Story" button on the home screen, then follow the prompts to record your story segments.'
    },
    {
      id: '2', 
      question: 'Can I invite friends to participate?',
      answer: 'Yes! After recording your story, you can share a link via WhatsApp to invite friends to record their reflections.'
    },
    {
      id: '3',
      question: 'What video quality should I use?',
      answer: 'For best results, use High Quality mode. You can adjust this in Camera Settings based on your storage preferences.'
    },
    {
      id: '4',
      question: 'How long can my recordings be?',
      answer: 'Each recording segment can be up to 3 minutes long. You can record multiple segments for longer stories.'
    },
    {
      id: '5',
      question: 'Can I add music to my videos?',
      answer: 'Yes! Choose from various music themes in the Music Selection screen, or keep your original audio only.'
    },
    {
      id: '6',
      question: 'Where are my videos stored?',
      answer: 'Videos are stored locally on your device. You can manage storage in the Settings screen.'
    },
  ];

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.welcomeCard}>
          <View style={styles.welcomeContent}>
            <Ionicons name="help-circle" size={40} color={theme.colors.primary} />
            <Text style={styles.welcomeTitle}>Need Help?</Text>
            <Text style={styles.welcomeText}>
              Find answers to common questions below, or contact support if you need additional assistance.
            </Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {faqItems.map((item) => (
          <Card key={item.id} style={styles.faqCard}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => toggleFAQ(item.id)}
            >
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Ionicons 
                name={expandedFAQ === item.id ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.colors.subtext} 
              />
            </TouchableOpacity>
            {expandedFAQ === item.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{item.answer}</Text>
              </View>
            )}
          </Card>
        ))}

        <Card style={styles.supportCard}>
          <View style={styles.supportContent}>
            <Ionicons name="mail" size={24} color={theme.colors.primary} />
            <Text style={styles.supportTitle}>Still need help?</Text>
            <Text style={styles.supportText}>
              Contact our support team for personalized assistance.
            </Text>
            <TouchableOpacity style={styles.contactButton}>
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Pro Tips</Text>
          <View style={styles.tipsList}>
            <View style={styles.tip}>
              <Ionicons name="bulb" size={16} color={theme.colors.warning} />
              <Text style={styles.tipText}>Record in good lighting for best video quality</Text>
            </View>
            <View style={styles.tip}>
              <Ionicons name="mic" size={16} color={theme.colors.warning} />
              <Text style={styles.tipText}>Speak clearly and avoid background noise</Text>
            </View>
            <View style={styles.tip}>
              <Ionicons name="time" size={16} color={theme.colors.warning} />
              <Text style={styles.tipText}>Keep segments short and focused for better engagement</Text>
            </View>
            <View style={styles.tip}>
              <Ionicons name="people" size={16} color={theme.colors.warning} />
              <Text style={styles.tipText}>Invite close friends who know your story well</Text>
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
  welcomeCard: {
    padding: theme.spacing[6],
    marginBottom: theme.spacing[6],
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginVertical: theme.spacing[3],
  },
  welcomeText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[4],
    fontSize: 18,
  },
  faqCard: {
    marginBottom: theme.spacing[2],
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing[4],
  },
  faqQuestion: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
    marginRight: theme.spacing[3],
  },
  faqAnswer: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  faqAnswerText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    lineHeight: 22,
  },
  supportCard: {
    padding: theme.spacing[6],
    marginVertical: theme.spacing[6],
  },
  supportContent: {
    alignItems: 'center',
  },
  supportTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginVertical: theme.spacing[3],
  },
  supportText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  contactButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.lg,
  },
  contactButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  tipsCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  tipsTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[4],
    fontSize: 18,
  },
  tipsList: {
    gap: theme.spacing[3],
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginLeft: theme.spacing[3],
    flex: 1,
    lineHeight: 22,
  },
});