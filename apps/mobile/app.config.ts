import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Legacy NativePHP identifiers. The iOS bundle id uses a hyphen while the
 * Android package must use an underscore (hyphens are not valid in Java
 * package names). Both are kept so the RN build ships as an in-place update.
 */
const IOS_BUNDLE_IDENTIFIER = 'org.binota.alt-uu';
const ANDROID_PACKAGE = 'org.binota.alt_uu';
const LEGACY_VERSION = '2.0.0';

const parseOptionalInteger = (
  value: string | undefined,
): number | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? undefined : parsed;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const version = process.env.APP_VERSION || LEGACY_VERSION;
  const buildNumber = parseOptionalInteger(process.env.APP_BUILD_NUMBER);

  return {
    ...config,
    name: 'Alt UU',
    slug: 'alt-uu',
    version,
    scheme: 'altuu',
    orientation: 'default',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
      buildNumber: buildNumber === undefined ? undefined : String(buildNumber),
      supportsTablet: true,
      infoPlist: {
        CFBundleDevelopmentRegion: 'zh-Hant-TW',
        LSApplicationQueriesSchemes: ['tronclass'],
        UIBackgroundModes: ['audio'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: ANDROID_PACKAGE,
      versionCode: buildNumber,
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/images/adaptive-icon-foreground.png',
      },
      predictiveBackGestureEnabled: true,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-logo.png',
          imageWidth: 240,
          backgroundColor: '#ececec',
          dark: { backgroundColor: '#181818' },
        },
      ],
      [
        'expo-video',
        {
          supportsPictureInPicture: true,
          supportsBackgroundPlayback: true,
        },
      ],
      'expo-iap',
      'expo-secure-store',
      'expo-sqlite',
      'expo-screen-orientation',
      'expo-sharing',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      materialSourceViewerEnabled:
        process.env.EXPO_PUBLIC_MATERIAL_SOURCE_VIEWER_ENABLED === 'true',
      displayVersion: process.env.EXPO_PUBLIC_DISPLAY_VERSION || `v${version}`,
    },
  };
};
