import type { AppPreferenceStore } from '../app-preference/appPreferenceStore';
import type { AccentColor, Appearance } from '../app-preference/types';

/** Build-time values that were `config('app.*')` / `config('nativephp.*')` in legacy. */
export interface AppBuildConfig {
    appName: string;
    /** Release number, or `DEBUG` for development builds. */
    appVersion: string;
    appVersionCode: string;
    /** Overrides the derived display version when non-blank (ALT_UU_DISPLAY_VERSION). */
    displayVersion?: string | null;
    /** Runtime framework version, shown on the about screen. */
    frameworkVersion: string;
    materialSourceViewerEnabled: boolean;
}

/** Legacy AppConfigViewModel. */
export interface AppConfig {
    appearance: Appearance;
    accentColor: AccentColor;
    nouToolsIntegrationEnabled: boolean;
    screenReaderEnhancedSupportEnabled: boolean;
    altUuPlusDisabled: boolean;
    appName: string;
    appVersion: string;
    appVersionCode: string;
    appDisplayVersion: string;
    frameworkVersion: string;
    materialSourceViewerEnabled: boolean;
}

/** Legacy GetAppConfig. */
export function createAppConfigServices(deps: {
    preferences: AppPreferenceStore;
    buildConfig: AppBuildConfig;
}) {
    return {
        async get(): Promise<AppConfig> {
            const { preferences, buildConfig } = deps;

            return {
                appearance: await preferences.getAppearance(),
                accentColor: await preferences.getAccentColor(),
                nouToolsIntegrationEnabled:
                    await preferences.getNouToolsIntegrationEnabled(),
                screenReaderEnhancedSupportEnabled:
                    await preferences.getScreenReaderEnhancedSupportEnabled(),
                altUuPlusDisabled: await preferences.getAltUuPlusDisabled(),
                appName: buildConfig.appName,
                appVersion: buildConfig.appVersion,
                appVersionCode: buildConfig.appVersionCode,
                appDisplayVersion: resolveDisplayVersion(buildConfig),
                frameworkVersion: buildConfig.frameworkVersion,
                materialSourceViewerEnabled:
                    buildConfig.materialSourceViewerEnabled,
            };
        },
    };
}

export type AppConfigServices = ReturnType<typeof createAppConfigServices>;

export function resolveDisplayVersion(
    buildConfig: Pick<AppBuildConfig, 'displayVersion' | 'appVersion'>,
): string {
    const configured = buildConfig.displayVersion?.trim() ?? '';

    if (configured !== '') {
        return configured;
    }

    return buildConfig.appVersion === 'DEBUG'
        ? buildConfig.appVersion
        : `v${buildConfig.appVersion}`;
}
