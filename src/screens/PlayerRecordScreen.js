import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { useAmbientPlayback } from '../hooks/useAmbientPlayback';
import storageService from '../services/storageService';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

const isWeb = Platform.OS === 'web';
const { width, height } = Dimensions.get('window');

let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  Haptics = {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success' },
  };
}

export const PlayerRecordScreen = () => {
  const { go, back } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  const playerStoryData = useAppState((state) => state.playerStoryData);
  const playerStoryId = useAppState((state) => state.playerStoryId);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');

  const clipTimes = [
    navigationParams?.video1Time || 60,
    navigationParams?.video2Time || 60,
    navigationParams?.video3Time || 60,
  ];

  const storyMusic = playerStoryData?.music || navigationParams?.music || null;
  const ambient = useAmbientPlayback(storyMusic);

  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const [clipRecordings, setClipRecordings] = useState([null, null, null]);
  const [activeClip, setActiveClip] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      ambient.stop();
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clipDurationRef = useRef(0);

  const startRecordingClip = async (clipIndex) => {
    if (isWeb) {
      setActiveClip(clipIndex);
      setIsRecording(true);
      setRecordingTimer(0);
      clipDurationRef.current = 0;
      ambient.playPhase(clipIndex + 1);
      recordingTimerRef.current = setInterval(() => {
        clipDurationRef.current += 1;
        setRecordingTimer(clipDurationRef.current);
        if (clipDurationRef.current >= clipTimes[clipIndex]) {
          stopRecordingClip(clipIndex);
        }
      }, 1000);
      return;
    }

    if (!cameraRef.current || isRecording) return;

    try {
      setActiveClip(clipIndex);
      setIsRecording(true);
      setRecordingTimer(0);
      clipDurationRef.current = 0;

      ambient.playPhase(clipIndex + 1);

      recordingTimerRef.current = setInterval(() => {
        clipDurationRef.current += 1;
        setRecordingTimer(clipDurationRef.current);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: clipTimes[clipIndex],
        codec: 'avc1',
      });

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      ambient.fadeOut(1500);

      if (video && video.uri) {
        console.log(`✅ Clip ${clipIndex + 1} recorded: ${video.uri} (${clipDurationRef.current}s)`);
        setClipRecordings(prev => {
          const updated = [...prev];
          updated[clipIndex] = { uri: video.uri, duration: clipDurationRef.current };
          return updated;
        });
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      }

      setIsRecording(false);
      setActiveClip(null);
    } catch (error) {
      console.error('Recording error:', error);
      setIsRecording(false);
      setActiveClip(null);
      Alert.alert('שגיאה', 'ההקלטה נכשלה, נסה שוב');
    }
  };

  const stopRecordingClip = async (clipIndex) => {
    if (isWeb) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      ambient.fadeOut(1500);
      setClipRecordings(prev => {
        const updated = [...prev];
        updated[clipIndex] = { uri: 'web-demo', duration: clipDurationRef.current };
        return updated;
      });
      setIsRecording(false);
      setActiveClip(null);
      return;
    }

    if (cameraRef.current) {
      try {
        await cameraRef.current.stopRecording();
      } catch (e) {}
    }
  };

  const toggleCameraType = async () => {
    try { await Haptics.selectionAsync(); } catch (e) {}
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleSubmit = async () => {
    ambient.stop();
    const recorded = clipRecordings.filter(r => r !== null);

    if (recorded.length === 0) {
      Alert.alert('אופס!', 'צריך להקליט לפחות שיקוף אחד');
      return;
    }

    if (!playerStoryId) {
      go('ThankYou', {
        recordedCount: recorded.length,
        creatorName: playerStoryData?.creatorName || navigationParams?.creatorName,
        storyName: playerStoryData?.name || navigationParams?.storyName,
      });
      return;
    }

    setIsUploading(true);
    const participantId = `participant_${Date.now()}`;
    let uploadedCount = 0;

    try {
      for (let i = 0; i < clipRecordings.length; i++) {
        const clip = clipRecordings[i];
        if (!clip || clip.uri === 'web-demo') continue;

        setUploadProgress(`מעלה שיקוף ${i + 1}...`);
        const result = await storageService.uploadPlayerVideo(
          clip.uri,
          playerStoryId,
          participantId,
          i + 1,
          (progress) => {
            setUploadProgress(`מעלה שיקוף ${i + 1}... ${Math.round(progress)}%`);
          }
        );

        if (result.success) {
          uploadedCount++;
        } else {
          console.error(`Upload failed for clip ${i + 1}:`, result.error);
        }
      }

      setIsUploading(false);
      go('ThankYou', {
        recordedCount: uploadedCount,
        creatorName: playerStoryData?.creatorName || navigationParams?.creatorName,
        storyName: playerStoryData?.name || navigationParams?.storyName,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      Alert.alert('שגיאה בהעלאה', 'חלק מהסרטונים לא הועלו. נסה שוב.');
    }
  };

  const recordedCount = clipRecordings.filter(r => r !== null).length;

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.permissionText}>בודק הרשאות מצלמה...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera" size={64} color={theme.colors.primary} />
        <Text style={styles.permissionText}>אנו זקוקים להרשאת מצלמה כדי להקליט</Text>
        <AppButton
          title="הענק הרשאה"
          onPress={requestPermission}
          variant="primary"
          size="lg"
        />
      </View>
    );
  }

  if (isUploading) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.permissionText}>{uploadProgress}</Text>
      </View>
    );
  }

  if (activeClip !== null) {
    const maxTime = clipTimes[activeClip];
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          mode="video"
        >
          <View style={styles.cameraHeader}>
            <View style={styles.clipBadge}>
              <Text style={styles.clipBadgeText}>שיקוף {activeClip + 1} מתוך 3</Text>
            </View>

            <TouchableOpacity style={styles.cameraHeaderButton} onPress={toggleCameraType}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
              <Text style={styles.timerText}>{formatTime(recordingTimer)}</Text>
            </View>
          )}

          {isRecording && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${(recordingTimer / maxTime) * 100}%` },
                ]}
              />
            </View>
          )}

          {ambient.hasTrack && ambient.isPlaying && (
            <View style={styles.musicBadge}>
              <Ionicons name="musical-notes" size={14} color="white" />
              <Text style={styles.musicBadgeText}>מוזיקת רקע</Text>
            </View>
          )}

          <View style={styles.cameraControls}>
            <Text style={styles.maxTimeHint}>
              {isRecording
                ? `${formatTime(recordingTimer)} / ${formatTime(maxTime)}`
                : `עד ${formatTime(maxTime)}`}
            </Text>
            <TouchableOpacity
              style={[
                styles.recordBtn,
                isRecording && styles.recordBtnActive,
              ]}
              onPress={() => {
                if (isRecording) {
                  stopRecordingClip(activeClip);
                } else {
                  startRecordingClip(activeClip);
                }
              }}
            >
              <View
                style={[
                  styles.recordBtnInner,
                  isRecording && styles.recordBtnInnerActive,
                ]}
              />
            </TouchableOpacity>
            <Text style={styles.recordHint}>
              {isRecording ? 'לחץ לעצירה' : 'לחץ להקלטה'}
            </Text>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>הקלט שיקופים</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {ambient.hasTrack && (
          <View style={styles.musicIndicator}>
            <Ionicons name="musical-note" size={16} color={theme.colors.accent} />
            <Text style={styles.musicIndicatorText}>מוזיקת רקע תנוגן בזמן ההקלטה</Text>
          </View>
        )}

        <View style={styles.clipCards}>
          {[0, 1, 2].map((i) => {
            const clip = clipRecordings[i];
            const isRecorded = clip !== null;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.clipCard,
                  isRecorded && styles.clipCardRecorded,
                ]}
                onPress={() => {
                  setActiveClip(i);
                }}
              >
                <View style={[
                  styles.clipIcon,
                  isRecorded && styles.clipIconRecorded,
                ]}>
                  {isRecorded ? (
                    <Ionicons name="checkmark" size={28} color="white" />
                  ) : (
                    <Ionicons name="videocam" size={28} color={theme.colors.primary} />
                  )}
                </View>

                <View style={styles.clipInfo}>
                  <Text style={[
                    styles.clipLabel,
                    isRecorded && styles.clipLabelRecorded,
                  ]}>
                    שיקוף {i + 1}
                  </Text>
                  <Text style={styles.clipDuration}>
                    {isRecorded
                      ? `הוקלט (${clip.duration}s)`
                      : `עד ${clipTimes[i]} שניות`}
                  </Text>
                </View>

                <View style={styles.clipAction}>
                  {isRecorded ? (
                    <Text style={styles.reRecordText}>הקלט מחדש</Text>
                  ) : (
                    <Ionicons name="arrow-forward" size={24} color={theme.colors.primary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            הקלטת {recordedCount} מתוך 3 שיקופים
          </Text>
          <View style={styles.statusDots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.statusDot,
                  clipRecordings[i] !== null && styles.statusDotFilled,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title={recordedCount === 3 ? '🎉 שלח את כל השיקופים' : 'שלח שיקופים'}
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            fullWidth
            disabled={recordedCount === 0}
          />
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  permissionText: {
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[8],
  },
  musicIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[4],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    backgroundColor: `${theme.colors.accent}15`,
    borderRadius: theme.radii.pill,
    gap: theme.spacing[2],
    alignSelf: 'center',
  },
  musicIndicatorText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  clipCards: {
    gap: theme.spacing[3],
  },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    ...theme.shadows.sm,
  },
  clipCardRecorded: {
    backgroundColor: '#E8F5E9',
  },
  clipIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipIconRecorded: {
    backgroundColor: '#4CAF50',
  },
  clipInfo: {
    flex: 1,
    marginLeft: theme.spacing[3],
  },
  clipLabel: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  clipLabelRecorded: {
    color: '#2E7D32',
  },
  clipDuration: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  clipAction: {
    marginLeft: theme.spacing[2],
  },
  reRecordText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  status: {
    alignItems: 'center',
    marginTop: theme.spacing[6],
  },
  statusText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  statusDots: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  statusDotFilled: {
    backgroundColor: '#4CAF50',
  },
  actions: {
    marginTop: theme.spacing[6],
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: 50,
  },
  clipBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
  },
  clipBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    left: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.8)',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
    gap: theme.spacing[2],
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timerText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  progressContainer: {
    position: 'absolute',
    top: 130,
    left: theme.spacing[4],
    right: theme.spacing[4],
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ff4444',
    borderRadius: 2,
  },
  musicBadge: {
    position: 'absolute',
    top: 140,
    right: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(70,155,176,0.7)',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    gap: 4,
  },
  musicBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  maxTimeHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: theme.spacing[2],
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnActive: {
    backgroundColor: 'rgba(255,0,0,0.8)',
  },
  recordBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff4444',
  },
  recordBtnInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  recordHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: theme.spacing[2],
  },
});
