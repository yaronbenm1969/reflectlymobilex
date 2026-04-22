import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import theme from '../theme/theme';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Haptics fallback
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (error) {
  console.warn('Expo Haptics not available, using fallback');
  Haptics = {
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    NotificationFeedbackType: { Success: 'success' },
  };
}

const { width, height } = Dimensions.get('window');
const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

export const RecordScreen = () => {
  const { t } = useTranslation();
  const { go, back } = useNav();
  const setLastRecording = useAppState((state) => state.setLastRecording);
  const isCountdownEnabled = useAppState((state) => state.isCountdownEnabled);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState('front');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  
  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    if (!micPermission) {
      requestMicPermission();
    }
  }, [permission, micPermission]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCountdown = async () => {
    if (!isCountdownEnabled) {
      startActualRecording();
      return;
    }

    setIsCountingDown(true);
    setCountdown(3);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          setIsCountingDown(false);
          startActualRecording();
          return 0;
        }
        try {
          Haptics.selectionAsync();
        } catch (e) {}
        return prev - 1;
      });
    }, 1000);
  };

  const startActualRecording = async () => {
    // Web simulation mode - skip actual recording
    if (isWeb) {
      console.log('🌐 Web mode - simulating recording...');
      setIsRecording(true);
      setRecordingTimer(0);
      
      let timerValue = 0;
      recordingTimerRef.current = setInterval(() => {
        timerValue += 1;
        setRecordingTimer(timerValue);
      }, 1000);
      return;
    }
    
    if (!cameraRef.current || isRecording) return;

    try {
      console.log('🔴 Starting recording...');
      setIsRecording(true);
      setRecordingTimer(0);
      
      // Start recording timer
      let timerValue = 0;
      recordingTimerRef.current = setInterval(() => {
        timerValue += 1;
        setRecordingTimer(timerValue);
        
        // Auto-stop at max time
        if (timerValue >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 1000);
      
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_TIME,
        codec: 'avc1', // H.264 codec for web browser compatibility
      });
      
      if (video && video.uri) {
        console.log('✅ Recording completed:', video.uri);
        setRecordedVideo(video.uri);
        setLastRecording(video.uri);
        
        // Navigate to review screen
        go('Review', { videoUri: video.uri });
      }
    } catch (error) {
      console.error('❌ Recording error:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Web simulation mode - navigate with demo video
    if (isWeb) {
      console.log('🌐 Web mode - stopping simulated recording...');
      setIsRecording(false);
      const demoUri = 'web-demo-video';
      setRecordedVideo(demoUri);
      setLastRecording(demoUri);
      go('Review', { videoUri: demoUri });
      return;
    }
    
    if (!cameraRef.current) return;

    try {
      console.log('⏹️ Stopping recording...');
      
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
    } catch (error) {
      console.error('❌ Stop recording error:', error);
    }
  };

  const toggleCameraType = async () => {
    try {
      await Haptics.selectionAsync();
    } catch (e) {}
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!permission || !micPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>{t('record.permission_camera_mic')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => { requestPermission(); requestMicPermission(); }}>
          <Text style={styles.permissionButtonText}>{t('common.grant_permission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted || !micPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>{t('record.permission_required_text')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => { requestPermission(); requestMicPermission(); }}>
          <Text style={styles.permissionButtonText}>{t('common.grant_permission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={facing}
        ref={cameraRef}
        mode="video"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={back}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Record Story</Text>
            {isRecording && (
              <Text style={styles.timer}>{formatTime(recordingTimer)}</Text>
            )}
          </View>

          <TouchableOpacity 
            style={styles.headerButton}
            onPress={toggleCameraType}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Countdown overlay */}
        {isCountingDown && countdown > 0 && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}

        {/* Progress bar */}
        {isRecording && (
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar,
                { width: `${(recordingTimer / MAX_RECORDING_TIME) * 100}%` }
              ]} 
            />
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive
            ]}
            onPress={isRecording ? stopRecording : startCountdown}
            disabled={isCountingDown}
          >
            <View style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonInnerActive
            ]} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: theme.spacing[4],
  },
  permissionText: {
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.lg,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  timer: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: 'white',
    fontSize: 120,
    fontWeight: 'bold',
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
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: theme.spacing[2],
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(255,0,0,0.8)',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff4444',
  },
  recordButtonInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
});