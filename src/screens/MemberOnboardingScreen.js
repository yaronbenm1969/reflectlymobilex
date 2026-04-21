import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { usersService } from '../services/usersService';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const MemberOnboardingScreen = () => {
  const { go, back } = useNav();
  const user = useAppState((s) => s.user);
  const navigationParams = useAppState((s) => s.navigationParams);

  const [displayName, setDisplayName]         = useState('');
  const [bio, setBio]                         = useState('');
  const [actingExperience, setActingExperience] = useState('');
  const [demoReelUrl, setDemoReelUrl]         = useState('');
  const [photoUri, setPhotoUri]               = useState(null);   // local uri
  const [photoUrl, setPhotoUrl]               = useState(null);   // remote url

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);

  // Where to go after saving (default: back)
  const afterSave = navigationParams?.afterSave || null;

  // ── Load existing profile ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    usersService.getUserProfile(user.uid).then((res) => {
      if (res.success && res.profile) {
        const p = res.profile;
        setDisplayName(p.displayName || user.displayName || '');
        setBio(p.bio || '');
        setActingExperience(p.actingExperience || '');
        setDemoReelUrl(p.demoReelUrl || '');
        setPhotoUrl(p.photoUrl || null);
      } else {
        setDisplayName(user.displayName || '');
      }
      setLoading(false);
    });
  }, [user]);

  // ── Photo picker ────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה לגלריה בהגדרות');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
      const task = uploadBytesResumable(storageRef, blob);
      return new Promise((resolve, reject) => {
        task.on('state_changed', null,
          (err) => { setUploading(false); reject(err); },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            setUploading(false);
            resolve(url);
          }
        );
      });
    } catch (e) {
      setUploading(false);
      throw e;
    }
  };

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם תצוגה');
      return;
    }
    if (!bio.trim()) {
      Alert.alert('שגיאה', 'נא למלא קצת עלייך (bio)');
      return;
    }
    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      if (photoUri) {
        finalPhotoUrl = await uploadPhoto(photoUri);
      }
      await usersService.updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        actingExperience: actingExperience.trim(),
        demoReelUrl: demoReelUrl.trim(),
        photoUrl: finalPhotoUrl,
        profileComplete: true,
      });
      if (afterSave) {
        go(afterSave);
      } else {
        back();
      }
    } catch (e) {
      Alert.alert('שגיאה', 'שמירה נכשלה: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const avatarSource = photoUri
    ? { uri: photoUri }
    : photoUrl
    ? { uri: photoUrl }
    : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>הכרטיס שלי בקהילה</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrap}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#ccc" />
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>לחץ לשינוי תמונה</Text>
        </View>

        {/* Display name */}
        <Card style={styles.card}>
          <Text style={styles.label}>שם תצוגה *</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="השם שיופיע בפרופיל"
            placeholderTextColor="#bbb"
            textAlign="right"
          />
        </Card>

        {/* Bio */}
        <Card style={styles.card}>
          <Text style={styles.label}>קצת עלי — קורות חיים *</Text>
          <Text style={styles.hint}>מי אתה, מאיפה אתה, מה מעניין אותך</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="לדוגמה: שחקן תיאטרון מתל אביב, בוגר ביה״ס לאמנות, אוהב הפקות אינטימיות..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            textAlign="right"
          />
        </Card>

        {/* Acting experience */}
        <Card style={styles.card}>
          <Text style={styles.label}>ניסיון במשחק</Text>
          <Text style={styles.hint}>הצגות, קורסים, בתי ספר, סרטים, פרסומות וכו׳</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={actingExperience}
            onChangeText={setActingExperience}
            placeholder="לדוגמה: 3 שנות תיאטרון אמחה, קורס משחק אצל יוסי פולק, פרסומת לחטיף בייגלה 2022..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            textAlign="right"
          />
        </Card>

        {/* Demo reel */}
        <Card style={styles.card}>
          <Text style={styles.label}>פלייבק / שואורייל</Text>
          <Text style={styles.hint}>לינק לסרטון YouTube, Vimeo, Drive וכו׳</Text>
          <TextInput
            style={styles.input}
            value={demoReelUrl}
            onChangeText={setDemoReelUrl}
            placeholder="https://youtube.com/..."
            placeholderTextColor="#bbb"
            textAlign="left"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Card>

        {/* Save */}
        <View style={styles.saveWrap}>
          <AppButton
            title={saving || uploading ? 'שומר...' : 'שמור כרטיס'}
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            disabled={saving || uploading}
          />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4], paddingTop: 50, paddingBottom: theme.spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.typography.h3, color: theme.colors.text },

  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: theme.spacing[5] },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  avatarHint: { ...theme.typography.caption, color: theme.colors.subtext },

  card: { padding: theme.spacing[4], marginBottom: theme.spacing[3] },
  label: { ...theme.typography.h4, color: theme.colors.text, marginBottom: 4 },
  hint: { ...theme.typography.caption, color: theme.colors.subtext, marginBottom: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    padding: theme.spacing[3], fontSize: 15, color: theme.colors.text,
    backgroundColor: '#fafafa',
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  saveWrap: { marginTop: theme.spacing[4] },
});
