import { useState, useEffect, useCallback, useRef } from 'react';
import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const VIDEO_CONVERTER_URL = process.env.EXPO_PUBLIC_VIDEO_CONVERTER_URL || 'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000';

const convertedUrlCache = new Map();
const localCacheDir = FileSystem.cacheDirectory + 'videos/';

const PARALLEL_DOWNLOADS = 4;
const MIN_FACES_FOR_READY = 6;

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

const MAX_DOWNLOAD_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadToCache = async (remoteUrl) => {
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
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri, {
        md5: false,
      });
      
      if (downloadResult.status === 200) {
        console.log('✅ Downloaded to cache:', localUri);
        return localUri;
      }
    } catch (error) {
      console.warn(`⚠️ Download attempt ${attempt} error:`, error.message);
    }
    
    if (attempt < MAX_DOWNLOAD_RETRIES) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  
  return null;
};

const needsConversion = (url) => {
  if (!url) return false;
  return url.includes('.webm') || url.includes('webm');
};

const convertVideoUrl = async (originalUrl, reflectionId = null) => {
  if (convertedUrlCache.has(originalUrl)) {
    return convertedUrlCache.get(originalUrl);
  }
  
  try {
    const body = { url: originalUrl };
    if (reflectionId) {
      body.reflectionId = reflectionId;
    }
    
    const response = await fetch(`${VIDEO_CONVERTER_URL}/api/convert-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
  const readyCountRef = useRef(0);
  const hasSetReadyRef = useRef(false);

  const shuffleArray = useCallback((array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const processSingleVideo = useCallback(async (reflection, index, total) => {
    let videoUrl = reflection.videoUrl;
    
    if (reflection.convertedUrl && reflection.conversionStatus === 'ready') {
      console.log(`✅ Using pre-converted URL for video ${index + 1}/${total}`);
      videoUrl = reflection.convertedUrl;
    } else if (needsConversion(videoUrl)) {
      try {
        console.log(`🔄 Converting video ${index + 1}/${total}`);
        videoUrl = await convertVideoUrl(videoUrl, reflection.id);
      } catch (error) {
        console.log(`❌ Conversion failed for video ${index + 1}`);
      }
    }
    
    // TEMP: Skip local caching, use https URLs directly for iOS WebView compatibility
    // iOS WebView blocks file:// URLs even with baseUrl set
    const useLocalCache = false; // Platform.OS !== 'ios';
    let finalVideoUrl = videoUrl;
    
    if (useLocalCache) {
      finalVideoUrl = await downloadToCache(videoUrl);
    }
    
    if (reflection.thumbnailUrl) {
      Image.prefetch(reflection.thumbnailUrl).catch(() => {});
    }

    return {
      index,
      videoUrl: finalVideoUrl || videoUrl,
      usedFallback: !finalVideoUrl,
    };
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
      hasSetReadyRef.current = false;
      readyCountRef.current = 0;
    }
    
    if (hasStartedRef.current) return;
    
    reflectionsKeyRef.current = currentKey;
    hasStartedRef.current = true;
    
    if (isMountedRef.current) {
      setStatus('loading');
    }

    const validReflections = reflections.filter(r => r.videoUrl);
    
    if (!shuffledOrderRef.current) {
      shuffledOrderRef.current = shuffleArray(validReflections);
    }
    const shuffledReflections = shuffledOrderRef.current;

    const total = shuffledReflections.length;
    const minReady = Math.min(MIN_FACES_FOR_READY, total);
    
    if (isMountedRef.current) {
      setProgress({ converted: 0, total, message: `טוען ${total} סרטונים...` });
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
      status: 'loading',
    }));
    
    if (isMountedRef.current) {
      setPreparedFaces([...initialFaces]);
    }

    const updateFace = (index, videoUrl, usedFallback) => {
      if (!isMountedRef.current) return;
      
      readyCountRef.current++;
      const readyCount = readyCountRef.current;
      
      setPreparedFaces(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          videoUrl,
          isReady: true,
          status: 'ready',
          usedFallback,
        };
        return updated;
      });
      
      setProgress({ 
        converted: readyCount, 
        total, 
        message: readyCount >= total ? 'הכל מוכן!' : `טוען סרטון ${readyCount} מתוך ${total}...`
      });
      
      if (!hasSetReadyRef.current && readyCount >= minReady) {
        console.log(`🚀 ${minReady} videos ready - showing cube!`);
        hasSetReadyRef.current = true;
        setIsReady(true);
        setStatus('ready');
      }
      
      if (readyCount >= total) {
        console.log(`🎬 All ${total} videos loaded`);
        setStatus('ready');
      }
    };

    const queue = shuffledReflections.map((r, i) => ({ reflection: r, index: i }));
    let activeCount = 0;
    let queueIndex = 0;

    const processNext = async () => {
      while (queueIndex < queue.length && activeCount < PARALLEL_DOWNLOADS) {
        const item = queue[queueIndex++];
        activeCount++;
        
        processSingleVideo(item.reflection, item.index, total)
          .then(result => {
            updateFace(result.index, result.videoUrl, result.usedFallback);
            activeCount--;
            processNext();
          })
          .catch(error => {
            console.error(`Error processing video ${item.index}:`, error);
            updateFace(item.index, item.reflection.videoUrl, true);
            activeCount--;
            processNext();
          });
      }
    };

    processNext();
  }, [reflections, maxFaces, shuffleArray, processSingleVideo]);

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
    hasSetReadyRef.current = false;
    readyCountRef.current = 0;
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
