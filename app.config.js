// Dynamic Expo config — reads EXPO_PUBLIC_* from .env at Metro startup.
// Expo prefers this file over app.json when both exist.
// app.json is kept as the static base; this file adds the `extra` block.

module.exports = ({ config }) => ({
  ...config,
  extra: {
    // Server URL injected into Constants.expoConfig.extra for files that
    // use that channel (storageService.js, ProcessingScreen.js).
    // Set EXPO_PUBLIC_API_URL in .env to your machine's LAN IP, e.g.:
    //   EXPO_PUBLIC_API_URL=http://192.168.1.42:5000
    videoConverterUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      'https://ac75ad19-6da1-4ed8-b143-f23166e3ed4a-00-3fswsn9l8v0l5.picard.replit.dev:5000',

    // Domain used by WhatsAppShareScreen to build share links.
    // For local dev: your LAN IP + port (e.g. "192.168.1.42:5000").
    // For production: keep the Replit domain.
    webPlayerDomain:
      process.env.EXPO_PUBLIC_WEB_PLAYER_DOMAIN ||
      'reflectly-mobile-x--yaronbenm1.replit.app',
  },
});
