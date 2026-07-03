/**
 * Expo config plugin — injects PrivacyInfo.xcprivacy into the iOS project.
 *
 * Required by Apple since May 2024 for all App Store submissions.
 * Run automatically by EAS Build during the prebuild phase.
 *
 * APIs declared here (verified against source code 2026-07-02):
 *   • UserDefaults (CA92.1)  — AsyncStorage used by expo-localization / Firebase Auth
 *   • FileTimestamp (0A2A.1) — expo-file-system createDownloadResumable
 *   • FileTimestamp (3B52.1) — expo-file-system / expo-av temp files
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- No tracking, no fingerprinting -->
  <key>NSPrivacyTracking</key>
  <false/>

  <!-- No data types collected by us (Firebase SDK may collect separately) -->
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>

  <!-- Required API reasons -->
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- UserDefaults: CA92.1 — used by AsyncStorage (expo-localization, Firebase Auth) -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <!-- FileTimestamp: 0A2A.1 — used by expo-file-system for download tasks -->
    <!-- FileTimestamp: 3B52.1 — used by expo-file-system / expo-av temp file I/O -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>0A2A.1</string>
        <string>3B52.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
`;

module.exports = function withPrivacyManifest(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios', config.modRequest.projectName);

      // iosDir may not exist in managed workflow until EAS prebuild creates it.
      // We create it defensively so the plugin never fails.
      if (!fs.existsSync(iosDir)) {
        fs.mkdirSync(iosDir, { recursive: true });
      }

      const manifestPath = path.join(iosDir, 'PrivacyInfo.xcprivacy');
      fs.writeFileSync(manifestPath, PRIVACY_MANIFEST, 'utf8');
      console.log('[withPrivacyManifest] PrivacyInfo.xcprivacy written to', manifestPath);

      return config;
    },
  ]);
};
