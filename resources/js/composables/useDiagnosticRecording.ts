import { computed, onUnmounted, ref } from 'vue';
import { apiFetch } from '@/composables/useApi';

type RecordingStatus =
    AltUU.Domains.Diagnostics.ViewModels.DiagnosticRecordingStatusViewModel;

const RECORDING_URL = '/api/diagnostics/log/recording';

/**
 * Drives the opt-in recording window.
 *
 * Recording is off by default because a row per request costs SQLite writes
 * on the device, which is a real cost on a low-end Android phone. The user
 * switches it on for a bounded window while reproducing a problem, and it
 * switches itself back off afterwards.
 */
export function useDiagnosticRecording() {
    const status = ref<RecordingStatus | null>(null);
    const isBusy = ref(false);
    const error = ref<string | null>(null);
    const now = ref(Date.now());

    let ticker: ReturnType<typeof setInterval> | null = null;

    const isRecording = computed(() => {
        if (status.value?.recording !== true || !status.value.expiresAt) {
            return false;
        }

        return new Date(status.value.expiresAt).getTime() > now.value;
    });

    /** Whole minutes left, so the UI can say how long it will keep going. */
    const minutesRemaining = computed(() => {
        if (!isRecording.value || !status.value?.expiresAt) {
            return 0;
        }

        const remaining =
            new Date(status.value.expiresAt).getTime() - now.value;

        return Math.max(1, Math.ceil(remaining / 60_000));
    });

    function stopTicker(): void {
        if (ticker !== null) {
            clearInterval(ticker);
            ticker = null;
        }
    }

    // The window closes against the clock rather than on a server push, so
    // the UI has to notice the expiry on its own.
    function startTicker(): void {
        stopTicker();
        ticker = setInterval(() => {
            now.value = Date.now();

            if (!isRecording.value) {
                stopTicker();
            }
        }, 1000);
    }

    async function load(): Promise<void> {
        try {
            status.value = await apiFetch<RecordingStatus>(RECORDING_URL, {});
            now.value = Date.now();

            if (isRecording.value) {
                startTicker();
            }
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : '無法取得診斷記錄狀態。';
        }
    }

    async function setRecording(enabled: boolean): Promise<void> {
        if (isBusy.value) {
            return;
        }

        isBusy.value = true;
        error.value = null;

        try {
            status.value = await apiFetch<RecordingStatus>(RECORDING_URL, {
                method: 'PUT',
                body: JSON.stringify({ enabled }),
            });
            now.value = Date.now();

            if (isRecording.value) {
                startTicker();
            } else {
                stopTicker();
            }
        } catch (e) {
            error.value =
                e instanceof Error ? e.message : '設定失敗，請稍後再試。';
        } finally {
            isBusy.value = false;
        }
    }

    onUnmounted(stopTicker);

    return {
        status,
        isRecording,
        minutesRemaining,
        isBusy,
        error,
        load,
        setRecording,
    };
}
