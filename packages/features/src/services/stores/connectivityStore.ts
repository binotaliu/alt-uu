import { create } from 'zustand';

/** Failed retries within RETRY_WINDOW_MS before we suggest diagnostics. */
export const RETRY_THRESHOLD = 3;
export const RETRY_WINDOW_MS = 2 * 60 * 1000;
/** Once diagnostics ran (or the user was asked), stay quiet this long. */
export const QUIET_PERIOD_MS = 30 * 60 * 1000;

export interface ConnectivityState {
    promptOpen: boolean;
    lastDiagnosticsAt: number;
    retryTimestamps: number[];
    open: () => void;
    close: () => void;
    /**
     * Marks that the user was pointed at, or ran, diagnostics, which
     * suppresses further prompts for the quiet period.
     */
    noteDiagnosticsRun: (now?: number) => void;
    /**
     * Called when the user taps retry on an error panel. Suggests running
     * diagnostics once they keep retrying without success.
     */
    noteRetry: (now?: number) => void;
    hydrate: (lastDiagnosticsAt: number) => void;
}

/** Legacy connectivity Pinia store (persistence is wired by the provider). */
export const useConnectivityStore = create<ConnectivityState>()((set, get) => ({
    promptOpen: false,
    lastDiagnosticsAt: 0,
    retryTimestamps: [],
    open: () => set({ promptOpen: true }),
    close: () => set({ promptOpen: false }),
    noteDiagnosticsRun: (now = Date.now()) =>
        set({ lastDiagnosticsAt: now, retryTimestamps: [] }),
    noteRetry: (now = Date.now()) => {
        const state = get();

        if (now - state.lastDiagnosticsAt < QUIET_PERIOD_MS) {
            return;
        }

        const retryTimestamps = [
            ...state.retryTimestamps.filter((at) => now - at < RETRY_WINDOW_MS),
            now,
        ];

        if (retryTimestamps.length < RETRY_THRESHOLD || state.promptOpen) {
            set({ retryTimestamps });

            return;
        }

        set({ retryTimestamps: [], promptOpen: true });
    },
    hydrate: (lastDiagnosticsAt) => set({ lastDiagnosticsAt }),
}));
