import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { Video3DPlayer } from '../components/Video3DPlayer';
import CubeWebView from '../components/cube3d/CubeWebView';
import { useReflectionAssets } from '../hooks/useReflectionAssets';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VIDEO_CONVERTER_URL = 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const convertedUrlCache = new Map();

export const FinalVideoScreen = () => {
  const { go } = useNav();
  const storyName = useAppState((state) => state.storyName);
  const privacySettings = useAppState((state) => state.privacySettings);
  const resetStory = useAppState((state) => state.resetStory);
  const finalVideoUri = useAppState((state) => state.finalVideoUri);
  const reflections = useAppState((state) => state.reflections);
  const videoFormat = useAppState((state) => state.videoFormat);
  const keyStoryUri = useAppState((state) => state.keyStoryUri);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [activeFaceIndex, setActiveFaceIndex] = useState(-1);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState('');
  const [videoHasPlayed, setVideoHasPlayed] = useState(false);
  const [isCubeFullscreen, setIsCubeFullscreen] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const videoRef = useRef(null);
  const cubeRef = useRef(null);

  const needsConversion = (url) => {
    if (!url) return false;
    return url.includes('.webm') || url.includes('video%2Fwebm');
  };

  const convertVideoUrl = async (originalUrl) => {
    if (convertedUrlCache.has(originalUrl)) {
      console.log('📦 Using cached converted URL');
      return convertedUrlCache.get(originalUrl);
    }

    console.log('🔄 Converting video:', originalUrl.substring(0, 80) + '...');
    
    try {
      const response = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`Conversion failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.convertedUrl) {
        console.log('✅ Video converted successfully');
        convertedUrlCache.set(originalUrl, result.convertedUrl);
        return result.convertedUrl;
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('❌ Video conversion error:', error);
      return originalUrl;
    }
  };

  // Count unique participants by playerName/participantName
  const participantCount = useMemo(() => {
    const uniqueParticipants = new Set();
    reflections.forEach(r => {
      const name = r.playerName || r.participantName || r.recipientId || r.participantId;
      if (name) {
        uniqueParticipants.add(name);
      }
    });
    // If we have clips but no unique names, count by groups of 3 (each participant records 3 clips)
    if (uniqueParticipants.size === 0 && reflections.length > 0) {
      return Math.ceil(reflections.length / 3);
    }
    return uniqueParticipants.size || 1;
  }, [reflections]);

  const is3DFormat = videoFormat && videoFormat !== 'standard';
  const isCube3D = videoFormat === 'cube-3d';

  // Load all reflections (not limited to 6) for proper progress display
  const { 
    status: assetStatus, 
    progress: assetProgress, 
    preparedFaces, 
    isReady: assetsReady,
    reset: resetAssets,
    prepareAllAssets 
  } = useReflectionAssets(isCube3D ? reflections : [], reflections.length || 9);

  const cubeFaces = preparedFaces;

  const prepareVideosFor3D = () => {
    const videos = [];
    
    if (keyStoryUri && videoFormat !== 'cube-3d') {
      videos.push({
        url: keyStoryUri,
        videoUrl: keyStoryUri,
        playerName: 'הסיפור שלי',
        participantId: 'creator',
        thumbnail: null,
      });
    }
    
    reflections.forEach((reflection, index) => {
      if (reflection.videoUrl) {
        videos.push({
          url: reflection.videoUrl,
          videoUrl: reflection.videoUrl,
          playerName: reflection.playerName || reflection.participantName || `משתתף ${index + 1}`,
          participantId: reflection.recipientId || reflection.participantId,
          clipNumber: reflection.clipNumber,
        });
      }
    });
    
    return videos;
  };

  useEffect(() => {
    if (isCube3D && assetsReady) {
      console.log(`🎲 Cube faces ready: ${cubeFaces.filter(f => f !== null).length} faces with pre-converted videos`);
      cubeFaces.forEach((face, i) => {
        if (face) {
          console.log(`  Face ${i}: ${face.playerName}, hasVideo=${!!face.videoUrl}, status=${face.status}`);
        }
      });
    }
  }, [isCube3D, assetsReady, cubeFaces]);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentPlayingFaceIndex, setCurrentPlayingFaceIndex] = useState(-1);
  const [currentVideoDuration, setCurrentVideoDuration] = useState(5000);
  const [cubeStarted, setCubeStarted] = useState(false);

  const [videoUrls, setVideoUrls] = useState([]);
  const [convertedUrls, setConvertedUrls] = useState([]);

  const handleFaceChange = (faceIndex) => {
    if (cubeStarted) {
      setCurrentPlayingFaceIndex(faceIndex);
    }
  };

  const handleVideoEnd = (faceId) => {
    console.log(`🎲 Video ended on face ${faceId}`);
  };

  const startCubePlayback = () => {
    if (!assetsReady) {
      console.log('⏳ Assets not ready yet, waiting...');
      return;
    }
    console.log(`▶️ Starting cube rotation with ${cubeFaces.filter(f => f).length} pre-loaded videos`);
    setCubeStarted(true);
    setPlaybackComplete(false);
  };

  const legacyStartCubePlayback = async () => {
    const validFaces = cubeFaces.filter(f => f && f.videoUrl);
    if (validFaces.length > 0) {
      const shuffledFaces = shuffleArray(validFaces);
      const originalUrls = shuffledFaces.map(f => f.videoUrl);
      console.log(`▶️ Starting cube playback with ${originalUrls.length} videos (shuffled)`);
      
      const firstUrl = originalUrls[0];
      if (needsConversion(firstUrl)) {
        setIsConverting(true);
        setConversionProgress('ממיר סרטון 1...');
        
        try {
          const convertedUrl = await convertVideoUrl(firstUrl);
          const allConvertedUrls = [convertedUrl];
          
          for (let i = 1; i < originalUrls.length; i++) {
            setConversionProgress(`ממיר סרטון ${i + 1}/${originalUrls.length}...`);
            if (needsConversion(originalUrls[i])) {
              const converted = await convertVideoUrl(originalUrls[i]);
              allConvertedUrls.push(converted);
            } else {
              allConvertedUrls.push(originalUrls[i]);
            }
          }
          
          setConvertedUrls(allConvertedUrls);
          setVideoUrls(allConvertedUrls);
          setCurrentVideoIndex(0);
          setActiveVideoUrl(allConvertedUrls[0]);
          setShowVideoPlayer(true);
          setIsPlaying(true);
          console.log(`✅ All videos converted, starting playback`);
        } catch (error) {
          console.error('❌ Conversion failed:', error);
          Alert.alert('שגיאה', 'לא ניתן להמיר את הסרטונים');
        } finally {
          setIsConverting(false);
          setConversionProgress('');
        }
      } else {
        setVideoUrls(originalUrls);
        setCurrentVideoIndex(0);
        setActiveVideoUrl(originalUrls[0]);
        setShowVideoPlayer(true);
        setIsPlaying(true);
      }
    }
  };

  const playNextVideo = () => {
    const nextIndex = currentVideoIndex + 1;
    setVideoHasPlayed(false); // Reset for next video
    if (nextIndex < videoUrls.length) {
      setCurrentVideoIndex(nextIndex);
      setActiveVideoUrl(videoUrls[nextIndex]);
      console.log(`⏭️ Playing video ${nextIndex + 1}/${videoUrls.length}`);
    } else {
      setShowVideoPlayer(false);
      setActiveVideoUrl(null);
      setIsPlaying(false);
      setCurrentVideoIndex(0);
      console.log(`✅ Cube playback complete`);
    }
  };

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleShare = async () => {
    try {
      if (finalVideoUri && await Sharing.isAvailableAsync()) {
        const localUri = FileSystem.cacheDirectory + 'shared_video.mp4';
        
        const downloadResult = await FileSystem.downloadAsync(finalVideoUri, localUri);
        
        if (downloadResult.status === 200) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'video/mp4',
            dialogTitle: `שתף את הסרטון: ${storyName}`,
          });
        } else {
          throw new Error('Failed to download for sharing');
        }
      } else {
        await Share.share({
          message: `צפה בסרטון שלי: "${storyName}" 🎬`,
          title: storyName,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הסרטון');
    }
  };

  const handleDownload = async () => {
    if (!finalVideoUri) {
      Alert.alert('שגיאה', 'אין סרטון להורדה');
      return;
    }
    
    try {
      setIsDownloading(true);
      
      const filename = `${storyName.replace(/[^a-zA-Zא-ת0-9]/g, '_')}_${Date.now()}.mp4`;
      const localUri = FileSystem.documentDirectory + filename;
      
      const downloadResult = await FileSystem.downloadAsync(finalVideoUri, localUri);
      
      if (downloadResult.status === 200) {
        Alert.alert(
          'הורדה הצליחה!',
          'הסרטון נשמר במכשיר שלך',
          [{ text: 'מעולה!' }]
        );
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('שגיאה', 'לא ניתן להוריד את הסרטון');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNewStory = () => {
    resetStory();
    go('Home');
  };

  const handlePlaybackComplete = () => {
    setPlaybackComplete(true);
  };

  const videos3D = is3DFormat ? prepareVideosFor3D() : [];

  return (
    <View style={[styles.container, isCubeFullscreen && styles.fullscreenMode]}>
      {/* End Screen Overlay */}
      {showEndScreen && (
        <View style={styles.endScreenOverlay}>
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            style={styles.endScreenGradient}
          >
            <Text style={styles.endScreenText}>סוף</Text>
            <Text style={styles.endScreenSubtext}>{storyName}</Text>
            <TouchableOpacity 
              style={styles.endScreenButton}
              onPress={() => {
                setShowEndScreen(false);
                setPlaybackComplete(true);
              }}
            >
              <Text style={styles.endScreenButtonText}>המשך</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {!isCubeFullscreen && !showEndScreen && (
        <>
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Text style={styles.title}>הסרטון מוכן! 🎉</Text>
              <Text style={styles.storyName}>{storyName}</Text>
              {is3DFormat && (
                <View style={styles.formatBadge}>
                  <Ionicons name="cube" size={16} color="white" />
                  <Text style={styles.formatText}>{videoFormat}</Text>
                </View>
              )}
            </View>
          </LinearGradient>

          <View style={styles.content}>
        <View style={styles.videoContainer}>
          {isCube3D && assetStatus === 'error' ? (
            /* Show error screen with retry option when downloads failed */
            <View style={styles.cubeContainer}>
              <View style={styles.loadingContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.error || '#EF4444'} />
                <Text style={styles.errorTitle}>שגיאה בהורדת סרטונים</Text>
                <Text style={styles.cubePlayText}>{assetProgress.message}</Text>
                <Text style={styles.cubeProgressText}>
                  {assetProgress.converted} מתוך {assetProgress.total} הורדו בהצלחה
                </Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    resetAssets();
                    setTimeout(() => prepareAllAssets(), 100);
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="white" />
                  <Text style={styles.retryButtonText}>נסה שוב</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isCube3D && (assetStatus === 'loading' || assetStatus === 'converting' || (assetStatus === 'idle' && reflections.length > 0)) && !assetsReady ? (
            /* Show loading screen while downloading ALL videos */
            <View style={styles.cubeContainer}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingTitle}>מכין את הקוביה...</Text>
                <Text style={styles.cubePlayText}>{assetProgress.message}</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${assetProgress.total > 0 ? (assetProgress.converted / assetProgress.total) * 100 : 0}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.cubeProgressText}>
                  {assetProgress.converted} מתוך {assetProgress.total} סרטונים
                </Text>
              </View>
            </View>
          ) : isCube3D && assetsReady ? (
            /* Show cube only after ALL videos are cached locally */
            <View style={[styles.cubeContainer, isCubeFullscreen && styles.cubeFullscreenContainer]}>
              <CubeWebView
                faces={cubeFaces}
                autoRotate={cubeStarted}
                rotationSpeed={currentVideoDuration > 0 ? currentVideoDuration * 1000 * 4 : 20000}
                isFullscreen={isCubeFullscreen}
                onFaceChange={handleFaceChange}
                onVideoStart={(faceIndex) => setCurrentPlayingFaceIndex(faceIndex)}
                onVideoEnd={handleVideoEnd}
                onPlaybackStart={() => {
                  console.log('🚀 Cube fullscreen mode ON');
                  setIsCubeFullscreen(true);
                  setCubeStarted(true);
                }}
                onPlaybackComplete={() => {
                  console.log('✅ All videos finished - showing end screen');
                  setIsCubeFullscreen(false);
                  setVideoHasPlayed(true);
                  setShowEndScreen(true);
                }}
                currentPlayingFaceIndex={currentPlayingFaceIndex}
              />
            </View>
          ) : is3DFormat && videos3D.length > 0 ? (
            <Video3DPlayer
              videos={videos3D}
              format={videoFormat}
              width={SCREEN_WIDTH - 48}
              height={260}
              autoPlay={true}
              onComplete={handlePlaybackComplete}
            />
          ) : finalVideoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: finalVideoUri }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode="contain"
              onPlaybackStatusUpdate={(status) => {
                setIsPlaying(status.isPlaying);
              }}
            />
          ) : (
            <View style={styles.videoPreview}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={64}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.noVideoText}>אין סרטון זמין</Text>
            </View>
          )}
          
          <View style={styles.videoInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{participantCount} משתתפים</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="videocam-outline" size={18} color={theme.colors.subtext} />
              <Text style={styles.infoText}>{reflections.length} שיקופים</Text>
            </View>
          </View>
        </View>

        {playbackComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.completeText}>הסתיים!</Text>
          </View>
        )}

        <View style={styles.privacyBadge}>
          <Ionicons 
            name={privacySettings.allowSocialMedia ? 'globe-outline' : 'lock-closed-outline'} 
            size={18} 
            color={privacySettings.allowSocialMedia ? theme.colors.success : theme.colors.primary} 
          />
          <Text style={styles.privacyText}>
            {privacySettings.allowSocialMedia 
              ? 'ניתן לפרסום ברשתות חברתיות' 
              : 'צפייה פרטית בלבד'}
          </Text>
        </View>

        <View style={styles.actions}>
            {!is3DFormat && (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleDownload}
                disabled={isDownloading}
              >
                <View style={styles.actionIcon}>
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={28} color={theme.colors.primary} />
                  )}
                </View>
                <Text style={styles.actionLabel}>הורד</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={styles.actionIcon}>
                <Ionicons name="share-social-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionLabel}>שתף</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => go('EditRoom')}>
              <View style={styles.actionIcon}>
                <Ionicons name="create-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionLabel}>ערוך</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomActions}>
            <AppButton
              title="צור סיפור חדש"
              onPress={handleNewStory}
              variant="primary"
              size="lg"
              fullWidth
            />
            
            <TouchableOpacity 
              style={styles.homeButton}
              onPress={() => go('Home')}
            >
              <Text style={styles.homeButtonText}>חזור לדף הבית</Text>
            </TouchableOpacity>
          </View>
        </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  fullscreenMode: {
    backgroundColor: '#000',
  },
  fullscreenCubeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  header: {
    paddingTop: 60,
    paddingBottom: theme.spacing[6],
    paddingHorizontal: theme.spacing[4],
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  storyName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: theme.spacing[2],
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing[2],
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatText: {
    color: 'white',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: theme.spacing[4],
  },
  videoContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  cubeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[4],
    minHeight: 300,
    position: 'relative',
  },
  cubeFullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 0,
    zIndex: 1000,
    backgroundColor: '#000',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: theme.colors.border || '#E5E7EB',
    borderRadius: 4,
    marginTop: theme.spacing[3],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.error || '#EF4444',
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radii.md,
    marginTop: theme.spacing[4],
    gap: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cubePlayButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  playButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  cubePlayText: {
    marginTop: theme.spacing[2],
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  cubeProgressText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  activeVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderRadius: theme.radii.lg,
  },
  overlayVideo: {
    width: '95%',
    height: '85%',
    borderRadius: 12,
  },
  videoCounter: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoCounterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeVideoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectedVideoContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  projectedVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  projectedVideoFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 12,
  },
  videoScreenBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    pointerEvents: 'none',
  },
  projectedVideo: {
    width: '100%',
    height: '100%',
  },
  projectedVideoCounter: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectedVideoCounterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  fullscreenVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideoFrame: {
    width: '92%',
    aspectRatio: 9/16,
    maxHeight: '85%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayerNameBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  videoPlayerNameText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  videoProgressBadge: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(255, 107, 157, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  videoProgressText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cubeStatusBadge: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  cubeStatusText: {
    color: 'white',
    fontSize: 12,
  },
  videoPlayer: {
    width: '100%',
    height: 220,
  },
  videoPreview: {
    height: 220,
    backgroundColor: theme.colors.gradient.end,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoText: {
    color: 'white',
    marginTop: theme.spacing[2],
    fontSize: 14,
  },
  videoInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[6],
    padding: theme.spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  infoText: {
    ...theme.typography.caption,
    color: theme.colors.subtext,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    padding: theme.spacing[2],
    backgroundColor: '#E8F5E9',
    borderRadius: theme.radii.md,
  },
  completeText: {
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
  },
  privacyText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  actionButton: {
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  actionLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingVertical: theme.spacing[3],
  },
  homeButton: {
    alignItems: 'center',
    marginTop: theme.spacing[3],
  },
  homeButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary,
  },
  endScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endScreenGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endScreenText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  endScreenSubtext: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 20,
    fontWeight: '500',
  },
  endScreenButton: {
    marginTop: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  endScreenButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
