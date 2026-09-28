import { onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';
import { Network } from '#nativephp';
import { apiFetch } from '@/composables/useApi';
import { useConnectivityStore } from '@/stores/connectivity';

const NETWORK_POLL_INTERVAL_MS = 3000;

type ServiceListResult =
    AltUU.Domains.Diagnostics.ViewModels.ConnectivityServiceListViewModel;
type CheckResult =
    AltUU.Domains.Diagnostics.ViewModels.ConnectivityCheckResultViewModel;
type ServiceEnum = AltUU.Domains.Diagnostics.Enums.ConnectivityServiceEnum;

type BaseRow = { service: ServiceEnum; label: string; isReference: boolean };

export type ConnectivityServiceRow =
    | (BaseRow & { status: 'pending' })
    | (BaseRow & { status: 'checking' })
    | (BaseRow & { status: 'done' } & CheckResult);

// The bundled #nativephp type declarations only cover the base
// `connected`/`type` fields; `nativephp/mobile-network` adds these at
// runtime, so the richer shape is declared locally.
export type DeviceNetworkStatus = {
    connected: boolean;
    type: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | string;
    isExpensive: boolean;
    isConstrained: boolean;
};

async function checkRows(list: Ref<ConnectivityServiceRow[]>): Promise<void> {
    for (let i = 0; i < list.value.length; i++) {
        const { service } = list.value[i];
        list.value[i] = { ...list.value[i], status: 'checking' };

        const result = await apiFetch<CheckResult>(
            `/api/diagnostics/connectivity/${service}`,
            {},
        );

        list.value[i] = { ...list.value[i], ...result, status: 'done' };
    }
}

export function useConnectivityDiagnostics() {
    const connectivity = useConnectivityStore();
    const rows = ref<ConnectivityServiceRow[]>([]);
    const referenceRows = ref<ConnectivityServiceRow[]>([]);
    const isChecking = ref(false);
    const isCheckingReference = ref(false);
    const error = ref<string | null>(null);
    const referenceError = ref<string | null>(null);
    const deviceNetwork = ref<DeviceNetworkStatus | null>(null);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling(): void {
        if (pollTimer !== null) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function browserNetworkFallback(): DeviceNetworkStatus {
        return {
            connected: navigator.onLine,
            type: 'unknown',
            isExpensive: false,
            isConstrained: false,
        };
    }

    async function loadDeviceNetwork(): Promise<DeviceNetworkStatus | null> {
        try {
            const status = (await Network.status()) as DeviceNetworkStatus;
            deviceNetwork.value = status ?? browserNetworkFallback();
        } catch {
            deviceNetwork.value = browserNetworkFallback();
        }

        return deviceNetwork.value;
    }

    function pollUntilConnected(): void {
        stopPolling();

        pollTimer = setInterval(() => {
            void (async () => {
                const status = await loadDeviceNetwork();

                if (status?.connected) {
                    stopPolling();
                    await runCheck();
                }
            })();
        }, NETWORK_POLL_INTERVAL_MS);
    }

    async function runCheck(): Promise<void> {
        connectivity.noteDiagnosticsRun();
        isChecking.value = true;
        error.value = null;

        const network = await loadDeviceNetwork();

        if (!network?.connected) {
            rows.value = [];
            referenceRows.value = [];
            isChecking.value = false;
            pollUntilConnected();

            return;
        }

        stopPolling();

        try {
            const { services } = await apiFetch<ServiceListResult>(
                '/api/diagnostics/connectivity/services',
                {},
            );

            const pendingRows = services.map((service) => ({
                ...service,
                status: 'pending' as const,
            }));

            rows.value = pendingRows.filter((row) => !row.isReference);
            referenceRows.value = pendingRows.filter((row) => row.isReference);

            await checkRows(rows);
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : '檢查失敗，請稍後再試。';
        } finally {
            isChecking.value = false;
        }
    }

    onUnmounted(() => {
        stopPolling();
    });

    async function runReferenceCheck(): Promise<void> {
        if (referenceRows.value.length === 0) {
            return;
        }

        isCheckingReference.value = true;
        referenceError.value = null;

        try {
            await checkRows(referenceRows);
        } catch (e) {
            referenceError.value =
                e instanceof Error ? e.message : '檢查失敗，請稍後再試。';
        } finally {
            isCheckingReference.value = false;
        }
    }

    return {
        rows,
        referenceRows,
        isChecking,
        isCheckingReference,
        error,
        referenceError,
        deviceNetwork,
        runCheck,
        runReferenceCheck,
    };
}
