/**
 * useWaitingMusic — plays ambient tracks in random rotation during long waits.
 * Cycles through all 11 tracks (no repeats until all played), switches every 90s.
 * Volume: soft (0.22) — background only, not distracting.
 */
import { useRef, useEffect, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

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
  const soundIdRef = useRef(0); // generation counter — prevents stale loads from playing

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
        soundRef.current.pause(); // stop audio output immediately before releasing
        soundRef.current.remove();
      } catch (_) {}
      soundRef.current = null;
    }
  };

  const playNext = useCallback(async () => {
    if (!activeRef.current) return;
    await stopCurrent();

    soundIdRef.current += 1;
    const myId = soundIdRef.current;

    const trackId = getNextTrackId();
    const url = `https://storage.googleapis.com/${STORAGE_BUCKET}/music/library/${trackId}/phase1.mp3`;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      }).catch((e) => console.warn('⚠️ setAudioMode error:', e.message));

      const player = createAudioPlayer({ uri: url });
      player.loop = true;
      player.volume = 0.22;
      player.play();

      if (!activeRef.current || soundIdRef.current !== myId) {
        try { player.pause(); } catch (_) {}
        player.remove();
        return;
      }

      soundRef.current = player;
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
    // Reset audio session so the AI/ambient music can start cleanly
    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
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
