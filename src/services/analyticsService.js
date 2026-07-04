/**
 * analyticsService — abstraction layer for usage analytics.
 *
 * All event logging goes through this module.
 * No screen or component should write directly to Firestore.
 *
 * Current provider: Firestore (_analytics collection).
 * To switch provider (Firebase Analytics, Mixpanel, Amplitude):
 *   1. Replace _writeEvent() with the new provider's logEvent call.
 *   2. Keep the public API (appOpen, storyCreated, …) unchanged.
 *   3. To run two providers simultaneously, call both inside _writeEvent().
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { db } from './firebase';

// ─── configuration ──────────────────────────────────────────────────────────
// Set to false to disable all analytics silently (dev builds, testing, privacy).
// Can also be driven by an env var: EXPO_PUBLIC_ENABLE_ANALYTICS=false
const ENABLE_ANALYTICS =
  process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false';

// Increment when the event schema changes — lets you filter old/new events.
const ANALYTICS_SCHEMA_VERSION = 1;

// ─── auto-attached context (computed once at startup) ───────────────────────

const APP_VERSION =
  Constants.expoConfig?.version ||
  Constants.manifest?.version ||
  'unknown';

const APP_BUILD =
  Constants.expoConfig?.ios?.buildNumber ||
  Constants.expoConfig?.android?.versionCode?.toString() ||
  Constants.manifest?.ios?.buildNumber ||
  'unknown';

const PLATFORM = Platform.OS; // 'ios' | 'android' | 'web'

const ENVIRONMENT = (() => {
  const channel = Constants.expoConfig?.updates?.channel || Constants.manifest?.releaseChannel || '';
  if (channel === 'production') return 'production';
  if (channel === 'preview')    return 'preview';
  return 'development';
})();

/** Fields automatically included in every event — no screen code needed. */
const _baseProps = () => ({
  schema_v:    ANALYTICS_SCHEMA_VERSION,
  platform:    PLATFORM,
  app_version: APP_VERSION,
  app_build:   APP_BUILD,
  environment: ENVIRONMENT,
});

/**
 * Write a single event document to _analytics/{auto-id}.
 * Silent fail — analytics must never crash the app.
 *
 * @param {string} event   - snake_case event name
 * @param {object} params  - additional metadata (no PII)
 */
const _writeEvent = async (event, params = {}) => {
  if (!ENABLE_ANALYTICS) return;
  try {
    if (!db) return;
    await addDoc(collection(db, '_analytics'), {
      event,
      ..._baseProps(),
      ts: serverTimestamp(),
      ...params,
    });
  } catch (_) {
    // Silently swallow — never throw from analytics
  }
};

// ─── public API ─────────────────────────────────────────────────────────────
// Change _writeEvent() above to switch providers; keep this API unchanged.

export const analyticsService = {

  /** App launched / foregrounded */
  appOpen: () =>
    _writeEvent('app_open'),

  /** Creator created a new story */
  storyCreated: (storyId) =>
    _writeEvent('story_created', { storyId }),

  /** Player pressed record for the first clip */
  recordingStarted: (storyId) =>
    _writeEvent('recording_started', { storyId }),

  /** Player successfully submitted all clips */
  clipSubmitted: (storyId, clipCount = null) =>
    _writeEvent('clip_submitted', { storyId, clipCount }),

  /** Creator shared the story invite link */
  inviteSent: (storyId) =>
    _writeEvent('invite_sent', { storyId }),

  /** Final mixed video is ready (status → completed) */
  finalMovieReady: (storyId) =>
    _writeEvent('final_movie_ready', { storyId }),

  /** Watch-through completed (onPlaybackComplete fired, not recording mode) */
  movieWatched: (storyId) =>
    _writeEvent('movie_watched', { storyId }),

  /** Creator tapped share */
  shareClicked: (storyId, method = 'link') =>
    _writeEvent('share_clicked', { storyId, method }),
};
