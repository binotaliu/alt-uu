import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { apiFetch } from '@/composables/useApi';
import { useModerationStore } from '@/stores/moderation';

interface AppConfig {
    appearance: string;
    nouToolsIntegrationEnabled: boolean;
    screenReaderEnhancedSupportEnabled: boolean;
    appName: string;
    appVersion: string;
    appVersionCode: string;
    frameworkVersion: string;
    isLoggedIn: boolean;
}

export const useAppConfigStore = defineStore('appConfig', () => {
    const appearance = ref<'system' | 'light' | 'dark'>('system');
    const nouToolsIntegrationEnabled = ref<boolean>(false);
    const screenReaderEnhancedSupportEnabled = ref<boolean>(false);
    const appName = ref<string>('Alt UU');
    const appVersion = ref<string>('unknown');
    const appVersionCode = ref<string>('unknown');
    const frameworkVersion = ref<string>('unknown');
    const isLoggedIn = ref<boolean>(false);
    const isLoaded = ref<boolean>(false);

    let inflight: Promise<void> | null = null;

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

                nouToolsIntegrationEnabled.value =
                    data.nouToolsIntegrationEnabled;
                screenReaderEnhancedSupportEnabled.value =
                    data.screenReaderEnhancedSupportEnabled;
                appName.value = data.appName;
                appVersion.value = data.appVersion;
                appVersionCode.value = data.appVersionCode;
                frameworkVersion.value = data.frameworkVersion;
                isLoggedIn.value = data.isLoggedIn;
                isLoaded.value = true;

                // Non-blocking sync of moderation data on boot
                if (data.isLoggedIn) {
                    const moderationStore = useModerationStore();
                    moderationStore.syncBlockedContents();
                }
            } finally {
                inflight = null;
            }
        })();

        return inflight;
    }

    const syncNativeStatusBarStyle = (value: 'system' | 'light' | 'dark') => {
        const style = value === 'system' ? 'auto' : value;
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

    function reset(): void {
        isLoggedIn.value = false;
        isLoaded.value = false;
        inflight = null;
    }

    return {
        appearance,
        nouToolsIntegrationEnabled,
        screenReaderEnhancedSupportEnabled,
        appName,
        appVersion,
        appVersionCode,
        frameworkVersion,
        isLoggedIn,
        isLoaded,
        loadConfig,
        reset,
    };
});
