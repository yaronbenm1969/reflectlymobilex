import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';

const GOLD   = 'rgba(200,155,70,0.90)';
const GOLD2  = 'rgba(200,155,70,0.65)';
const TEAL   = '#5ab4cc';
const BG     = '#0d0e14';
const CARD   = 'rgba(38,40,50,0.95)';

export const ThankYouScreen = () => {
  const { t } = useTranslation();
  const { go } = useNav();
  const insets = useSafeAreaInsets();
  const navigationParams = useAppState((state) => state.navigationParams);

  const creatorName = navigationParams?.creatorName || t('thankYou.default_creator');

  const handleDownloadApp = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/reflectly',
      android: 'https://play.google.com/store/apps/details?id=com.reflectly',
      default: 'https://reflectlymobilex.onrender.com',
    });
    Linking.openURL(storeUrl).catch(() => {});
  };

  const handleClose = () => {
    go('Home');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="heart" size={40} color={TEAL} />
        </View>

        <Text style={styles.title}>{t('thankYou.title')}</Text>
        <Text style={styles.subtitle}>{t('thankYou.subtitle')}</Text>

        {/* Message card */}
        <View style={styles.card}>
          <Ionicons name="videocam" size={22} color={TEAL} />
          <Text style={styles.cardTitle}>
            {t('thankYou.message_title', { creatorName })}
          </Text>
          <Text style={styles.cardText}>
            {t('thankYou.message_text', { creatorName })}
          </Text>
        </View>

        {/* Download section */}
        <View style={styles.downloadSection}>
          <Text style={styles.downloadTitle}>{t('thankYou.download_title')}</Text>
          <Text style={styles.downloadText}>{t('thankYou.download_text')}</Text>

          <View style={styles.storeButtons}>
            <TouchableOpacity style={styles.storeButton} onPress={handleDownloadApp}>
              <Ionicons name="logo-apple" size={20} color="white" />
              <View>
                <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
                <Text style={styles.storeName}>App Store</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.storeButton} onPress={handleDownloadApp}>
              <Ionicons name="logo-google-playstore" size={20} color="white" />
              <View>
                <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
                <Text style={styles.storeName}>Google Play</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Close button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <AppButton
            title={t('thankYou.button_close')}
            onPress={handleClose}
            variant="outline"
            size="lg"
            fullWidth
            style={styles.closeButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(90,180,204,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: GOLD2,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 14,
    color: GOLD2,
    textAlign: 'center',
    lineHeight: 20,
  },
  downloadSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    marginBottom: 6,
  },
  downloadText: {
    fontSize: 13,
    color: GOLD2,
    textAlign: 'center',
    marginBottom: 14,
  },
  storeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38,40,50,0.95)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.20)',
  },
  storeLabel: {
    fontSize: 9,
    color: GOLD2,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  footer: {
    width: '100%',
    paddingTop: 8,
  },
  closeButton: {
    borderColor: TEAL,
  },
});
