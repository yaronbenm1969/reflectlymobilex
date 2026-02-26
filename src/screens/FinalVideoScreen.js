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
  Linking,
  ScrollView,
} from 'react-native';
import { Video, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useNav } from '../hooks/useNav';
import { useAppState } from '../state/appState';
import { AppButton } from '../ui/AppButton';
import { Video3DPlayer } from '../components/Video3DPlayer';
import CubeWebView from '../components/cube3d/CubeWebView';
import { AnimationPlayer } from '../components/animations';
import { useReflectionAssets } from '../hooks/useReflectionAssets';
import { storageService } from '../services/storageService';
import theme from '../theme/theme';

const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const MUSIC_BASE_URL = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library`;

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
  const currentStoryId = useAppState((state) => state.currentStoryId);
  const selectedMusic = useAppState((state) => state.selectedMusic);
  
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
  const [showRecordGuide, setShowRecordGuide] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [triggerAutoPlay, setTriggerAutoPlay] = useState(false);
  const [clientRecordingSupported, setClientRecordingSupported] = useState(false);
  const [recordNextPlayback, setRecordNextPlayback] = useState(false);
  const [clientRecordingInProgress, setClientRecordingInProgress] = useState(false);
  const [cachedRecordingUri, setCachedRecordingUri] = useState(null);
  const [recordingFirebaseUrl, setRecordingFirebaseUrl] = useState(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [conversionSucceeded, setConversionSucceeded] = useState(false);
  const clientRecordingResolveRef = useRef(null);
  const autoRecordTriggeredRef = useRef(false);
  const isUploadingRef = useRef(false);
  const cachedRecordingRef = useRef(null);
  const firebaseUrlRef = useRef(null);
  const clientRecordingSupportedRef = useRef(false);
  const videoRef = useRef(null);
  const cubeRef = useRef(null);
  const ambientSoundRef = useRef(null);
  const ambientPhaseIndexRef = useRef(0);

  const isAmbientMusic = selectedMusic && selectedMusic !== 'none' && selectedMusic !== 'ai-generated';

  const startAmbientMusic = async () => {
    if (!isAmbientMusic) return;

    try {
      const phaseNum = ambientPhaseIndexRef.current + 1;
      const url = `${MUSIC_BASE_URL}/${selectedMusic}/phase${phaseNum > 3 ? 1 : phaseNum}.mp3`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.3, isLooping: false }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          ambientPhaseIndexRef.current = (ambientPhaseIndexRef.current + 1) % 3;
          sound.unloadAsync().then(() => {
            startAmbientMusic();
          });
        }
      });

      ambientSoundRef.current = sound;
    } catch (err) {
      console.error('Ambient music error:', err.message);
    }
  };

  const stopAmbientMusic = async () => {
    if (ambientSoundRef.current) {
      try {
        const status = await ambientSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const startVol = status.volume || 0.3;
          const steps = 10;
          for (let i = steps; i >= 0; i--) {
            if (!ambientSoundRef.current) break;
            await ambientSoundRef.current.setVolumeAsync((startVol * i) / steps);
            await new Promise(r => setTimeout(r, 100));
          }
        }
        await ambientSoundRef.current.stopAsync();
        await ambientSoundRef.current.unloadAsync();
      } catch (e) {}
      ambientSoundRef.current = null;
    }
    ambientPhaseIndexRef.current = 0;
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});

    return () => {
      if (ambientSoundRef.current) {
        ambientSoundRef.current.stopAsync().catch(() => {});
        ambientSoundRef.current.unloadAsync().catch(() => {});
        ambientSoundRef.current = null;
      }
    };
  }, []);

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
  const isFlipPages = videoFormat === 'flip-pages';
  const isAnimatedFormat = isCube3D || isFlipPages;
  
  console.log('🎬 FinalVideoScreen format:', videoFormat, 'isAnimatedFormat:', isAnimatedFormat, 'isFlipPages:', isFlipPages);

  // Load all reflections (not limited to 6) for proper progress display
  const { 
    status: assetStatus, 
    progress: assetProgress, 
    preparedFaces, 
    isReady: assetsReady,
    reset: resetAssets,
    prepareAllAssets 
  } = useReflectionAssets(isAnimatedFormat ? reflections : [], reflections.length || 9);

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
    if (isAnimatedFormat && assetsReady) {
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
          startAmbientMusic();
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
        startAmbientMusic();
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
      stopAmbientMusic();
      console.log(`✅ Cube playback complete`);
    }
  };

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        if (ambientSoundRef.current) {
          try { await ambientSoundRef.current.pauseAsync(); } catch (e) {}
        }
      } else {
        await videoRef.current.playAsync();
        if (ambientSoundRef.current) {
          try { await ambientSoundRef.current.playAsync(); } catch (e) {}
        } else {
          startAmbientMusic();
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleShare = async () => {
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing('מכין סרטון לשיתוף');
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress('שומר...');
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'share');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
          dialogTitle: `שתף את הסרטון: ${storyName}`,
        });
      } else {
        await Share.share({
          message: `צפה בסרטון שלי: "${storyName}" 🎬`,
          title: storyName,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הסרטון');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
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

  const [downloadProgress, setDownloadProgress] = useState('');

  const handleRecord3DVideo = () => {
    setShowEndScreen(false);
    setShowRecordGuide(true);
  };

  const startRecordingCountdown = () => {
    setShowRecordGuide(false);
    setRecordCountdown(5);
    setIsRecordingMode(true);
    setTriggerAutoPlay(false);

    let count = 5;
    const interval = setInterval(() => {
      count--;
      setRecordCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setRecordCountdown(0);
        setTriggerAutoPlay(true);
        setTimeout(() => setTriggerAutoPlay(false), 500);
      }
    }, 1000);
  };

  const activeRenderRef = useRef(null);
  
  const renderConcatenatedVideo = async (progressLabel = 'מחבר סרטונים') => {
    if (activeRenderRef.current) {
      console.log('📥 Render already in progress, waiting for existing job');
      return activeRenderRef.current;
    }
    
    const renderPromise = (async () => {
    const allVideos = cubeFaces.map(f => f?.videoUrl).filter(Boolean);
    if (allVideos.length === 0) {
      return finalVideoUri;
    }
    if (allVideos.length === 1 && !isAnimatedFormat) {
      return allVideos[0];
    }
    
    setDownloadProgress(`${progressLabel}...`);
    const storyId = `render_${Date.now()}`;
    
    const useFormatRender = isAnimatedFormat && (isCube3D || isFlipPages);
    const endpoint = useFormatRender 
      ? `${VIDEO_CONVERTER_URL}/api/stories/${storyId}/render-format`
      : `${VIDEO_CONVERTER_URL}/api/stories/${storyId}/render`;
    
    console.log(`📥 Sending ${useFormatRender ? 'FORMAT' : 'standard'} render: ${allVideos.length} videos, format: ${videoFormat}`);
    const renderRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrls: allVideos,
        format: videoFormat || 'standard',
        storyName: storyName || '',
      }),
    });

    const renderText = await renderRes.text();
    console.log(`📥 Render response (${renderRes.status}):`, renderText);
    let renderData;
    try { renderData = JSON.parse(renderText); } catch (e) {
      throw new Error(`Server returned invalid response: ${renderText.substring(0, 200)}`);
    }
    if (!renderData.success || !renderData.jobId) {
      throw new Error(renderData.error || renderData.message || 'Failed to start rendering');
    }

    const maxPolls = useFormatRender ? 450 : 120;
    let consecutiveErrors = 0;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 15000);
        const statusRes = await fetch(`${VIDEO_CONVERTER_URL}/api/render-status/${renderData.jobId}`, {
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);
        const statusText = await statusRes.text();
        let statusData;
        try { statusData = JSON.parse(statusText); } catch (parseErr) {
          console.warn(`Status poll ${i}: non-JSON response (${statusRes.status}):`, statusText.substring(0, 100));
          consecutiveErrors++;
          if (consecutiveErrors > 30) throw new Error('Server not responding properly');
          continue;
        }
        consecutiveErrors = 0;
        if (statusData.status === 'completed' && statusData.finalUrl) {
          return statusData.finalUrl;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Rendering failed');
        }
        const progressMsg = statusData.progressMessage || '';
        setDownloadProgress(`${statusData.progress || 0}% ${progressMsg}`);
      } catch (fetchErr) {
        if (fetchErr.message === 'Server not responding properly' || fetchErr.message?.includes('Rendering failed')) throw fetchErr;
        console.warn(`Status poll ${i} error:`, fetchErr.message);
        consecutiveErrors++;
        if (consecutiveErrors > 30) throw new Error('Server connection lost');
      }
    }
    throw new Error('Rendering timed out');
    })();
    
    activeRenderRef.current = renderPromise;
    try {
      const result = await renderPromise;
      return result;
    } finally {
      activeRenderRef.current = null;
    }
  };

  const performClientRecording = () => {
    return new Promise((resolve) => {
      clientRecordingResolveRef.current = resolve;
      setClientRecordingInProgress(true);
      setDownloadProgress('מקליט אנימציה...');
      setShowEndScreen(false);
      setRecordNextPlayback(true);
      
      const recordingTimeout = setTimeout(() => {
        console.log('📹 Recording timeout - resolving with null');
        if (clientRecordingResolveRef.current) {
          clientRecordingResolveRef.current(null);
          clientRecordingResolveRef.current = null;
        }
        setRecordNextPlayback(false);
        setClientRecordingInProgress(false);
      }, 5 * 60 * 1000);
      
      const origResolve = resolve;
      clientRecordingResolveRef.current = (fileUri) => {
        clearTimeout(recordingTimeout);
        origResolve(fileUri);
      };
      
      setTimeout(() => {
        setTriggerAutoPlay(true);
        setTimeout(() => setTriggerAutoPlay(false), 500);
      }, 300);
    });
  };

  const handleRecordingSupport = (supported) => {
    console.log('📹 Client recording supported:', supported, 'format:', videoFormat);
    setClientRecordingSupported(supported);
    clientRecordingSupportedRef.current = supported;
    if (supported && isAnimatedFormat && !autoRecordTriggeredRef.current) {
      console.log('📹 Auto-recording enabled - will record first playback');
      autoRecordTriggeredRef.current = true;
      setRecordNextPlayback(true);
    }
  };

  const handleRecordingComplete = async (fileUri) => {
    console.log('📹 Recording complete:', fileUri);
    setRecordNextPlayback(false);
    setClientRecordingInProgress(false);
    setDownloadProgress('');
    
    let validRecording = false;
    if (fileUri) {
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        const MIN_VALID_SIZE = 50000;
        console.log(`📹 Recording file size: ${info.size} bytes (min: ${MIN_VALID_SIZE})`);
        if (info.exists && info.size >= MIN_VALID_SIZE) {
          validRecording = true;
          setCachedRecordingUri(fileUri);
          cachedRecordingRef.current = fileUri;
          convertAndUploadRecording(fileUri);
        } else {
          console.warn('📹 Recording too small - iOS captureStream likely not supported. Will use server render.');
          setCachedRecordingUri(null);
          cachedRecordingRef.current = null;
          setClientRecordingSupported(false);
          clientRecordingSupportedRef.current = false;
        }
      } catch (e) {
        console.warn('📹 Cannot check recording file:', e.message);
      }
    }
    
    const hadManualResolve = !!clientRecordingResolveRef.current;
    if (clientRecordingResolveRef.current) {
      clientRecordingResolveRef.current(validRecording ? fileUri : null);
      clientRecordingResolveRef.current = null;
    }
    
    if (!hadManualResolve) {
      setShowEndScreen(true);
    }
  };

  const convertAndUploadRecording = async (fileUri) => {
    if (!currentStoryId || !fileUri) return;
    const isAlreadyMp4 = fileUri.toLowerCase().includes('.mp4');
    
    try {
      setIsUploadingRecording(true);
      isUploadingRef.current = true;
      
      if (isAlreadyMp4) {
        console.log('📹 Recording is already MP4 (iOS) - uploading directly...');
        const uploadResult = await storageService.uploadVideo(
          fileUri,
          currentStoryId,
          'animated_export',
          (progress) => console.log(`📹 Upload progress: ${progress.toFixed(0)}%`)
        );
        
        if (uploadResult.success && uploadResult.url) {
          console.log('📹 MP4 uploaded to Firebase:', uploadResult.url.substring(0, 60));
          setRecordingFirebaseUrl(uploadResult.url);
          firebaseUrlRef.current = uploadResult.url;
          setConversionSucceeded(true);
        } else {
          console.warn('📹 Firebase upload failed:', uploadResult.error);
        }
        return;
      }
      
      console.log('📹 Step 1: Uploading webm to Firebase...');
      const uploadResult = await storageService.uploadVideo(
        fileUri,
        currentStoryId,
        'animated_export_raw',
        (progress) => console.log(`📹 Upload progress: ${progress.toFixed(0)}%`)
      );
      
      if (!uploadResult.success || !uploadResult.url) {
        console.warn('📹 Firebase upload failed:', uploadResult.error);
        return;
      }
      
      const webmUrl = uploadResult.url;
      console.log('📹 Step 2: Converting webm→mp4 via server...', webmUrl.substring(0, 60));
      
      try {
        const convertResponse = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webmUrl }),
        });
        
        if (convertResponse.ok) {
          const convertResult = await convertResponse.json();
          if (convertResult.success && convertResult.convertedUrl) {
            console.log('📹 Converted mp4 ready:', convertResult.convertedUrl.substring(0, 60));
            setRecordingFirebaseUrl(convertResult.convertedUrl);
            firebaseUrlRef.current = convertResult.convertedUrl;
            setConversionSucceeded(true);
            
            const mp4LocalPath = FileSystem.cacheDirectory + `recording_mp4_${Date.now()}.mp4`;
            try {
              const dlResult = await FileSystem.downloadAsync(convertResult.convertedUrl, mp4LocalPath);
              if (dlResult.status === 200) {
                console.log('📹 Mp4 cached locally:', mp4LocalPath);
                setCachedRecordingUri(mp4LocalPath);
                cachedRecordingRef.current = mp4LocalPath;
              }
            } catch (dlErr) {
              console.warn('📹 Mp4 local cache failed, will use URL:', dlErr.message);
            }
            return;
          }
        }
        console.warn('📹 Server conversion failed, using webm as fallback');
      } catch (convertErr) {
        console.warn('📹 Conversion request failed:', convertErr.message);
      }
      
      setRecordingFirebaseUrl(webmUrl);
      firebaseUrlRef.current = webmUrl;
    } catch (err) {
      console.warn('📹 Upload/convert error:', err.message);
    } finally {
      setIsUploadingRecording(false);
      isUploadingRef.current = false;
    }
  };

  const handleRecordingProgress = (progress) => {
    if (progress.phase === 'transferring') {
      setDownloadProgress(`מעבד הקלטה... ${progress.progress}%`);
    } else if (progress.phase === 'saving') {
      setDownloadProgress('שומר הקלטה...');
    }
  };

  const getVideoForSharing = async (label = 'מכין סרטון') => {
    if (isUploadingRef.current) {
      console.log('📹 Conversion in progress, waiting...');
      setDownloadProgress('ממיר סרטון...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!isUploadingRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
        setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
      });
      setDownloadProgress('');
    }
    
    const cached = cachedRecordingRef.current;
    const fbUrl = firebaseUrlRef.current;
    const isMp4 = (uri) => uri && !uri.toLowerCase().includes('.webm');
    const MIN_VALID_SIZE = 50000;
    
    const isValidLocal = async (uri) => {
      if (!uri) return false;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        const valid = info.exists && info.size >= MIN_VALID_SIZE;
        if (!valid) console.log(`📹 File invalid: ${uri.slice(-30)} size=${info.size || 0}`);
        return valid;
      } catch { return false; }
    };
    
    if (isMp4(cached) && await isValidLocal(cached)) {
      console.log('📹 Using cached mp4 recording');
      return cached;
    }
    if (fbUrl) {
      console.log('📹 Using Firebase converted URL, downloading...');
      try {
        const localPath = await downloadVideoToLocal(fbUrl, 'share_mp4');
        if (await isValidLocal(localPath)) {
          console.log('📹 Firebase mp4 downloaded and valid');
          return localPath;
        }
      } catch (e) {
        console.warn('📹 Firebase download failed:', e.message);
      }
    }
    if (cached && await isValidLocal(cached)) {
      console.log('📹 Using webm recording (conversion may have failed)');
      return cached;
    }
    if (isAnimatedFormat && clientRecordingSupportedRef.current) {
      console.log('📹 Recording not cached yet, recording now');
      setIsDownloading(true);
      const fileUri = await performClientRecording();
      if (fileUri && await isValidLocal(fileUri)) return fileUri;
      console.log('📹 Client recording failed or too small, falling back to server');
    }
    console.log('📹 Falling back to server-side render');
    return await renderConcatenatedVideo(label);
  };

  const downloadVideoToLocal = async (url, prefix = 'video') => {
    const filename = `${prefix}_${Date.now()}.mp4`;
    const localUri = FileSystem.cacheDirectory + filename;
    const downloadResult = await FileSystem.downloadAsync(url, localUri);
    if (downloadResult.status !== 200) throw new Error('Download failed');
    return downloadResult.uri;
  };

  const handleSaveToGallery = async () => {
    try {
      setIsDownloading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('נדרשת הרשאה', 'יש לאשר גישה לגלריה כדי לשמור את הסרטון');
        return;
      }

      const allVideos = cubeFaces.map(f => f?.videoUrl).filter(Boolean);
      if (allVideos.length === 0 && !finalVideoUri) {
        Alert.alert('שגיאה', 'אין סרטון זמין לשמירה');
        return;
      }

      const videoUri = await getVideoForSharing('שומר סרטון');
      setDownloadProgress('שומר בגלריה...');
      const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
      let localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, storyName.replace(/[^a-zA-Zא-ת0-9]/g, '_'));
      
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      console.log('📹 File to save:', localUri, 'size:', fileInfo.size, 'exists:', fileInfo.exists);
      
      if (!fileInfo.exists || fileInfo.size < 1000) {
        console.warn('📹 Local file too small or missing, trying Firebase URL...');
        const fbUrl = firebaseUrlRef.current || recordingFirebaseUrl;
        if (fbUrl) {
          localUri = await downloadVideoToLocal(fbUrl, 'gallery_save');
          const reInfo = await FileSystem.getInfoAsync(localUri);
          console.log('📹 Re-downloaded from Firebase:', reInfo.size, 'bytes');
        }
      }
      
      if (!localUri.endsWith('.mp4')) {
        const mp4Path = localUri.replace(/\.[^.]+$/, '.mp4');
        await FileSystem.copyAsync({ from: localUri, to: mp4Path });
        localUri = mp4Path;
        console.log('📹 Renamed to .mp4 for gallery save:', mp4Path);
      }
      
      try {
        const asset = await MediaLibrary.createAssetAsync(localUri);
        console.log('📹 Asset created:', asset.uri);
      } catch (assetErr) {
        console.warn('📹 createAssetAsync failed, trying saveToLibraryAsync:', assetErr.message);
        await MediaLibrary.saveToLibraryAsync(localUri);
      }
      
      Alert.alert('נשמר בהצלחה!', allVideos.length > 1 
        ? `${allVideos.length} סרטונים חוברו ונשמרו בגלריה שלך`
        : 'הסרטון נשמר בגלריה שלך');
    } catch (error) {
      console.error('Save to gallery error:', error);
      Alert.alert('שגיאה', `לא ניתן לשמור: ${error.message}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleShareToFacebook = async () => {
    try {
      const shareMessage = `צפו בסיפור שלי: "${storyName}" 🎬✨`;
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareMessage)}`;
      const canOpen = await Linking.canOpenURL(fbUrl);
      if (canOpen) {
        await Linking.openURL(fbUrl);
      } else {
        await Share.share({ message: shareMessage, title: storyName });
      }
    } catch (error) {
      console.error('Facebook share error:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף לפייסבוק');
    }
  };

  const handleShareToInstagram = async () => {
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing('מכין לאינסטגרם');
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress('שומר...');
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'instagram');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
          UTI: 'com.instagram.exclusivegram',
        });
        return;
      }
      const igUrl = 'instagram://app';
      const canOpen = await Linking.canOpenURL(igUrl);
      if (canOpen) {
        await Linking.openURL(igUrl);
      } else {
        Alert.alert('אינסטגרם', 'אינסטגרם לא מותקן במכשיר');
      }
    } catch (error) {
      console.error('Instagram share error:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף לאינסטגרם');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleShareToTikTok = async () => {
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing('מכין לטיקטוק');
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress('שומר...');
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'tiktok');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
        });
        return;
      }
      const tiktokUrl = 'snssdk1233://';
      const canOpen = await Linking.canOpenURL(tiktokUrl);
      if (canOpen) {
        await Linking.openURL(tiktokUrl);
      } else {
        Alert.alert('טיקטוק', 'טיקטוק לא מותקן במכשיר');
      }
    } catch (error) {
      console.error('TikTok share error:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף לטיקטוק');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleGeneralShare = async () => {
    try {
      setIsDownloading(true);
      const videoUri = await getVideoForSharing('מכין לשיתוף');
      if (videoUri && await Sharing.isAvailableAsync()) {
        setDownloadProgress('שומר...');
        const isLocalFile = videoUri.startsWith('file://') || videoUri.startsWith('/');
        const localUri = isLocalFile ? videoUri : await downloadVideoToLocal(videoUri, 'share');
        setIsDownloading(false);
        setDownloadProgress('');
        await Sharing.shareAsync(localUri, {
          mimeType: 'video/mp4',
          dialogTitle: `שתף את הסרטון: ${storyName}`,
        });
        return;
      }
      await Share.share({
        message: `צפה בסרטון שלי: "${storyName}" 🎬`,
        title: storyName,
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handleNewStory = () => {
    stopAmbientMusic();
    resetStory();
    go('Home');
  };

  const handlePlaybackComplete = () => {
    setPlaybackComplete(true);
    stopAmbientMusic();
  };

  const videos3D = is3DFormat ? prepareVideosFor3D() : [];

  return (
    <View style={[styles.container, isCubeFullscreen && styles.fullscreenMode]}>
      {/* ANIMATION PLAYER - supports cube-3d and flip-pages */}
      {isAnimatedFormat && assetsReady && (
        <View style={[
          styles.cubeContainer, 
          isCubeFullscreen && styles.fullscreenCubeOverlay
        ]}>
          <AnimationPlayer
            format={videoFormat}
            faces={cubeFaces}
            storyName={storyName}
            autoRotate={cubeStarted}
            rotationSpeed={currentVideoDuration > 0 ? currentVideoDuration * 1000 * 4 : 20000}
            isFullscreen={isCubeFullscreen}
            triggerAutoPlay={triggerAutoPlay}
            recordNextPlayback={recordNextPlayback}
            onFaceChange={handleFaceChange}
            onVideoStart={(faceIndex) => setCurrentPlayingFaceIndex(faceIndex)}
            onVideoEnd={handleVideoEnd}
            onPlaybackStart={() => {
              console.log('🚀 Animation fullscreen mode ON');
              setIsCubeFullscreen(true);
              setCubeStarted(true);
              startAmbientMusic();
              if (recordNextPlayback) {
                setClientRecordingInProgress(true);
              }
            }}
            onPlaybackComplete={() => {
              console.log('✅ All videos finished - showing end screen');
              setIsCubeFullscreen(false);
              setVideoHasPlayed(true);
              stopAmbientMusic();
              if (clientRecordingInProgress) {
                console.log('📹 Playback complete during recording - waiting for data');
              } else if (isRecordingMode) {
                setIsRecordingMode(false);
                setTimeout(() => {
                  Alert.alert(
                    'עצור הקלטה!',
                    'הסרטון הסתיים. עצור עכשיו את הקלטת המסך.\nהסרטון עם התלת-מימד נשמר בגלריה שלך!',
                    [{ text: 'מעולה!', onPress: () => setShowEndScreen(true) }]
                  );
                }, 500);
              } else {
                setShowEndScreen(true);
              }
            }}
            onRecordingSupport={handleRecordingSupport}
            onRecordingComplete={handleRecordingComplete}
            onRecordingProgress={handleRecordingProgress}
            currentPlayingFaceIndex={currentPlayingFaceIndex}
          />
        </View>
      )}

      {/* Recording Processing Overlay */}
      {!isCubeFullscreen && clientRecordingInProgress && !showEndScreen && videoHasPlayed && (
        <View style={styles.endScreenOverlay}>
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            style={[styles.endScreenGradient, { justifyContent: 'center', alignItems: 'center' }]}
          >
            <ActivityIndicator size="large" color="white" />
            <Text style={{ color: 'white', fontSize: 18, marginTop: 16, fontWeight: '600' }}>
              {downloadProgress || 'מכין את הסרטון...'}
            </Text>
          </LinearGradient>
        </View>
      )}

      {/* End Screen Overlay */}
      {showEndScreen && (
        <View style={styles.endScreenOverlay}>
          <LinearGradient
            colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
            style={styles.endScreenGradient}
          >
            {isDownloading && (
              <View style={styles.downloadProgressOverlay}>
                <View style={styles.downloadProgressCard}>
                  <ActivityIndicator size="large" color="#8446b0" />
                  <Text style={styles.downloadProgressTitle}>מעבד סרטון...</Text>
                  {downloadProgress ? (
                    <Text style={styles.downloadProgressText}>{downloadProgress}</Text>
                  ) : null}
                </View>
              </View>
            )}
            <ScrollView 
              contentContainerStyle={styles.endScreenScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.endScreenText}>סוף</Text>
              <Text style={styles.endScreenSubtext}>{storyName}</Text>

              {isUploadingRecording ? (
                <View style={styles.recordingReadyBadge}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.recordingReadyText}>ממיר ומעלה סרטון...</Text>
                </View>
              ) : conversionSucceeded ? (
                <View style={styles.recordingReadyBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={styles.recordingReadyText}>סרטון MP4 מוכן לשיתוף</Text>
                </View>
              ) : cachedRecordingUri ? (
                <View style={styles.recordingReadyBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFC107" />
                  <Text style={styles.recordingReadyText}>סרטון מוקלט, ממתין להמרה</Text>
                </View>
              ) : null}

              <View style={styles.endScreenDivider} />

              <Text style={styles.endScreenSectionTitle}>שמור ושתף</Text>

              <View style={styles.endScreenActions}>
                <TouchableOpacity 
                  style={styles.endScreenActionBtn}
                  onPress={handleSaveToGallery}
                  disabled={isDownloading}
                >
                  <View style={styles.endScreenIconCircle}>
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#8446b0" />
                    ) : (
                      <Ionicons name="download-outline" size={28} color="#8446b0" />
                    )}
                  </View>
                  <Text style={styles.endScreenActionLabel}>הורד סרטון</Text>
                </TouchableOpacity>


                <TouchableOpacity 
                  style={[styles.endScreenActionBtn, isDownloading && styles.disabledBtn]}
                  onPress={handleGeneralShare}
                  disabled={isDownloading}
                >
                  <View style={styles.endScreenIconCircle}>
                    <Ionicons name="share-outline" size={28} color="#8446b0" />
                  </View>
                  <Text style={styles.endScreenActionLabel}>שלח</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.endScreenSectionTitle}>פרסם ברשתות</Text>

              <View style={styles.endScreenSocials}>
                <TouchableOpacity 
                  style={[styles.socialBtn, isDownloading && styles.disabledBtn]}
                  onPress={handleShareToFacebook}
                  disabled={isDownloading}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: '#1877F2' }]}>  
                    <Ionicons name="logo-facebook" size={30} color="white" />
                  </View>
                  <Text style={styles.socialLabel}>פייסבוק</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.socialBtn, isDownloading && styles.disabledBtn]}
                  onPress={handleShareToInstagram}
                  disabled={isDownloading}
                >
                  <LinearGradient
                    colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']}
                    style={styles.socialIconCircle}
                  >
                    <Ionicons name="logo-instagram" size={30} color="white" />
                  </LinearGradient>
                  <Text style={styles.socialLabel}>אינסטגרם</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.socialBtn, isDownloading && styles.disabledBtn]}
                  onPress={handleShareToTikTok}
                  disabled={isDownloading}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: '#000' }]}>  
                    <Ionicons name="logo-tiktok" size={28} color="white" />
                  </View>
                  <Text style={styles.socialLabel}>טיקטוק</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.endScreenBottomBtns}>
                <TouchableOpacity 
                  style={styles.endScreenPrimaryBtn}
                  onPress={() => go('Home')}
                >
                  <Ionicons name="home-outline" size={20} color="white" />
                  <Text style={styles.endScreenPrimaryBtnText}>חזור לדף הבית</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.endScreenSecondaryBtn}
                  onPress={() => {
                    setShowEndScreen(false);
                    setPlaybackComplete(false);
                    setVideoHasPlayed(false);
                    setCubeStarted(false);
                    setIsCubeFullscreen(false);
                  }}
                >
                  <Ionicons name="play-circle-outline" size={20} color="white" />
                  <Text style={styles.endScreenSecondaryBtnText}>צפה שוב</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      )}

      {/* Screen Recording Guide Modal */}
      {showRecordGuide && (
        <View style={styles.endScreenOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.endScreenGradient}
          >
            <View style={styles.recordGuideContent}>
              <View style={styles.recordGuideIconWrap}>
                <Ionicons name="recording-outline" size={50} color="#FF4444" />
              </View>
              <Text style={styles.recordGuideTitle}>הקלטת סרטון תלת-מימד</Text>
              <Text style={styles.recordGuideDesc}>
                כדי לשמור את הסרטון עם האנימציה התלת-מימדית, יש להפעיל את הקלטת המסך של האייפון.
              </Text>

              <View style={styles.recordGuideSteps}>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                  <Text style={styles.stepText}>החלק למטה מפינה ימנית עליונה (מרכז הבקרה)</Text>
                </View>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                  <Text style={styles.stepText}>לחץ על כפתור ההקלטה ⏺</Text>
                </View>
                <View style={styles.recordGuideStep}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                  <Text style={styles.stepText}>חזור לאפליקציה ולחץ "מוכן, התחל!"</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.recordStartBtn}
                onPress={startRecordingCountdown}
              >
                <Ionicons name="videocam" size={24} color="white" />
                <Text style={styles.recordStartBtnText}>מוכן, התחל!</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.recordCancelBtn}
                onPress={() => {
                  setShowRecordGuide(false);
                  setShowEndScreen(true);
                }}
              >
                <Text style={styles.recordCancelBtnText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Countdown Overlay */}
      {recordCountdown > 0 && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{recordCountdown}</Text>
          <Text style={styles.countdownLabel}>הסרטון מתחיל...</Text>
        </View>
      )}

      {!isCubeFullscreen && !showEndScreen && !showRecordGuide && (
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
          {isAnimatedFormat && assetStatus === 'error' ? (
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
          ) : isAnimatedFormat && (assetStatus === 'loading' || assetStatus === 'converting' || (assetStatus === 'idle' && reflections.length > 0)) && !assetsReady ? (
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
          ) : isAnimatedFormat && assetsReady ? (
            /* Cube is rendered at top level - show empty placeholder here */
            null
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
    minHeight: 400,
    width: '100%',
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
    shadowColor: '#8446b0',
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
    shadowColor: '#8446b0',
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
  disabledBtn: {
    opacity: 0.4,
  },
  downloadProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadProgressCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    maxWidth: '80%',
  },
  downloadProgressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  downloadProgressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  endScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
  },
  endScreenGradient: {
    width: '100%',
    height: '100%',
  },
  endScreenScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  endScreenText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  endScreenSubtext: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 12,
    fontWeight: '500',
  },
  recordingReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  recordingReadyText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  endScreenDivider: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginVertical: 24,
    borderRadius: 1,
  },
  endScreenSectionTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 1,
  },
  endScreenActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 28,
  },
  endScreenActionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  endScreenIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  endScreenActionLabel: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  endScreenSocials: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  socialBtn: {
    alignItems: 'center',
    gap: 8,
  },
  socialIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  socialLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  endScreenBottomBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  endScreenPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  endScreenPrimaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  endScreenSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  endScreenSecondaryBtnText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
  recordGuideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  recordGuideIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  recordGuideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  recordGuideDesc: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  recordGuideSteps: {
    width: '100%',
    marginBottom: 32,
  },
  recordGuideStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FF6666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    lineHeight: 21,
  },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF4444',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  recordStartBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordCancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  recordCancelBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#FF4444',
    textShadowColor: 'rgba(255, 68, 68, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownLabel: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
});
