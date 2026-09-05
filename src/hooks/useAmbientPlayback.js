import { useState, useRef, useEffect, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const BASE_URL = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library`;

export const useAmbientPlayback = (trackId, directUrl = null) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [error, setError] = useState(null);
  const soundRef = useRef(null);
  const soundIdRef = useRef(0);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(console.warn);

    return () => {
      isUnmountedRef.current = true;
      unloadSound();
    };
  }, []);

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        soundRef.current.remove();
      } catch (e) {}
      soundRef.current = null;
    }
  };

  const getPhaseUrl = (phaseNumber) => {
    if (directUrl) return directUrl;
    if (!trackId || trackId === 'none') return null;
    return `${BASE_URL}/${trackId}/phase${phaseNumber}.mp3`;
  };

  const playPhase = useCallback(async (phaseNumber, volume = 0.2, duringRecording = false) => {
    if (!directUrl && (!trackId || trackId === 'none')) return;

    const url = getPhaseUrl(phaseNumber);
    if (!url) return;

    const loadUrl = (uri) => {
      const player = createAudioPlayer({ uri });
      player.loop = true;
      player.volume = volume;
      player.play();
      return player;
    };

    try {
      await unloadSound();
      soundIdRef.current += 1;

      await setAudioModeAsync({
        allowsRecording: duringRecording,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      }).catch(() => {});

      console.log(`🎵 Loading ambient phase ${phaseNumber}: ${trackId} vol=${volume}`);

      let sound;
      try {
        sound = loadUrl(url);
      } catch (loadErr) {
        if (phaseNumber !== 1) {
          console.warn(`⚠️ phase${phaseNumber} failed, falling back to phase1`);
          const fallbackUrl = getPhaseUrl(1);
          sound = loadUrl(fallbackUrl);
        } else {
          throw loadErr;
        }
      }

      if (isUnmountedRef.current) {
        sound.remove();
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
  }, [trackId, directUrl]);

  const stop = useCallback(async () => {
    await unloadSound();
    // Reset audio session so WebView video 'onended' events fire correctly on iOS
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
    setIsPlaying(false);
    setCurrentPhase(null);
  }, []);

  const fadeOut = useCallback(async (durationMs = 1500) => {
    const fadingSound = soundRef.current;
    if (!fadingSound) return;

    const fadeId = soundIdRef.current;
    soundRef.current = null;
    setIsPlaying(false);
    setCurrentPhase(null);

    try {
      const steps = 15;
      const stepTime = durationMs / steps;
      const startVolume = fadingSound.volume || 0.3;

      for (let i = steps; i >= 0; i--) {
        if (isUnmountedRef.current || fadeId !== soundIdRef.current) break;
        try {
          fadingSound.volume = (startVolume * i) / steps;
        } catch (e) { break; }
        await new Promise(r => setTimeout(r, stepTime));
      }

      try {
        fadingSound.remove();
      } catch (e) {}
    } catch (e) {
      try {
        fadingSound.remove();
      } catch (e2) {}
    }
    // Only reset audio session if no new sound was started after this fade began
    if (fadeId === soundIdRef.current) {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      }).catch(() => {});
    }
  }, []);

  const setVolume = useCallback(async (volume) => {
    if (soundRef.current) {
      try { soundRef.current.volume = volume; } catch (e) {}
    }
  }, []);

  // Returns current playback position in milliseconds (without restarting)
  const getCurrentPositionMs = useCallback(async () => {
    if (!soundRef.current) return 0;
    try {
      return (soundRef.current.currentTime || 0) * 1000;
    } catch (e) {
      return 0;
    }
  }, []);

  // Switch audio routing mode + volume without restarting playback.
  // duringRecording=true routes output to earpiece on iOS (mic won't pick it up).
  const setVolumeAndMode = useCallback(async (volume, duringRecording = false) => {
    await setAudioModeAsync({
      allowsRecording: duringRecording,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
    if (soundRef.current) {
      try { soundRef.current.volume = volume; } catch (e) {}
    }
  }, []);

  return {
    playPhase,
    stop,
    fadeOut,
    setVolume,
    getCurrentPositionMs,
    setVolumeAndMode,
    isPlaying,
    isLoaded,
    currentPhase,
    error,
    hasTrack: !!directUrl || (!!trackId && trackId !== 'none'),
  };
};
