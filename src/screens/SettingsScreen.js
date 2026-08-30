import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, I18nManager, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';
import { authService } from '../services/authService';
import { Card } from '../ui/Card';
import theme from '../theme/theme';

const ADMIN_URL = 'https://reflectlymobilex.onrender.com/admin';

export const SettingsScreen = () => {
  const { go, back } = useNav();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'he';
  const [deleting, setDeleting] = useState(false);
  const user = useAppState((state) => state.user);

  const handleDeleteAccount = () => {
    Alert.alert(
      'מחיקת חשבון',
      'פעולה זו תמחק לצמיתות את חשבונך, את כל הסיפורים שיצרת ואת הסרטונים המשויכים אליהם.\n\nמשתתפים שצילמו בסיפורים שלך יאבדו גישה לאותם סיפורים.\n\nלא ניתן לבטל פעולה זו.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק חשבון לצמיתות',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await authService.deleteAccount();
            setDeleting(false);
            if (!result.success) {
              Alert.alert('שגיאה', result.error || 'לא ניתן למחוק את החשבון. נסה שוב.');
            }
            // On success: onAuthStateChanged fires with null → app navigates to login automatically
          },
        },
      ]
    );
  };

  const handleLanguageChange = (lang) => {
    if (lang === currentLang) return;
    Alert.alert(
      t('settings.language_restart_title'),
      t('settings.language_restart_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.language_restart_ok'), onPress: () => changeLanguage(lang) },
      ]
    );
  };

  const LANGUAGES = [
    { code: 'he', label: 'עברית 🇮🇱' },
    { code: 'en', label: 'English 🇺🇸' },
    { code: 'fr', label: 'Français 🇫🇷' },
    { code: 'es', label: 'Español 🇪🇸' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.title')} onBack={back} />

      <ScrollView style={styles.content}>

        {/* Language picker */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.section_language')}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => {
              const active = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langButton, active && styles.langButtonActive]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={[styles.langButtonText, active && styles.langButtonTextActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* App settings */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.section_app')}</Text>

          {/* Camera — wired to CameraSettingsScreen */}
          <TouchableOpacity style={styles.settingItem} onPress={() => go('CameraSettings')}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
              <Ionicons name="camera" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.option_camera')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.option_camera_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
          </TouchableOpacity>

          {/* Audio — stub */}
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
              <Ionicons name="mic" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.option_audio')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.option_audio_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
          </TouchableOpacity>

          {/* Storage — stub */}
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.secondary}15` }]}>
              <Ionicons name="folder" size={20} color={theme.colors.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.option_storage')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.option_storage_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
          </TouchableOpacity>

          {/* Privacy — stub */}
          <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.accent}15` }]}>
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.option_privacy')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.option_privacy_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.subtext} />
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.section_about')}</Text>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
        </Card>

        {/* Admin panel link */}
        <TouchableOpacity style={styles.adminBtn} onPress={() => Linking.openURL(ADMIN_URL)}>
          <Ionicons name="construct-outline" size={18} color="rgba(200,155,70,0.85)" />
          <Text style={styles.adminBtnText}>ניהול</Text>
          <Ionicons name="open-outline" size={14} color="rgba(200,155,70,0.40)" />
        </TouchableOpacity>

        {/* Danger Zone */}
        <Card style={[styles.section, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>מחיקת חשבון</Text>
          <Text style={styles.dangerDesc}>
            מחיקה תמחק את חשבונך, כל הסיפורים שיצרת וכל הקבצים המשויכים אליהם לצמיתות.
          </Text>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.deleteButtonText}>מחק חשבון</Text>
              </>
            )}
          </TouchableOpacity>
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
    marginBottom: theme.spacing[4],
    fontSize: 18,
  },
  langRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  langButton: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  langButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  langButtonText: {
    fontSize: 15,
    color: theme.colors.subtext,
    fontWeight: '500',
  },
  langButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[3],
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  settingSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: theme.spacing[1],
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
  },
  aboutLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  aboutValue: {
    ...theme.typography.body,
    color: theme.colors.subtext,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(38,40,50,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.25)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  adminBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(200,155,70,0.85)',
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  dangerTitle: {
    ...theme.typography.h3,
    color: '#dc2626',
    marginBottom: theme.spacing[2],
    fontSize: 18,
  },
  dangerDesc: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginBottom: theme.spacing[4],
    lineHeight: 18,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
  },
  deleteButtonDisabled: {
    backgroundColor: '#f87171',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});
