import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { storiesService } from '../services/storiesService';
import { AppButton } from '../ui/AppButton';
import theme from '../theme/theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.videoConverterUrl ||
  'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
const SERVER_HEADERS = {
  'Content-Type': 'application/json',
  ...(process.env.EXPO_PUBLIC_ACCESS_CODE ? { 'x-app-access-code': process.env.EXPO_PUBLIC_ACCESS_CODE } : {}),
};

export const ProcessingScreen = () => {
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  const videoFormat = useAppState((state) => state.videoFormat);
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const reflections = useAppState((state) => state.reflections);
  const clipRenderOrder = useAppState((state) => state.clipRenderOrder);
  const keyStoryUri = useAppState((state) => state.keyStoryUri);
  const generatedMusicUrl = useAppState((state) => state.generatedMusicUrl);
  const setGeneratedMusicUrl = useAppState((state) => state.setGeneratedMusicUrl);
  const generatedMusicUrlRef = useRef(null);
  useEffect(() => { generatedMusicUrlRef.current = generatedMusicUrl; }, [generatedMusicUrl]);
  const setFinalVideoUri = useAppState((state) => state.setFinalVideoUri);

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('מתחיל עיבוד...');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  
  const spinValue = useRef(new Animated.Value(0)).current;
  const pollingRef = useRef(null);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Load generatedMusicUrl from Firestore — retries up to 5× in case PlayerRecordScreen
  // hasn't finished writing yet when this screen mounts
  useEffect(() => {
    if (!currentStoryId || generatedMusicUrl) return;
    let cancelled = false;
    let attempts = 0;
    const tryLoad = async () => {
      if (cancelled || generatedMusicUrlRef.current) return;
      try {
        const res = await storiesService.getStory(currentStoryId);
        if (res.success && res.story?.generatedMusicUrl) {
          setGeneratedMusicUrl(res.story.generatedMusicUrl);
          console.log('🎵 Loaded generatedMusicUrl from Firestore');
          return;
        }
      } catch (e) {}
      if (attempts < 5) {
        attempts++;
        setTimeout(tryLoad, 2000);
      }
    };
    tryLoad();
    return () => { cancelled = true; };
  }, [currentStoryId]);

  useEffect(() => {
    startRendering();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const startRendering = async () => {
    try {
      setStatus('אוסף את הסרטונים...');
      setProgress(5);
      
      let requestBody;

      if (clipRenderOrder && clipRenderOrder.length > 0) {
        // Use the user's chosen order — send as videoUrls so server preserves order (no shuffle)
        const videoUrls = [];
        if (keyStoryUri) videoUrls.push(keyStoryUri);
        clipRenderOrder.forEach(clip => {
          if (clip.videoUrl) videoUrls.push(clip.videoUrl);
        });
        if (videoUrls.length === 0) { setError('אין סרטונים לעריכה'); return; }
        requestBody = { videoUrls, format: videoFormat || 'standard', ...(generatedMusicUrl && { musicUrl: generatedMusicUrl }) };
        console.log('Starting render with ordered', videoUrls.length, 'videos (user order preserved)');
      } else {
        // Fallback: send with participant data and let server shuffle
        const videos = [];
        if (keyStoryUri) {
          videos.push({ url: keyStoryUri, participantId: 'creator', type: 'key_story' });
        }
        reflections.forEach(reflection => {
          if (reflection.videoUrl) {
            videos.push({
              url: reflection.videoUrl,
              participantId: reflection.recipientId || reflection.playerName || 'unknown',
              clipNumber: reflection.clipNumber,
              type: 'reflection'
            });
          }
        });
        if (videos.length === 0) { setError('אין סרטונים לעריכה'); return; }
        requestBody = { videos, format: videoFormat || 'standard', ...(generatedMusicUrl && { musicUrl: generatedMusicUrl }) };
        console.log('Starting render with', videos.length, 'videos (server shuffle)');
      }

      setStatus('שולח לשרת העריכה...');
      setProgress(10);

      const response = await fetch(getApiUrl(`/api/stories/${currentStoryId}/render`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error('שגיאה בהתחלת העיבוד');
      }
      
      const result = await response.json();
      console.log('Render started:', result);
      
      if (result.jobId) {
        setJobId(result.jobId);
        startPolling(result.jobId);
      } else {
        throw new Error('לא התקבל מזהה עבודה');
      }
      
    } catch (err) {
      console.error('Rendering error:', err);
      setError(err.message);
    }
  };

  const startPolling = (id) => {
    setStatus('מעבד סרטונים...');
    
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(getApiUrl(`/api/render-status/${id}`));
        
        if (!response.ok) {
          throw new Error('שגיאה בבדיקת סטטוס');
        }
        
        const job = await response.json();
        console.log('Job status:', job);
        
        setProgress(job.progress || 0);
        
        if (job.progress < 30) {
          setStatus('מוריד סרטונים...');
        } else if (job.progress < 50) {
          setStatus('ממיר פורמטים...');
        } else if (job.progress < 80) {
          setStatus('מרכיב את הסרטון...');
        } else if (job.progress < 100) {
          setStatus('מעלה את התוצאה...');
        }
        
        if (job.status === 'completed') {
          clearInterval(pollingRef.current);
          setProgress(95);

          let finalUrl = job.finalUrl;

          // Mix AI-generated music into the rendered video
          const musicUrl = generatedMusicUrlRef.current;
          if (finalUrl && musicUrl) {
            try {
              setStatus('מוסיף מוזיקה מותאמת...');
              const mixRes = await fetch(getApiUrl('/api/mix-music-with-video'), {
                method: 'POST',
                headers: SERVER_HEADERS,
                body: JSON.stringify({
                  videoUrl: finalUrl,
                  musicUrl,
                  musicVolume: 0.12,
                  storyId: currentStoryId,
                }),
              });
              if (mixRes.ok) {
                const mixJson = await mixRes.json();
                if (mixJson.finalUrl || mixJson.url) {
                  finalUrl = mixJson.finalUrl || mixJson.url;
                  console.log('✅ Music mixed into video:', finalUrl);
                }
              }
            } catch (mixErr) {
              console.warn('Music mixing failed, using unmixed video:', mixErr.message);
            }
          }

          setProgress(100);
          setStatus('הסרטון מוכן!');
          setIsComplete(true);
          if (finalUrl) {
            setFinalVideoUri(finalUrl);
          }
        } else if (job.status === 'failed') {
          clearInterval(pollingRef.current);
          setError(job.error || 'העיבוד נכשל');
        }
        
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleViewResult = () => {
    go('FinalVideo');
  };

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setIsComplete(false);
    startRendering();
  };

  const handleGoBack = () => {
    go('EditRoom');
  };

  if (error) {
    return (
      <LinearGradient
        colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
        style={styles.container}
      >
        <View style={styles.content}>
          <Ionicons name="alert-circle" size={80} color="white" />
          <Text style={styles.errorTitle}>שגיאה בעיבוד</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          
          <View style={styles.errorActions}>
            <AppButton
              title="נסה שוב"
              onPress={handleRetry}
              variant="secondary"
              size="lg"
              style={styles.retryButton}
            />
            <AppButton
              title="חזור לעריכה"
              onPress={handleGoBack}
              variant="outline"
              size="md"
              style={styles.backButton}
            />
          </View>
        </View>
      </LinearGradient>
    );
  }

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
                <Ionicons name="videocam" size={20} color="white" />
                <Text style={styles.infoText}>
                  {reflections.length} שיקופים + סרטון מפתח
                </Text>
              </View>
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
              הסרטון שלך נערך בהצלחה ומוכן לצפייה
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
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: theme.spacing[4],
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  errorActions: {
    marginTop: theme.spacing[6],
    gap: theme.spacing[3],
  },
  retryButton: {
    minWidth: 200,
  },
  backButton: {
    minWidth: 200,
    borderColor: 'white',
  },
});
