import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>

      {/* Icon */}
      <View style={styles.iconCircle}>
        <Ionicons name="heart" size={28} color={TEAL} />
      </View>

      <Text style={styles.title}>{t('thankYou.title')}</Text>
      <Text style={styles.subtitle}>{t('thankYou.subtitle')}</Text>

      {/* Message card */}
      <View style={styles.card}>
        <Ionicons name="videocam" size={18} color={TEAL} />
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
        <View style={styles.storeButtons}>
          <TouchableOpacity style={styles.storeButton} onPress={handleDownloadApp}>
            <Ionicons name="logo-apple" size={18} color="white" />
            <View>
              <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
              <Text style={styles.storeName}>App Store</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.storeButton} onPress={handleDownloadApp}>
            <Ionicons name="logo-google-playstore" size={18} color="white" />
            <View>
              <Text style={styles.storeLabel}>{t('thankYou.download_label')}</Text>
              <Text style={styles.storeName}>Google Play</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => go('Home')}>
        <Text style={styles.closeBtnText}>{t('thankYou.button_close')}</Text>
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(90,180,204,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90,180,204,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: GOLD2,
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.15)',
    marginBottom: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 12,
    color: GOLD2,
    textAlign: 'center',
    lineHeight: 18,
  },
  downloadSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    marginBottom: 10,
  },
  storeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.20)',
  },
  storeLabel: {
    fontSize: 9,
    color: GOLD2,
  },
  storeName: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: 'center',
  },
  closeBtnText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: '700',
  },
});
