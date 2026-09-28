import { defineStore } from 'pinia';
import { ref } from 'vue';

/** Failed retries within RETRY_WINDOW_MS before we suggest diagnostics. */
const RETRY_THRESHOLD = 3;
const RETRY_WINDOW_MS = 2 * 60 * 1000;
/** Once diagnostics ran (or the user was asked), stay quiet this long. */
const QUIET_PERIOD_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'connectivity.lastDiagnosticsAt';

function readLastDiagnosticsAt(): number {
    try {
        return Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeLastDiagnosticsAt(value: number): void {
    try {
        localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
        // Storage unavailable; the in-memory value still applies.
    }
}

export const useConnectivityStore = defineStore('connectivity', () => {
    const promptOpen = ref(false);
    const lastDiagnosticsAt = ref(readLastDiagnosticsAt());
    let retryTimestamps: number[] = [];

    function open(): void {
        promptOpen.value = true;
    }

    function close(): void {
        promptOpen.value = false;
    }

    /**
     * Marks that the user was pointed at, or ran, diagnostics, which
     * suppresses further prompts for the quiet period.
     */
    function noteDiagnosticsRun(): void {
        lastDiagnosticsAt.value = Date.now();
        retryTimestamps = [];
        writeLastDiagnosticsAt(lastDiagnosticsAt.value);
    }

    /**
     * Called when the user taps retry on an error screen. Suggests running
     * diagnostics once they keep retrying without success.
     */
    function noteRetry(): void {
        const now = Date.now();

        if (now - lastDiagnosticsAt.value < QUIET_PERIOD_MS) {
            return;
        }

        retryTimestamps = [
            ...retryTimestamps.filter((at) => now - at < RETRY_WINDOW_MS),
            now,
        ];

        if (retryTimestamps.length < RETRY_THRESHOLD || promptOpen.value) {
            return;
        }

        retryTimestamps = [];
        open();
    }

    return {
        promptOpen,
        open,
        close,
        noteRetry,
        noteDiagnosticsRun,
    };
});
