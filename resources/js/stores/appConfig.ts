import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { apiFetch, bootstrapSession } from '@/composables/useApi';
import { DEFAULT_ACCENT, isAccentId } from '@/lib/accents';
import type { AccentId } from '@/lib/accents';
import { setNativeAccentColor } from '@/lib/nativeAccent';
import { useModerationStore } from '@/stores/moderation';

interface AppConfig {
    appearance: string;
    accentColor: string;
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

interface SessionProfile {
    displayName: string | null;
    nickname: string | null;
    picture: string | null;
    username: string | null;
}

export interface AppPreferences {
    appearance: 'system' | 'light' | 'dark';
    accentColor: AccentId;
    nouToolsIntegrationEnabled: boolean;
    screenReaderEnhancedSupportEnabled: boolean;
    altUuPlusDisabled: boolean;
    onboardingCompleted: boolean;
    liveSessionsTimezone: 'taiwan' | 'local';
    liveSessionNicknameModalEnabled: boolean;
    cellularPlaybackWarningEnabled: boolean;
    whatsNewSeenVersion: string;
}

export const useAppConfigStore = defineStore('appConfig', () => {
    const appearance = ref<'system' | 'light' | 'dark'>('system');
    const accentColor = ref<AccentId>(
        // Server-rendered onto <html> by app.blade.php, so start from it rather
        // than flashing back to the default before preferences load.
        isAccentId(document.documentElement.dataset.accent)
            ? document.documentElement.dataset.accent
            : DEFAULT_ACCENT,
    );
    const nouToolsIntegrationEnabled = ref<boolean>(false);
    const screenReaderEnhancedSupportEnabled = ref<boolean>(false);
    const altUuPlusDisabled = ref<boolean>(false);
    const onboardingCompleted = ref<boolean>(false);
    const liveSessionsTimezone = ref<'taiwan' | 'local'>('taiwan');
    const liveSessionNicknameModalEnabled = ref<boolean>(true);
    const cellularPlaybackWarningEnabled = ref<boolean>(true);
    const whatsNewSeenVersion = ref<string>('');
    const appName = ref<string>('Alt UU');
    const appVersion = ref<string>('unknown');
    const appVersionCode = ref<string>('unknown');
    const appDisplayVersion = ref<string>('unknown');
    const frameworkVersion = ref<string>('unknown');
    const materialSourceViewerEnabled = ref<boolean>(false);
    const isLoggedIn = ref<boolean>(false);
    const displayName = ref<string | null>(null);
    const nickname = ref<string | null>(null);
    const picture = ref<string | null>(null);
    const username = ref<string | null>(null);
    const isLoaded = ref<boolean>(false);
    const isPreferencesLoaded = ref<boolean>(false);
    const isProfileLoaded = ref<boolean>(false);

    let inflight: Promise<void> | null = null;
    let inflightPreferences: Promise<void> | null = null;
    let inflightProfile: Promise<void> | null = null;
    // Bumped by every applied write so a slower, older preferences load can't
    // overwrite what the user just saved.
    let preferencesRevision = 0;

    function applyPreferences(data: AppPreferences): void {
        appearance.value = data.appearance;
        accentColor.value = isAccentId(data.accentColor)
            ? data.accentColor
            : DEFAULT_ACCENT;
        nouToolsIntegrationEnabled.value = data.nouToolsIntegrationEnabled;
        screenReaderEnhancedSupportEnabled.value =
            data.screenReaderEnhancedSupportEnabled;
        altUuPlusDisabled.value = data.altUuPlusDisabled;
        onboardingCompleted.value = data.onboardingCompleted;
        liveSessionsTimezone.value = data.liveSessionsTimezone;
        liveSessionNicknameModalEnabled.value =
            data.liveSessionNicknameModalEnabled;
        cellularPlaybackWarningEnabled.value =
            data.cellularPlaybackWarningEnabled;
        whatsNewSeenVersion.value = data.whatsNewSeenVersion;
    }

    async function loadPreferences(force = false): Promise<void> {
        if (!force && isPreferencesLoaded.value) {
            return;
        }

        if (!force && inflightPreferences) {
            return inflightPreferences;
        }

        inflightPreferences = (async () => {
            try {
                const revision = preferencesRevision;
                const data = await apiFetch<AppPreferences>('/api/preferences');

                if (revision === preferencesRevision) {
                    applyPreferences(data);
                    isPreferencesLoaded.value = true;
                }
            } finally {
                inflightPreferences = null;
            }
        })();

        return inflightPreferences;
    }

    async function updatePreferences(
        partial: Partial<AppPreferences>,
    ): Promise<void> {
        const data = await apiFetch<AppPreferences>('/api/preferences', {
            method: 'PATCH',
            body: JSON.stringify(partial),
        });

        preferencesRevision++;
        applyPreferences(data);
        isPreferencesLoaded.value = true;
    }

    async function loadConfig(force = false): Promise<void> {
        if (!force && isLoaded.value) {
            return;
        }

        if (!force && inflight) {
            return inflight;
        }

        inflight = (async () => {
            try {
                const data = await apiFetch<AppConfig>('/api/config');

                appearance.value = (data.appearance || 'system') as
                    | 'system'
                    | 'light'
                    | 'dark';

                accentColor.value = isAccentId(data.accentColor)
                    ? data.accentColor
                    : DEFAULT_ACCENT;
                nouToolsIntegrationEnabled.value =
                    data.nouToolsIntegrationEnabled;
                screenReaderEnhancedSupportEnabled.value =
                    data.screenReaderEnhancedSupportEnabled;
                altUuPlusDisabled.value = data.altUuPlusDisabled;
                appName.value = data.appName;
                appVersion.value = data.appVersion;
                appVersionCode.value = data.appVersionCode;
                appDisplayVersion.value = data.appDisplayVersion;
                frameworkVersion.value = data.frameworkVersion;
                materialSourceViewerEnabled.value =
                    data.materialSourceViewerEnabled;
                isLoaded.value = true;
            } finally {
                inflight = null;
            }
        })();

        return inflight;
    }

    async function loadProfile(force = false): Promise<void> {
        if (!force && isProfileLoaded.value) {
            return;
        }

        if (!force && inflightProfile) {
            return inflightProfile;
        }

        inflightProfile = (async () => {
            try {
                const result = await bootstrapSession();

                if (result?.redirect !== '/courses') {
                    isLoggedIn.value = false;
                    displayName.value = null;
                    nickname.value = null;
                    picture.value = null;
                    username.value = null;

                    return;
                }

                const profile =
                    await apiFetch<SessionProfile>('/api/auth/profile');

                isLoggedIn.value = true;
                displayName.value = profile.displayName;
                nickname.value = profile.nickname;
                picture.value = profile.picture;
                username.value = profile.username;

                // Non-blocking sync of moderation data on boot
                const moderationStore = useModerationStore();
                moderationStore.syncBlockedContents();
            } finally {
                isProfileLoaded.value = true;
                inflightProfile = null;
            }
        })();

        return inflightProfile;
    }

    /**
     * The native status bar style names describe the icons (`light` = white
     * icons for dark backgrounds), the opposite of the app's appearance names.
     */
    const syncNativeStatusBarStyle = (value: 'system' | 'light' | 'dark') => {
        const styles = {
            system: 'auto',
            light: 'dark',
            dark: 'light',
        } as const;
        const style = styles[value];
        const bridge = (
            window as Window & {
                AndroidBridge?: {
                    setStatusBarStyle?: (nextStyle: string) => void;
                };
            }
        ).AndroidBridge;

        bridge?.setStatusBarStyle?.(style);
    };

    watch(
        appearance,
        (newValue) => {
            syncNativeStatusBarStyle(newValue);
        },
        { immediate: true },
    );

    watch(
        accentColor,
        (newValue) => {
            document.documentElement.dataset.accent = newValue;
            void setNativeAccentColor(newValue);
        },
        { immediate: true },
    );

    function reset(): void {
        isLoggedIn.value = false;
        displayName.value = null;
        nickname.value = null;
        picture.value = null;
        username.value = null;
        isLoaded.value = false;
        isPreferencesLoaded.value = false;
        isProfileLoaded.value = false;
        inflight = null;
        inflightPreferences = null;
        inflightProfile = null;
    }

    return {
        appearance,
        accentColor,
        nouToolsIntegrationEnabled,
        screenReaderEnhancedSupportEnabled,
        altUuPlusDisabled,
        onboardingCompleted,
        liveSessionsTimezone,
        liveSessionNicknameModalEnabled,
        cellularPlaybackWarningEnabled,
        whatsNewSeenVersion,
        appName,
        appVersion,
        appVersionCode,
        appDisplayVersion,
        frameworkVersion,
        materialSourceViewerEnabled,
        isLoggedIn,
        displayName,
        nickname,
        picture,
        username,
        isLoaded,
        isPreferencesLoaded,
        isProfileLoaded,
        loadConfig,
        loadProfile,
        loadPreferences,
        updatePreferences,
        reset,
    };
});
