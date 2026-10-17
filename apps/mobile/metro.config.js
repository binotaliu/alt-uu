const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 52+ configures watchFolders and nodeModulesPaths for npm
// workspaces automatically, so only NativeWind needs to be wired in here.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
