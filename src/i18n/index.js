import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import he from './locales/he.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

const LANG_KEY = '@app_language';

// Supported languages
export const SUPPORTED_LANGUAGES = ['he', 'en', 'fr', 'es'];

/**
 * Initialize i18n. Called once before app renders.
 * Always resolves — if anything fails, falls back to Hebrew so the app still loads.
 */
export async function initI18n() {
  try {
    // 1. Read user's saved preference
    const saved = await AsyncStorage.getItem(LANG_KEY).catch(() => null);

    // 2. Detect device language as fallback
    let deviceLang = 'he';
    try {
      const locales = getLocales();
      const code = locales?.[0]?.languageCode || 'he';
      deviceLang = SUPPORTED_LANGUAGES.includes(code) ? code : 'he';
    } catch (_) {}

    const lang = saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : deviceLang;

    // 3. Apply RTL — Hebrew = RTL, all others = LTR
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(lang === 'he');

    // 4. Init i18next
    await i18next.use(initReactI18next).init({
      lng: lang,
      fallbackLng: 'he',
      resources: {
        he: { translation: he },
        en: { translation: en },
        fr: { translation: fr },
        es: { translation: es },
      },
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });

    console.log(`✅ i18n initialized: ${lang}`);
  } catch (error) {
    // Safety net — if i18n init fails, app still renders with Hebrew fallback
    console.warn('⚠️ i18n init failed, using Hebrew fallback:', error?.message);
    try {
      if (!i18next.isInitialized) {
        await i18next.use(initReactI18next).init({
          lng: 'he',
          fallbackLng: 'he',
          resources: { he: { translation: he }, en: { translation: en }, fr: { translation: fr }, es: { translation: es } },
          interpolation: { escapeValue: false },
          compatibilityJSON: 'v4',
        });
      }
    } catch (_) {}
  }
}

/**
 * Change language + persist + reload app.
 * Safe to call from any screen.
 */
export async function changeLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
    await i18next.changeLanguage(lang);
    I18nManager.forceRTL(lang === 'he');

    // Reload JS bundle so RTL takes effect
    try {
      const Updates = await import('expo-updates');
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
      }
    } catch (_) {
      // In dev mode expo-updates may not be available — silently skip
      console.log('ℹ️ expo-updates not available, RTL will apply after manual restart');
    }
  } catch (error) {
    console.error('❌ changeLanguage failed:', error?.message);
  }
}

export default i18next;
