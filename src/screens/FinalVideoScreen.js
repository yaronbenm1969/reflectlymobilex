import React, { useState, useRef, useEffect } from 'react';
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
import * as FileSystem from 'expo-file-system';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { Video3DPlayer } from '../components/Video3DPlayer';
import CubeProjectorView from '../components/cube3d/CubeProjectorView';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const videoRef = useRef(null);
  const cubeRef = useRef(null);

  const participantCount = new Set(reflections.map(r => r.recipientId || r.participantId || 'anonymous')).size;

  const is3DFormat = videoFormat && videoFormat !== 'standard';
  const isCube3D = videoFormat === 'cube-3d';

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
          thumbnail: reflection.thumbnailUrl || null,
          clipNumber: reflection.clipNumber,
        });
      }
    });
    
    return videos;
  };

  const prepareCubeFaces = () => {
    const faces = [];
    reflections.forEach((reflection, index) => {
      if (reflection.videoUrl && faces.length < 6) {
        faces.push({
          posterThumbUri: reflection.thumbnailUrl || null,
          videoUrl: reflection.videoUrl,
          playerName: reflection.playerName || reflection.participantName || `משתתף ${Math.floor(index / 3) + 1}`,
          clipNumber: reflection.clipNumber,
        });
      }
    });
    while (faces.length < 6) {
      faces.push(null);
    }
    return faces;
  };

  const cubeFaces = isCube3D ? prepareCubeFaces() : [];

  useEffect(() => {
    if (isCube3D) {
      console.log(`🎲 Cube faces prepared: ${cubeFaces.filter(f => f !== null).length} faces with content`);
      cubeFaces.forEach((face, i) => {
        if (face) {
          console.log(`  Face ${i}: ${face.playerName}, hasVideo=${!!face.videoUrl}, hasPoster=${!!face.posterThumbUri}`);
        }
      });
    }
  }, [isCube3D, cubeFaces]);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const handleCubeFaceChange = (faceIndex, action) => {
    console.log(`🎲 Cube face ${faceIndex} ${action}`);
  };

  const [convertedVideos, setConvertedVideos] = useState([]);
  const [isConverting, setIsConverting] = useState(false);

  const convertVideoUrl = async (url) => {
    if (!url) return url;
    if (url.includes('.mp4') || url.includes('video%2Fmp4')) return url;
    
    try {
      const response = await fetch('https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev/api/convert-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.url) {
          console.log(`✅ Converted video to mp4`);
          return data.url;
        }
      }
    } catch (error) {
      console.log(`⚠️ Conversion failed, using original:`, error.message);
    }
    return url;
  };

  const startCubePlayback = async () => {
    const validFaces = cubeFaces.filter(f => f && f.videoUrl);
    if (validFaces.length > 0) {
      setIsConverting(true);
      console.log(`🔄 Converting ${validFaces.length} videos...`);
      
      try {
        const converted = await Promise.all(
          validFaces.map(f => convertVideoUrl(f.videoUrl))
        );
        setConvertedVideos(converted);
        setCurrentVideoIndex(0);
        setActiveVideoUrl(converted[0]);
        setShowVideoPlayer(true);
        setIsPlaying(true);
        console.log(`▶️ Starting cube playback with ${converted.length} videos`);
      } catch (error) {
        console.error('Conversion error:', error);
        setActiveVideoUrl(validFaces[0].videoUrl);
        setShowVideoPlayer(true);
        setIsPlaying(true);
      } finally {
        setIsConverting(false);
      }
    }
  };

  const playNextVideo = () => {
    const nextIndex = currentVideoIndex + 1;
    if (nextIndex < convertedVideos.length) {
      setCurrentVideoIndex(nextIndex);
      setActiveVideoUrl(convertedVideos[nextIndex]);
      console.log(`⏭️ Playing video ${nextIndex + 1}/${convertedVideos.length}`);
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
    <View style={styles.container}>
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
          {isCube3D && cubeFaces.some(f => f !== null) ? (
            <View style={styles.cubeContainer}>
              <CubeProjectorView
                ref={cubeRef}
                faces={cubeFaces}
                onFaceChange={handleCubeFaceChange}
                activeFaceIndex={activeFaceIndex}
                setActiveFaceIndex={setActiveFaceIndex}
                isVideoPlaying={isPlaying}
              />
              {!showVideoPlayer && (
                <TouchableOpacity 
                  style={styles.cubePlayButton}
                  onPress={startCubePlayback}
                  disabled={isConverting}
                >
                  <View style={styles.playButtonCircle}>
                    {isConverting ? (
                      <ActivityIndicator size="large" color="white" />
                    ) : (
                      <Ionicons name="play" size={40} color="white" />
                    )}
                  </View>
                  <Text style={styles.cubePlayText}>
                    {isConverting ? 'ממיר סרטונים...' : 'לחץ להפעלה'}
                  </Text>
                </TouchableOpacity>
              )}
              {showVideoPlayer && activeVideoUrl && (
                <View style={styles.activeVideoOverlay}>
                  <Video
                    ref={videoRef}
                    source={{ uri: activeVideoUrl }}
                    style={styles.overlayVideo}
                    useNativeControls={false}
                    shouldPlay={true}
                    isLooping={false}
                    resizeMode="contain"
                    onPlaybackStatusUpdate={(status) => {
                      if (status.didJustFinish) {
                        playNextVideo();
                      }
                    }}
                  />
                  <View style={styles.videoCounter}>
                    <Text style={styles.videoCounterText}>
                      {currentVideoIndex + 1}/{cubeFaces.filter(f => f?.videoUrl).length}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.closeVideoButton}
                    onPress={() => {
                      setShowVideoPlayer(false);
                      setActiveVideoUrl(null);
                      setIsPlaying(false);
                    }}
                  >
                    <Ionicons name="close" size={28} color="white" />
                  </TouchableOpacity>
                </View>
              )}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
});
