import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const WhatsAppShareScreen = () => {
  const { go, back } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const [sharedCount, setSharedCount] = useState(0);

  const currentStoryId = useAppState((state) => state.currentStoryId);
  const user = useAppState((state) => state.user);
  
  // Generate deep link that works from WhatsApp
  // Using expo.dev redirect format that opens in Expo Go
  const storyLink = useMemo(() => {
    const storyId = currentStoryId || `story_${Date.now()}`;
    // Use the tunnel URL for Expo Go
    // Format: https://expo.dev/go?link=exp://HOST/--/play/STORY_ID
    const expoUrl = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
    if (expoUrl) {
      const expLink = `exp://${expoUrl}/--/play/${storyId}`;
      // Wrap in expo.dev redirect for WhatsApp compatibility
      const link = `https://expo.dev/go?link=${encodeURIComponent(expLink)}`;
      console.log('📎 Generated story link:', link);
      console.log('📎 Original exp link:', expLink);
      return link;
    }
    // Fallback for production
    return `reflectly://play/${storyId}`;
  }, [currentStoryId]);
  
  const messageTemplate = `היי! 🎬

זה הסיפור שלי: "${storyName}"

אשמח אם תצפה ותשתף את השיקוף שלך!
לחץ על הקישור לצפייה ותגובה:
${storyLink}

תודה! ❤️`;

  const handleShareWhatsApp = async () => {
    try {
      const encodedMessage = encodeURIComponent(messageTemplate);
      const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
      
      await Linking.openURL(whatsappUrl);
      setSharedCount(prev => prev + 1);
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      handleNativeShare();
    }
  };

  const handleNativeShare = async () => {
    try {
      const result = await Share.share({
        message: messageTemplate,
        title: `הסיפור שלי: ${storyName}`,
      });
      
      if (result.action === Share.sharedAction) {
        setSharedCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleContinue = () => {
    go('Processing');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>הזמן חברים</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.previewCard}>
          <Text style={styles.previewTitle}>תצוגה מקדימה של ההודעה:</Text>
          <View style={styles.messagePreview}>
            <Text style={styles.messageText}>{messageTemplate}</Text>
          </View>
        </Card>

        <Card style={styles.shareCard}>
          <Text style={styles.shareTitle}>שתף עם חברים</Text>
          <Text style={styles.shareDescription}>
            שלח את ההזמנה לחברים שתרצה שישתתפו בסיפור שלך
          </Text>

          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={handleShareWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={28} color="white" />
            <Text style={styles.whatsappButtonText}>שתף ב-WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.otherShareButton}
            onPress={handleNativeShare}
          >
            <Ionicons name="share-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.otherShareButtonText}>שתף בדרך אחרת</Text>
          </TouchableOpacity>
        </Card>

        {sharedCount > 0 && (
          <Card style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={32} color={theme.colors.success} />
            <Text style={styles.statusText}>
              שיתפת {sharedCount} פעמים
            </Text>
          </Card>
        )}

        <View style={styles.actions}>
          <AppButton
            title="המשך לעיבוד"
            onPress={handleContinue}
            variant="primary"
            size="lg"
            fullWidth
          />
          <Text style={styles.skipNote}>
            תוכל להמשיך גם אם עדיין לא שיתפת
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
  previewCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  previewTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[3],
    textAlign: 'right',
  },
  messagePreview: {
    backgroundColor: '#DCF8C6',
    borderRadius: theme.radii.md,
    padding: theme.spacing[3],
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'right',
    lineHeight: 24,
  },
  shareCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    alignItems: 'center',
  },
  shareTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing[2],
  },
  shareDescription: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[4],
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing[3],
    gap: theme.spacing[2],
  },
  whatsappButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  otherShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: theme.spacing[2],
  },
  otherShareButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
  },
  statusCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  statusText: {
    ...theme.typography.body,
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  actions: {
    paddingVertical: theme.spacing[4],
    alignItems: 'center',
  },
  skipNote: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[2],
  },
});
