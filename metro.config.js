const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude server/ directory — Metro otherwise watches server/temp/ files
// (ffmpeg output, music files, uploads) and hot-reloads on every server write.
config.watchFolders = (config.watchFolders || []).filter(
  (f) => !f.startsWith(path.join(__dirname, 'server'))
);
config.resolver = config.resolver || {};
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  new RegExp(path.join(__dirname, 'server').replace(/\\/g, '\\\\') + '.*'),
];

module.exports = config;
