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
  const currentInviteCode = useAppState((state) => state.currentInviteCode);
  const user = useAppState((state) => state.user);
  const videoFormat = useAppState((state) => state.videoFormat);
  
  const inviteCode = currentInviteCode || '';
  
  const webPlayerUrl = useMemo(() => {
    if (!currentStoryId) return '';
    const domain = Constants.expoConfig?.extra?.webPlayerDomain || 
                   'reflectly-mobile-x--yaronbenm1.replit.app';
    // Use path /s/storyId AND query ?storyId= for redundancy (WhatsApp sometimes strips path)
    return `https://${domain}/s/${currentStoryId}?storyId=${currentStoryId}`;
  }, [currentStoryId]);
  
  const messageTemplate = useMemo(() => {
    if (!webPlayerUrl) {
      return `היי! 🎬\n\nזה הסיפור שלי: "${storyName}"\n\nאשמח אם תצפה ותשתף את השיקוף שלך!\n\nהורד את אפליקציית Reflectly כדי לצפות ולהגיב.\n\nתודה! ❤️`;
    }
    return `היי! 🎬

זה הסיפור שלי: "${storyName}"

אשמח אם תצפה ותשתף את השיקוף שלך!

📱 לחץ ארוך על הלינק ובחר "פתח ב-Safari":
${webPlayerUrl}

תודה! ❤️`;
  }, [storyName, webPlayerUrl]);

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
    const is3DFormat = videoFormat && videoFormat !== 'standard';
    if (is3DFormat) {
      go('FinalVideo');
    } else {
      go('Processing');
    }
  };

  const handleTestAsPlayer = async () => {
    if (!currentStoryId) {
      Alert.alert('שגיאה', 'אין סיפור פעיל');
      return;
    }
    try {
      const { storiesService } = require('../services/storiesService');
      const result = await storiesService.getStory(currentStoryId);
      if (result.success) {
        const enterPlayerMode = useAppState.getState().enterPlayerMode;
        enterPlayerMode(currentStoryId, result.story);
      } else {
        Alert.alert('שגיאה', 'לא נמצא סיפור');
      }
    } catch (err) {
      Alert.alert('שגיאה', err.message);
    }
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

        <Card style={styles.tipCard}>
          <Ionicons name="bulb" size={24} color={theme.colors.primary} />
          <Text style={styles.tipText}>
            לחץ על כפתור השיתוף כמה פעמים שתרצה כדי לשלוח להרבה חברים!
          </Text>
        </Card>

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

        <Card style={styles.testCard}>
          <View style={styles.testHeader}>
            <Ionicons name="flask" size={20} color={theme.colors.accent} />
            <Text style={styles.testTitle}>מצב בדיקה</Text>
          </View>
          <Text style={styles.testDescription}>
            היכנס כשחקן לסיפור הזה כדי לבדוק את הפלואו (כולל מוזיקה בהקלטה)
          </Text>
          <AppButton
            title="בדוק כשחקן"
            onPress={handleTestAsPlayer}
            variant="secondary"
            size="md"
            fullWidth
            icon="person-add"
          />
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
  tipCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    backgroundColor: '#FFF3E0',
  },
  tipText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'right',
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
  testCard: {
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
    borderStyle: 'dashed',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  testTitle: {
    ...theme.typography.h4,
    color: theme.colors.accent,
  },
  testDescription: {
    ...theme.typography.small,
    color: theme.colors.subtext,
    textAlign: 'right',
    marginBottom: theme.spacing[3],
  },
});
