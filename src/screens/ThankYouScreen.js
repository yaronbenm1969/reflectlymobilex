import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const ThankYouScreen = () => {
  const { t } = useTranslation();
  const { go } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);

  const creatorName = navigationParams?.creatorName || t('thankYou.default_creator');
  const storyName = navigationParams?.storyName || t('thankYou.default_story');

  const handleDownloadApp = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/reflectly',
      android: 'https://play.google.com/store/apps/details?id=com.reflectly',
      default: 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev/',
    });
    
    Linking.openURL(storeUrl).catch(() => {
      console.log('Could not open store URL');
    });
  };

  const handleClose = () => {
    go('Home');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={60} color={theme.colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>{t('thankYou.title')}</Text>

          <Text style={styles.subtitle}>
            {t('thankYou.subtitle')}
          </Text>

          <View style={styles.messageCard}>
            <Ionicons name="videocam" size={28} color={theme.colors.primary} />
            <Text style={styles.messageTitle}>
              {t('thankYou.message_title', { creatorName })}
            </Text>
            <Text style={styles.messageText}>
              {t('thankYou.message_text', { creatorName })}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.downloadSection}>
            <Text style={styles.downloadTitle}>
              {t('thankYou.download_title')}
            </Text>
            <Text style={styles.downloadText}>
              {t('thankYou.download_text')}
            </Text>

            <View style={styles.storeButtons}>
              <TouchableOpacity 
                style={styles.storeButton}
                onPress={handleDownloadApp}
              >
                <Ionicons name="logo-apple" size={24} color="white" />
                <View style={styles.storeButtonText}>
                  <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
                  <Text style={styles.storeName}>App Store</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.storeButton}
                onPress={handleDownloadApp}
              >
                <Ionicons name="logo-google-playstore" size={24} color="white" />
                <View style={styles.storeButtonText}>
                  <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
                  <Text style={styles.storeName}>Google Play</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <AppButton
              title={t('thankYou.button_close')}
              onPress={handleClose}
              variant="outline"
              size="lg"
              fullWidth
              style={styles.closeButton}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing[5],
    paddingTop: 80,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing[4],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: theme.radii.lg,
    padding: theme.spacing[5],
    marginTop: theme.spacing[6],
    width: '100%',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  messageTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[2],
    lineHeight: 24,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
    marginVertical: theme.spacing[6],
  },
  downloadSection: {
    width: '100%',
    alignItems: 'center',
  },
  downloadTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  downloadText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  storeButtons: {
    flexDirection: 'row',
    gap: theme.spacing[3],
    marginTop: theme.spacing[4],
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[2],
  },
  storeButtonText: {
    alignItems: 'flex-start',
  },
  storeLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  storeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  footer: {
    marginTop: 'auto',
    width: '100%',
    paddingTop: theme.spacing[4],
  },
  closeButton: {
    borderColor: 'white',
  },
});
