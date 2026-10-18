import {
  JsLogBuffer,
  LocalStoreBilling,
  createAccountServices,
  createCourseServices,
  createHunguMaterialContentClient,
  createActivityServices,
  createAppConfigServices,
  createAppPreferenceServices,
  createAppStatusServices,
  createAuthServices,
  createDataPortabilityServices,
  createDiagnosticsServices,
  createDiscussServices,
  createHunguServices,
  createMaterialPreferenceServices,
  createModerationServices,
  createNouToolsServices,
  createPlaybackServices,
  createSchoolPortalDomainServices,
  createSchoolPortalServices,
  createStorageServices,
  createStudyTimeServices,
  createSubscriptionServices,
  defaultHunguConfig,
  defaultSchoolPortalConfig,
  sanitizeDiscussHtml,
  type AppBuildConfig,
  type CourseServices,
  type NouToolsUserCourse,
  type SchoolPortalCourseRef,
  type StoreBilling,
  type StudyTimeRecordedEvent,
} from '@altuu/core';
import type { AppServices } from '@altuu/features';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  createPlatform,
  fetch,
  getDeviceInfo,
  nativePhpBridge,
  runLegacyMigrationIfNeeded,
} from './platform';

/** Same rule as legacy `.github/actions/setup-nativephp-build`: RC / beta → true. */
const materialSourceViewerEnabled =
  Constants.expoConfig?.extra?.materialSourceViewerEnabled === true;

function readBuildConfig(): AppBuildConfig {
  const extra = Constants.expoConfig?.extra ?? {};
  const sdkVersion = Constants.expoConfig?.sdkVersion;

  return {
    appName: Constants.expoConfig?.name ?? 'Alt UU',
    // Development builds report DEBUG, which also suppresses the update
    // banners (legacy `config('nativephp.version')`).
    appVersion: __DEV__ ? 'DEBUG' : (Constants.expoConfig?.version ?? 'DEBUG'),
    appVersionCode: getDeviceInfo().buildNumber ?? 'unknown',
    displayVersion:
      typeof extra.displayVersion === 'string' ? extra.displayVersion : null,
    frameworkVersion: `Expo SDK ${sdkVersion ?? '?'} / React Native ${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}`,
    materialSourceViewerEnabled,
  };
}

/** Mirrors warnings and errors into the diagnostic bundle's log tail. */
function tapConsole(buffer: JsLogBuffer): void {
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
      buffer.log(level, args.map(String).join(' '));
      original(...args);
    };
  }
}

async function createBilling(): Promise<StoreBilling> {
  if (__DEV__ && process.env.EXPO_PUBLIC_USE_STORE_BILLING !== '1') {
    return new LocalStoreBilling();
  }

  const { ExpoIapBilling } = await import('./platform/iap');

  return new ExpoIapBilling();
}

let creating: Promise<AppServices> | null = null;

/**
 * Builds every service of the app. The order matters:
 *
 * 1. platform (database opened and migrated), storage;
 * 2. the NativePHP legacy data migration, before anything reads accounts;
 * 3. diagnostics, so its `upstreamListener` can be handed to every HTTP stack;
 * 4. the HUNGU / school portal stacks and the domains on top of them.
 *
 * Concurrent calls share one run; a failed run can be retried.
 */
export function createAppServices(): Promise<AppServices> {
  creating ??= build().catch((error: unknown) => {
    creating = null;
    throw error;
  });

  return creating;
}

async function build(): Promise<AppServices> {
  const platform = await createPlatform();
  const { db, clock, random, secureStorage } = platform;
  const storage = createStorageServices({
    db,
    secureStorage,
    random,
    clock,
  });
  const logBuffer = new JsLogBuffer();

  tapConsole(logBuffer);

  await runLegacyMigrationIfNeeded({
    db,
    clock,
    cipher: storage.cipher,
    keyValues: storage.keyValues,
    bridge: nativePhpBridge,
    logger: logBuffer,
  });

  const deviceInfo = getDeviceInfo();
  const buildConfig = readBuildConfig();
  // Late-bound: the course domain needs services that are built after
  // diagnostics, HUNGU and the school portal.
  // eslint-disable-next-line prefer-const -- assigned once, after its users are built
  let course: CourseServices;
  const diagnostics = await createDiagnosticsServices({
    db,
    keyValues: storage.keyValues,
    clock,
    random,
    fetch,
    deviceInfo: getDeviceInfo,
    logBuffer,
    materialSourceViewerEnabled,
    materialSource: () => ({
      courseClient: hungu.course,
      // The course service resolves and checks the session host itself.
      parseMaterialContent: async (url) => {
        const parsed = await course.getParsedMaterialContent(url);

        return { ...parsed, htmlContent: parsed.htmlContent ?? '' };
      },
      syncCurrentCourse: (cid) => course.syncCurrentCourse(cid, true),
      resolveBaseHost: async () => {
        const baseUrl = (await storage.hunguSessions.get())?.baseUrl;

        try {
          return typeof baseUrl === 'string' && baseUrl !== ''
            ? new URL(baseUrl).host
            : null;
        } catch {
          return null;
        }
      },
    }),
  });
  const onUpstreamCall = diagnostics.upstreamListener;

  const hungu = createHunguServices({
    fetch,
    config: { ...defaultHunguConfig, debug: __DEV__ },
    sessionStore: storage.hunguSessions,
    accounts: storage.credentials,
    activeAccount: storage.activeProfile,
    onUpstreamCall,
    afterRememberedLogin: (accountId) => course.afterRememberedLogin(accountId),
    onError: (error) => console.warn('HUNGU session error', error),
  });

  storage.accounts.setHooks({
    attemptRememberedLogin: () => hungu.authenticator.attemptRememberedLogin(),
    attemptLogin: async (username, password) => {
      const result = await hungu.authenticator.attemptLogin(username, password);

      return { ok: result.ok, message: result.message };
    },
  });

  const schoolPortal = createSchoolPortalServices({
    fetch,
    config: defaultSchoolPortalConfig,
    sessionStore: storage.schoolPortalSessions,
    credentialsStore: storage.credentials,
    onUpstreamCall,
  });

  const listSchoolPortalCourses = async (): Promise<SchoolPortalCourseRef[]> =>
    (await course.listCourses()).map((item) => ({
      courseId: item.courseId,
      name: item.name,
      semester: item.semester ?? '',
    }));
  const listNouToolsUserCourses = async (
    accountId: number | null,
  ): Promise<NouToolsUserCourse[]> =>
    (
      await course.listCourses(accountId === null ? undefined : { accountId })
    ).map((item) => ({
      courseId: item.courseId,
      name: item.name,
      semester: item.semester,
      className: item.className,
    }));

  const schoolPortalDomain = createSchoolPortalDomainServices({
    client: schoolPortal.client,
    cache: storage.cache,
    getProfileUsername: async () => {
      const session = await storage.hunguSessions.get();
      const profile = session?.profile as { username?: unknown } | undefined;

      return typeof profile?.username === 'string' ? profile.username : null;
    },
    portalBaseUrl: defaultSchoolPortalConfig.baseUrl,
    listCourses: listSchoolPortalCourses,
  });
  course = createCourseServices({
    client: hungu.course,
    materialContent: createHunguMaterialContentClient({
      hungu: hungu.client,
      fetch,
      onUpstreamCall,
    }),
    cache: storage.cache,
    activeAccount: storage.activeProfile,
    hunguSessionStore: storage.hunguSessions,
    db,
    getSchoolPortalHomeworkNotices: (item) =>
      schoolPortalDomain.getSchoolPortalHomeworkNotices({
        courseId: item.courseId,
        name: item.name,
        semester: item.semester ?? '',
      }),
    onError: (error) => console.warn('Course error', error),
  });

  const moderation = createModerationServices({
    db,
    keyValues: storage.keyValues,
    clock,
    fetch,
    random,
    onUpstreamCall,
  });
  const discuss = createDiscussServices({
    client: hungu.discuss,
    db,
    sanitizeHtml: sanitizeDiscussHtml,
  });

  // The subscription and the preference store depend on each other
  // (accent colour is a paid perk; a lapsed subscription resets it), so the
  // entitlement check is resolved lazily.
  // eslint-disable-next-line prefer-const -- assigned once, after its users are built
  let subscriptionServices: ReturnType<typeof createSubscriptionServices>;
  const isSubscriptionActive = async (): Promise<boolean> =>
    (await subscriptionServices.getCachedEntitlement()).active;

  const appPreference = createAppPreferenceServices({
    keyValues: storage.keyValues,
    isSubscriptionActive,
  });
  subscriptionServices = createSubscriptionServices({
    billing: await createBilling(),
    fetch,
    keyValues: storage.keyValues,
    clock,
    onUpstreamCall,
    resetPaidPreferences: async () => {
      if ((await appPreference.store.getAccentColor()) !== 'warm') {
        await appPreference.store.setAccentColor('warm');
      }
    },
  });

  const account = createAccountServices({
    db,
    credentials: storage.credentials,
    activeProfile: storage.activeProfile,
    hunguSessions: storage.hunguSessions,
    authenticator: hungu.authenticator,
    forgetDiagnosticLog: () => diagnostics.forgetLog(),
  });
  const auth = createAuthServices({
    authenticator: hungu.authenticator,
    hunguSessions: storage.hunguSessions,
    credentials: storage.credentials,
    activeProfile: storage.activeProfile,
    cache: storage.cache,
    getNouToolsIntegrationEnabled: () =>
      appPreference.store.getNouToolsIntegrationEnabled(),
    forgetDiagnosticLog: ({ stopRecording }) =>
      diagnostics.forgetLog(stopRecording),
  });

  const studyTime = createStudyTimeServices({
    db,
    activeProfile: storage.activeProfile,
    studyTime: hungu.studyTime,
    clock,
    onStudyTimeRecorded: (event: StudyTimeRecordedEvent) =>
      course.clearCoursePathInfoCache(event.accountId, event.cid),
  });

  return {
    storage,
    course,
    diagnostics,
    hungu,
    schoolPortal,
    schoolPortalDomain,
    discuss,
    moderation,
    account,
    auth,
    studyTime,
    playback: createPlaybackServices({
      db,
      activeProfile: storage.activeProfile,
    }),
    activity: createActivityServices({
      db,
      activeProfile: storage.activeProfile,
      credentials: storage.credentials,
      clock,
    }),
    dataPortability: createDataPortabilityServices({
      db,
      clock,
      isSubscriptionActive,
    }),
    appPreference,
    materialPreference: createMaterialPreferenceServices({
      keyValues: storage.keyValues,
    }),
    appConfig: createAppConfigServices({
      preferences: appPreference.store,
      buildConfig,
    }),
    appStatus: createAppStatusServices({
      fetch,
      cache: storage.cache,
      keyValues: storage.keyValues,
      clock,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      appVersion: buildConfig.appVersion,
      onUpstreamCall,
    }),
    nouTools: createNouToolsServices({
      fetch,
      cache: storage.cache,
      credentials: storage.credentials,
      activeAccountId: () => storage.activeProfile.get(),
      hunguSessions: storage.hunguSessions,
      isIntegrationEnabled: () =>
        appPreference.store.getNouToolsIntegrationEnabled(),
      listUserCourses: listNouToolsUserCourses,
      onUpstreamCall,
      onError: (error) => console.warn('NouTools error', error),
    }),
    subscription: subscriptionServices,
    buildConfig,
    deviceInfo,
  };
}
