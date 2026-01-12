import { useState, useEffect, useCallback, useRef } from 'react';
import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const VIDEO_CONVERTER_URL = process.env.EXPO_PUBLIC_VIDEO_CONVERTER_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const convertedUrlCache = new Map();
const localCacheDir = FileSystem.cacheDirectory + 'videos/';

const ensureCacheDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(localCacheDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(localCacheDir, { intermediates: true });
  }
};

const getLocalFileName = (url) => {
  let filename = url.split('/').pop()?.split('?')[0] || `video_${Date.now()}`;
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!filename.endsWith('.mp4') && !filename.endsWith('.webm')) {
    filename += '.mp4';
  }
  return filename;
};

const MAX_DOWNLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadToCache = async (remoteUrl, onProgress) => {
  if (Platform.OS === 'web') {
    return remoteUrl;
  }
  
  await ensureCacheDir();
  const localUri = localCacheDir + getLocalFileName(remoteUrl);
  
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (fileInfo.exists && fileInfo.size > 0) {
    console.log('📁 Using cached video:', localUri);
    return localUri;
  }
  
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt++) {
    try {
      console.log(`⬇️ Downloading video to cache (attempt ${attempt}/${MAX_DOWNLOAD_RETRIES})...`);
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri, {
        md5: false,
      });
      
      if (downloadResult.status === 200) {
        console.log('✅ Downloaded to cache:', localUri);
        return localUri;
      } else {
        console.warn(`⚠️ Download attempt ${attempt} failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ Download attempt ${attempt} error:`, error.message);
    }
    
    if (attempt < MAX_DOWNLOAD_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  
  throw new Error(`Failed to download video after ${MAX_DOWNLOAD_RETRIES} attempts`);
};

const needsConversion = (url) => {
  if (!url) return false;
  return url.includes('.webm') || url.includes('webm');
};

const convertVideoUrl = async (originalUrl) => {
  if (convertedUrlCache.has(originalUrl)) {
    return convertedUrlCache.get(originalUrl);
  }
  
  try {
    const response = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: originalUrl }),
    });
    
    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.convertedUrl) {
      convertedUrlCache.set(originalUrl, data.convertedUrl);
      return data.convertedUrl;
    }
    throw new Error('No converted URL returned');
  } catch (error) {
    console.log('Conversion error:', error.message);
    return originalUrl;
  }
};

export const useReflectionAssets = (reflections, maxFaces = 6) => {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ converted: 0, total: 0, message: '' });
  const [preparedFaces, setPreparedFaces] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const hasStartedRef = useRef(false);
  const shuffledOrderRef = useRef(null);
  const isMountedRef = useRef(true);
  const reflectionsKeyRef = useRef(null);

  const shuffleArray = useCallback((array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const prepareAllAssets = useCallback(async () => {
    if (!reflections || reflections.length === 0) {
      return;
    }

    const currentKey = reflections.map(r => r.videoUrl || r.id).join('|');
    
    if (reflectionsKeyRef.current === currentKey && hasStartedRef.current) {
      return;
    }
    
    if (reflectionsKeyRef.current !== currentKey) {
      hasStartedRef.current = false;
      shuffledOrderRef.current = null;
    }
    
    if (hasStartedRef.current) return;
    
    reflectionsKeyRef.current = currentKey;
    hasStartedRef.current = true;
    
    if (isMountedRef.current) {
      setStatus('converting');
    }

    const validReflections = reflections.filter(r => r.videoUrl).slice(0, maxFaces);
    
    if (!shuffledOrderRef.current) {
      shuffledOrderRef.current = shuffleArray(validReflections);
    }
    const shuffledReflections = shuffledOrderRef.current;

    const total = shuffledReflections.length;
    if (isMountedRef.current) {
      setProgress({ converted: 0, total, message: 'מכין סרטונים...' });
    }

    const initialFaces = shuffledReflections.map((reflection, i) => ({
      index: i,
      originalUrl: reflection.videoUrl,
      videoUrl: null,
      thumbnailUrl: reflection.thumbnailUrl || null,
      posterThumbUri: reflection.thumbnailUrl || null,
      playerName: reflection.playerName || reflection.participantName || `משתתף ${Math.floor(i / 3) + 1}`,
      clipNumber: reflection.clipNumber,
      isReady: false,
      status: 'converting',
    }));
    
    while (initialFaces.length < maxFaces) {
      initialFaces.push(null);
    }
    if (isMountedRef.current) {
      setPreparedFaces([...initialFaces]);
    }
    
    for (let i = 0; i < shuffledReflections.length; i++) {
      if (!isMountedRef.current) break;
      
      const reflection = shuffledReflections[i];
      
      if (isMountedRef.current) {
        setProgress({ 
          converted: i, 
          total, 
          message: `ממיר סרטון ${i + 1} מתוך ${total}...` 
        });
      }

      let videoUrl = reflection.videoUrl;
      
      console.log(`🔍 Video ${i + 1}/${total} status:`, {
        hasConvertedUrl: !!reflection.convertedUrl,
        conversionStatus: reflection.conversionStatus,
        originalUrl: videoUrl?.substring(0, 60)
      });
      
      if (reflection.convertedUrl && reflection.conversionStatus === 'ready') {
        console.log(`✅ Using pre-converted URL for video ${i + 1}/${total}`);
        videoUrl = reflection.convertedUrl;
      } else if (reflection.convertedUrl) {
        console.log(`✅ Using convertedUrl (no status check) for video ${i + 1}/${total}`);
        videoUrl = reflection.convertedUrl;
      } else if (needsConversion(videoUrl)) {
        try {
          console.log(`🔄 Converting video ${i + 1}/${total} on-demand`);
          videoUrl = await convertVideoUrl(videoUrl);
          console.log(`✅ Converted video ${i + 1}/${total}`);
        } catch (error) {
          console.log(`❌ Conversion failed for video ${i + 1}, using original`);
        }
      }

      if (isMountedRef.current) {
        setProgress({ 
          converted: i, 
          total, 
          message: `מוריד סרטון ${i + 1} מתוך ${total}...` 
        });
      }
      
      let localVideoUrl = null;
      let downloadFailed = false;
      
      try {
        localVideoUrl = await downloadToCache(videoUrl);
      } catch (downloadError) {
        console.error(`❌ Failed to cache video ${i + 1}:`, downloadError.message);
        downloadFailed = true;
      }

      if (reflection.thumbnailUrl) {
        try {
          await Image.prefetch(reflection.thumbnailUrl);
          console.log(`📷 Prefetched thumbnail for face ${i}`);
        } catch (e) {
          console.log(`📷 Failed to prefetch thumbnail for face ${i}`);
        }
      }

      if (isMountedRef.current) {
        setPreparedFaces(prev => {
          const updated = [...prev];
          if (downloadFailed) {
            updated[i] = {
              ...updated[i],
              videoUrl: null,
              isReady: false,
              status: 'failed',
            };
          } else {
            updated[i] = {
              ...updated[i],
              videoUrl: localVideoUrl,
              isReady: true,
              status: 'ready',
            };
          }
          return updated;
        });
        
        setProgress({ 
          converted: i + 1, 
          total, 
          message: downloadFailed 
            ? `שגיאה בסרטון ${i + 1} מתוך ${total}` 
            : `הוכן סרטון ${i + 1} מתוך ${total}` 
        });
      }
    }

    if (isMountedRef.current) {
      setPreparedFaces(currentFaces => {
        const failedCount = currentFaces.filter(f => f?.status === 'failed').length;
        const readyCount = currentFaces.filter(f => f?.status === 'ready').length;
        
        if (failedCount > 0) {
          console.log(`❌ ${failedCount} videos failed to download`);
          setStatus('error');
          setIsReady(false);
          setProgress({ 
            converted: readyCount, 
            total, 
            message: `${failedCount} סרטונים נכשלו בהורדה`,
            failedCount: failedCount
          });
        } else {
          console.log(`🎬 All ${total} videos prepared and cached locally`);
          setStatus('ready');
          setIsReady(true);
          setProgress({ converted: total, total, message: 'הכל מוכן!', failedCount: 0 });
        }
        
        return currentFaces;
      });
    }
  }, [reflections, maxFaces, shuffleArray]);

  useEffect(() => {
    isMountedRef.current = true;
    if (reflections && reflections.length > 0 && !hasStartedRef.current) {
      prepareAllAssets();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [reflections, prepareAllAssets]);

  const reset = useCallback(() => {
    if (status === 'converting') {
      console.log('⚠️ Cannot reset while converting');
      return;
    }
    hasStartedRef.current = false;
    shuffledOrderRef.current = null;
    reflectionsKeyRef.current = null;
    setStatus('idle');
    setProgress({ converted: 0, total: 0, message: '' });
    setPreparedFaces([]);
    setIsReady(false);
  }, [status]);

  return {
    status,
    progress,
    preparedFaces,
    isReady,
    reset,
    prepareAllAssets,
  };
};

export default useReflectionAssets;
