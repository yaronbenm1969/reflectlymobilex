import { useState, useEffect, useRef, useCallback } from 'react';
import { Video } from 'expo-av';
import * as THREE from 'three';

export const useCubeVideoTextures = (preparedFaces, isReady) => {
  const [texturesReady, setTexturesReady] = useState(false);
  const [textureData, setTextureData] = useState([]);
  const videoRefs = useRef([]);
  const texturesRef = useRef([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      texturesRef.current.forEach(t => t?.dispose?.());
      texturesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isReady || !preparedFaces || preparedFaces.length === 0) {
      return;
    }

    const validFaces = preparedFaces.filter(f => f && f.videoUrl);
    
    if (validFaces.length === 0) {
      console.log('⚠️ No valid faces with video URLs');
      return;
    }

    console.log(`🎬 Preparing ${validFaces.length} video textures`);

    const data = validFaces.map((face, index) => ({
      index,
      videoUrl: face.videoUrl,
      playerName: face.playerName,
      duration: 5000,
      isLoaded: false,
    }));

    setTextureData(data);
    setTexturesReady(true);
    console.log(`✅ Video texture data prepared for ${data.length} faces`);

  }, [isReady, preparedFaces]);

  const playFaceVideo = useCallback(async (faceIndex) => {
    const videoRef = videoRefs.current[faceIndex];
    if (videoRef) {
      try {
        await videoRef.setPositionAsync(0);
        await videoRef.playAsync();
        console.log(`▶️ Playing video on face ${faceIndex}`);
      } catch (error) {
        console.log(`❌ Failed to play video on face ${faceIndex}:`, error);
      }
    }
  }, []);

  const pauseFaceVideo = useCallback(async (faceIndex) => {
    const videoRef = videoRefs.current[faceIndex];
    if (videoRef) {
      try {
        await videoRef.pauseAsync();
        console.log(`⏸️ Paused video on face ${faceIndex}`);
      } catch (error) {
        console.log(`❌ Failed to pause video on face ${faceIndex}:`, error);
      }
    }
  }, []);

  const resetFaceVideo = useCallback(async (faceIndex) => {
    const videoRef = videoRefs.current[faceIndex];
    if (videoRef) {
      try {
        await videoRef.stopAsync();
        await videoRef.setPositionAsync(0);
      } catch (error) {
        console.log(`❌ Failed to reset video on face ${faceIndex}`);
      }
    }
  }, []);

  const setVideoRef = useCallback((index, ref) => {
    videoRefs.current[index] = ref;
  }, []);

  const updateDuration = useCallback((index, duration) => {
    setTextureData(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], duration, isLoaded: true };
      }
      return updated;
    });
  }, []);

  return {
    texturesReady,
    textureData,
    playFaceVideo,
    pauseFaceVideo,
    resetFaceVideo,
    setVideoRef,
    updateDuration,
    videoRefs,
  };
};

export default useCubeVideoTextures;
