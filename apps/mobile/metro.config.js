const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 52+ configures watchFolders and nodeModulesPaths for npm
// workspaces automatically, so only NativeWind needs to be wired in here.
const config = getDefaultConfig(__dirname);

// NativeWind's native default is 1rem = 14px; the legacy WebView used 16px, so
// every rem-based class (text-sm, w-12, ...) came out ~12% smaller than parity.
module.exports = withNativeWind(config, {
  input: './src/global.css',
  inlineRem: 16,
});
