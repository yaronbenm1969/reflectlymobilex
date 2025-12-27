import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

export const ProcessingScreen = () => {
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const videoFormat = useAppState((state) => state.videoFormat);
  
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('מכין את הסרטונים...');
  const [isComplete, setIsComplete] = useState(false);
  
  const spinValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    const stages = [
      { progress: 20, status: 'אוסף את כל הסרטונים...' },
      { progress: 40, status: 'מעבד את התוכן...' },
      { progress: 60, status: 'מוסיף מוזיקה...' },
      { progress: 80, status: 'מחיל אפקטים...' },
      { progress: 100, status: 'כמעט סיימנו!' },
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress);
        setStatus(stages[currentStage].status);
        currentStage++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        setStatus('הסרטון מוכן!');
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleViewResult = () => {
    go('EditRoom');
  };

  return (
    <LinearGradient
      colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.storyName}>{storyName}</Text>
        
        {!isComplete ? (
          <>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync" size={80} color="white" />
            </Animated.View>
            
            <Text style={styles.status}>{status}</Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${progress}%` }]} 
                />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>

            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Ionicons name="musical-notes" size={20} color="white" />
                <Text style={styles.infoText}>
                  מוזיקה: {selectedMusic || 'ללא'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="cube" size={20} color="white" />
                <Text style={styles.infoText}>
                  פורמט: {videoFormat || 'סטנדרטי'}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={100} color="white" />
            <Text style={styles.completeTitle}>הסרטון מוכן!</Text>
            <Text style={styles.completeDescription}>
              הסרטון שלך נערך בהצלחה ומחכה לך בחדר העריכה
            </Text>
            
            <AppButton
              title="צפה בתוצאה"
              onPress={handleViewResult}
              variant="secondary"
              size="lg"
              style={styles.viewButton}
            />
          </>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  storyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: theme.spacing[8],
    textAlign: 'center',
  },
  status: {
    fontSize: 18,
    color: 'white',
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[4],
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing[4],
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  progressText: {
    color: 'white',
    fontSize: 16,
    marginTop: theme.spacing[2],
  },
  infoContainer: {
    marginTop: theme.spacing[8],
    gap: theme.spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  infoText: {
    color: 'white',
    fontSize: 16,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: theme.spacing[4],
  },
  completeDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  viewButton: {
    marginTop: theme.spacing[6],
    minWidth: 200,
  },
});
