import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { Card } from '../ui/Card';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const PlayerRecordScreen = () => {
  const { go, back } = useNav();
  const navigationParams = useAppState((state) => state.navigationParams);
  
  const video1Time = navigationParams?.video1Time || 30;
  const video2Time = navigationParams?.video2Time || 30;
  const video3Time = navigationParams?.video3Time || 30;

  const [recordings, setRecordings] = useState({
    video1: null,
    video2: null,
    video3: null,
  });
  const [activeRecording, setActiveRecording] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const handleStartRecording = (videoId, maxTime) => {
    setActiveRecording(videoId);
    setRecordingTime(0);
    
    const interval = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= maxTime) {
          clearInterval(interval);
          handleStopRecording(videoId);
          return maxTime;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleStopRecording = (videoId) => {
    setRecordings((prev) => ({
      ...prev,
      [videoId]: { recorded: true, duration: recordingTime },
    }));
    setActiveRecording(null);
    setRecordingTime(0);
  };

  const handleSubmit = () => {
    const recordedCount = Object.values(recordings).filter(r => r?.recorded).length;
    
    if (recordedCount === 0) {
      Alert.alert('אופס!', 'צריך להקליט לפחות סרטון אחד');
      return;
    }

    Alert.alert(
      'מעולה!',
      `הקלטת ${recordedCount} סרטונים. השיקופים שלך נשלחו בהצלחה!`,
      [{ text: 'סגור', onPress: () => go('Home') }]
    );
  };

  const renderRecordButton = (videoId, label, maxTime) => {
    const isRecorded = recordings[videoId]?.recorded;
    const isActive = activeRecording === videoId;
    const isDisabled = activeRecording && !isActive;

    return (
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecorded && styles.recordButtonCompleted,
          isActive && styles.recordButtonActive,
          isDisabled && styles.recordButtonDisabled,
        ]}
        onPress={() => {
          if (isActive) {
            handleStopRecording(videoId);
          } else if (!isDisabled) {
            handleStartRecording(videoId, maxTime);
          }
        }}
        disabled={isDisabled}
      >
        <View style={styles.recordButtonContent}>
          <View style={[
            styles.recordIcon,
            isActive && styles.recordIconActive,
            isRecorded && styles.recordIconCompleted,
          ]}>
            {isActive ? (
              <View style={styles.stopIcon} />
            ) : isRecorded ? (
              <Ionicons name="checkmark" size={24} color="white" />
            ) : (
              <View style={styles.recordDot} />
            )}
          </View>
          
          <View style={styles.recordInfo}>
            <Text style={[
              styles.recordLabel,
              isRecorded && styles.recordLabelCompleted,
            ]}>
              {label}
            </Text>
            <Text style={styles.recordDuration}>
              {isActive 
                ? `${recordingTime}s / ${maxTime}s` 
                : isRecorded 
                  ? `הוקלט (${recordings[videoId].duration}s)`
                  : `עד ${maxTime} שניות`}
            </Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${(recordingTime / maxTime) * 100}%` }
              ]} 
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const recordedCount = Object.values(recordings).filter(r => r?.recorded).length;

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

      <View style={styles.content}>
        <Card style={styles.instructionsCard}>
          <Ionicons name="videocam" size={32} color={theme.colors.primary} />
          <Text style={styles.instructionsTitle}>הקלט 3 סרטוני שיקוף</Text>
          <Text style={styles.instructionsText}>
            לחץ על כל כפתור כדי להתחיל הקלטה. לחץ שוב לסיום.
          </Text>
        </Card>

        <View style={styles.recordButtons}>
          {renderRecordButton('video1', 'שיקוף ראשון', video1Time)}
          {renderRecordButton('video2', 'שיקוף שני', video2Time)}
          {renderRecordButton('video3', 'שיקוף שלישי', video3Time)}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            הקלטת {recordedCount} מתוך 3 סרטונים
          </Text>
          <View style={styles.statusDots}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.statusDot,
                  recordings[`video${i}`]?.recorded && styles.statusDotFilled,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="שלח שיקופים"
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            fullWidth
            disabled={recordedCount === 0}
          />
        </View>
      </View>
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
    padding: theme.spacing[4],
  },
  instructionsCard: {
    padding: theme.spacing[4],
    alignItems: 'center',
    marginBottom: theme.spacing[4],
  },
  instructionsTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing[2],
  },
  instructionsText: {
    ...theme.typography.body,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing[2],
  },
  recordButtons: {
    gap: theme.spacing[3],
  },
  recordButton: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    ...theme.shadows.sm,
    overflow: 'hidden',
  },
  recordButtonCompleted: {
    backgroundColor: '#E8F5E9',
  },
  recordButtonActive: {
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  recordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  recordIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconActive: {
    backgroundColor: '#F44336',
  },
  recordIconCompleted: {
    backgroundColor: theme.colors.success,
  },
  recordDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  recordInfo: {
    flex: 1,
  },
  recordLabel: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  recordLabelCompleted: {
    color: theme.colors.success,
  },
  recordDuration: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#FFCDD2',
    marginTop: theme.spacing[3],
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F44336',
    borderRadius: 2,
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
    backgroundColor: theme.colors.success,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: theme.spacing[4],
  },
});
