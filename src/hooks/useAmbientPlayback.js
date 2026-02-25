import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const BASE_URL = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library`;

export const useAmbientPlayback = (trackId) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [error, setError] = useState(null);
  const soundRef = useRef(null);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(console.warn);

    return () => {
      isUnmountedRef.current = true;
      unloadSound();
    };
  }, []);

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  };

  const getPhaseUrl = (phaseNumber) => {
    if (!trackId || trackId === 'none') return null;
    return `${BASE_URL}/${trackId}/phase${phaseNumber}.mp3`;
  };

  const playPhase = useCallback(async (phaseNumber) => {
    if (!trackId || trackId === 'none') return;

    const url = getPhaseUrl(phaseNumber);
    if (!url) return;

    try {
      await unloadSound();

      console.log(`🎵 Loading ambient phase ${phaseNumber}: ${trackId}`);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.3,
        }
      );

      if (isUnmountedRef.current) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      setCurrentPhase(phaseNumber);
      setIsPlaying(true);
      setIsLoaded(true);
      setError(null);
      console.log(`🎵 Playing ambient phase ${phaseNumber}`);
    } catch (err) {
      console.error(`❌ Ambient playback error:`, err.message);
      setError(err.message);
      setIsPlaying(false);
    }
  }, [trackId]);

  const stop = useCallback(async () => {
    await unloadSound();
    setIsPlaying(false);
    setCurrentPhase(null);
  }, []);

  const fadeOut = useCallback(async (durationMs = 1500) => {
    if (!soundRef.current) return;

    try {
      const steps = 15;
      const stepTime = durationMs / steps;
      const status = await soundRef.current.getStatusAsync();
      const startVolume = status.isLoaded ? status.volume : 0.3;

      for (let i = steps; i >= 0; i--) {
        if (isUnmountedRef.current || !soundRef.current) break;
        await soundRef.current.setVolumeAsync((startVolume * i) / steps);
        await new Promise(r => setTimeout(r, stepTime));
      }

      await stop();
    } catch (e) {
      await stop();
    }
  }, [stop]);

  return {
    playPhase,
    stop,
    fadeOut,
    isPlaying,
    isLoaded,
    currentPhase,
    error,
    hasTrack: !!trackId && trackId !== 'none',
  };
};
