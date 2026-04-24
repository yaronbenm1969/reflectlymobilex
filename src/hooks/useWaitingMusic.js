/**
 * useWaitingMusic — plays ambient tracks in random rotation during long waits.
 * Cycles through all 11 tracks (no repeats until all played), switches every 90s.
 * Volume: soft (0.22) — background only, not distracting.
 */
import { useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

const STORAGE_BUCKET = 'reflectly-playback.firebasestorage.app';
const TRACK_IDS = [
  'reflective-space',
  'gentle-warmth',
  'soft-hope',
  'tender-vulnerability',
  'quiet-strength',
  'light-movement',
  'floating-memory',
  'subtle-uplift',
  'open-horizon',
  'electric-pulse',
  'world-celebration',
];
const SWITCH_AFTER_MS = 90_000; // switch track after 90 seconds

export function useWaitingMusic() {
  const soundRef = useRef(null);
  const timerRef = useRef(null);
  const usedRef = useRef([]);
  const activeRef = useRef(false);
  const playNextRef = useRef(null); // stored so timer can call without stale closure

  const getNextTrackId = () => {
    if (usedRef.current.length >= TRACK_IDS.length) {
      usedRef.current = [];
    }
    const remaining = TRACK_IDS.filter((id) => !usedRef.current.includes(id));
    const picked = remaining[Math.floor(Math.random() * remaining.length)];
    usedRef.current.push(picked);
    return picked;
  };

  const stopCurrent = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
    }
  };

  const playNext = useCallback(async () => {
    if (!activeRef.current) return;
    await stopCurrent();

    const trackId = getNextTrackId();
    const url = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library/${trackId}/phase1.mp3`;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch((e) => console.warn('⚠️ setAudioMode error:', e.message));

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.22, isLooping: true }
      );

      if (!activeRef.current) {
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
      console.log(`🎵 Waiting music: ${trackId}`);

      // Schedule switch to next track
      timerRef.current = setTimeout(() => {
        if (activeRef.current && playNextRef.current) playNextRef.current();
      }, SWITCH_AFTER_MS);
    } catch (err) {
      console.warn('⚠️ useWaitingMusic error:', err.message);
      // Retry with different track after 5s
      timerRef.current = setTimeout(() => {
        if (activeRef.current && playNextRef.current) playNextRef.current();
      }, 5_000);
    }
  }, []);

  // Keep ref current so timer callback always uses latest version
  playNextRef.current = playNext;

  const start = useCallback(async () => {
    activeRef.current = true;
    usedRef.current = [];
    await playNext();
  }, [playNext]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    await stopCurrent();
    console.log('🔇 Waiting music stopped');
  }, []);

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopCurrent();
    };
  }, []);

  return { start, stop };
}
