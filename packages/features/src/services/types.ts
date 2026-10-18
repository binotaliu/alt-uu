import type {
  AccountServices,
  AppBuildConfig,
  CourseServices,
  AppConfigServices,
  AppPreferenceServices,
  AppStatusServices,
  AuthServices,
  DeviceInfo,
  DiagnosticsServices,
  HunguServices,
  MaterialPreferenceServices,
  ModerationServices,
  SchoolPortalDomainServices,
  SchoolPortalServices,
  StorageServices,
  SubscriptionServices,
  createActivityServices,
  createDataPortabilityServices,
  createDiscussServices,
  createNouToolsServices,
  createPlaybackServices,
  createStudyTimeServices,
} from '@altuu/core';

export type DiscussServices = ReturnType<typeof createDiscussServices>;
export type StudyTimeServices = ReturnType<typeof createStudyTimeServices>;
export type PlaybackServices = ReturnType<typeof createPlaybackServices>;
export type ActivityServices = ReturnType<typeof createActivityServices>;
export type DataPortabilityServices = ReturnType<
  typeof createDataPortabilityServices
>;
export type NouToolsServices = ReturnType<typeof createNouToolsServices>;

/**
 * Everything the UI can call, built once by the app's composition root
 * (apps/mobile/src/compositionRoot.ts) and handed to `AppServicesProvider`.
 * Screens never import platform code; they get these through hooks.
 *
 */
export interface AppServices {
  storage: StorageServices;
  /** Courses, path info, materials, homework, self exams, learning times. */
  course: CourseServices;
  diagnostics: DiagnosticsServices;
  hungu: HunguServices;
  schoolPortal: SchoolPortalServices;
  schoolPortalDomain: SchoolPortalDomainServices;
  discuss: DiscussServices;
  moderation: ModerationServices;
  account: AccountServices;
  auth: AuthServices;
  studyTime: StudyTimeServices;
  playback: PlaybackServices;
  activity: ActivityServices;
  dataPortability: DataPortabilityServices;
  appPreference: AppPreferenceServices;
  materialPreference: MaterialPreferenceServices;
  appConfig: AppConfigServices;
  appStatus: AppStatusServices;
  nouTools: NouToolsServices;
  subscription: SubscriptionServices;
  /** Build-time values (also served by `appConfig.get()`). */
  buildConfig: AppBuildConfig;
  deviceInfo: DeviceInfo;
}

export type {
  AccountServices,
  AppConfigServices,
  AppPreferenceServices,
  AppStatusServices,
  AuthServices,
  MaterialPreferenceServices,
  ModerationServices,
  SubscriptionServices,
};
