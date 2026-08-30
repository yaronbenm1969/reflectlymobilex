import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage, db } from '../services/firebase';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNav } from '../hooks/useNav';

const CONFIG_DOC = doc(db, 'config', 'app');

export const AdminScreen = () => {
  const { back } = useNav();
  const [currentUrl, setCurrentUrl]         = useState('');
  const [loadingUrl, setLoadingUrl]         = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 or null
  const [success, setSuccess]               = useState(false);

  // ── Load current tutorial video URL from Firestore ──────────
  useEffect(() => {
    getDoc(CONFIG_DOC)
      .then((snap) => {
        setCurrentUrl(snap.data()?.tutorialVideoUrl || '');
      })
      .catch(() => {})
      .finally(() => setLoadingUrl(false));
  }, []);

  // ── Pick video from gallery and upload ──────────────────────
  const handlePickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לגלריה בהגדרות הטלפון.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setSuccess(false);
    setUploadProgress(0);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, 'assets/tutorial.mp4');
      const task = uploadBytesResumable(storageRef, blob);

      task.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(pct);
        },
        (err) => {
          setUploadProgress(null);
          Alert.alert('שגיאה בהעלאה', err.message);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await setDoc(CONFIG_DOC, { tutorialVideoUrl: url }, { merge: true });
          setCurrentUrl(url);
          setUploadProgress(null);
          setSuccess(true);
        }
      );
    } catch (e) {
      setUploadProgress(null);
      Alert.alert('שגיאה', 'לא ניתן להעלות את הסרטון. נסה שוב.');
    }
  };

  const isUploading = uploadProgress !== null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="ניהול" onBack={back} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Tutorial video section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="play-circle-outline" size={22} color="rgba(200,155,70,0.85)" />
            <Text style={styles.cardTitle}>סרטון הדרכה</Text>
          </View>

          <View style={styles.divider} />

          {/* Current URL status */}
          <View style={styles.urlRow}>
            <Ionicons
              name={currentUrl ? 'checkmark-circle' : 'alert-circle-outline'}
              size={16}
              color={currentUrl ? '#5ab4cc' : 'rgba(200,155,70,0.55)'}
            />
            <Text style={styles.urlText} numberOfLines={2}>
              {loadingUrl
                ? 'טוען...'
                : currentUrl
                  ? currentUrl.replace(/\?.*/, '').split('/').pop()
                  : 'לא הוגדר עדיין'}
            </Text>
          </View>

          {/* Progress bar */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          )}

          {/* Success message */}
          {success && !isUploading && (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={16} color="#5ab4cc" />
              <Text style={styles.successText}>הסרטון עודכן בהצלחה</Text>
            </View>
          )}

          {/* Upload button */}
          <TouchableOpacity
            style={[styles.uploadBtn, isUploading && styles.uploadBtnDisabled]}
            onPress={handlePickAndUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="rgba(20,20,30,1)" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color="rgba(20,20,30,1)" />
            )}
            <Text style={styles.uploadBtnText}>
              {isUploading ? 'מעלה...' : 'בחר סרטון מהגלריה'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            הסרטון יועלה ל-Firebase Storage ויופיע אוטומטית למשתמשים חדשים בדף הבית.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0e14',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: 'rgba(38,40,50,0.97)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,155,70,0.18)',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(200,155,70,0.85)',
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(200,155,70,0.12)',
    marginBottom: 16,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5ab4cc',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: '#5ab4cc',
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  successText: {
    fontSize: 13,
    color: '#5ab4cc',
    fontWeight: '600',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,155,70,0.90)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  uploadBtnDisabled: {
    opacity: 0.55,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(20,20,30,1)',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.30)',
    lineHeight: 17,
    textAlign: 'right',
  },
});
