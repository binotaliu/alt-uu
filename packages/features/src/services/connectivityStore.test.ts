import {
    QUIET_PERIOD_MS,
    RETRY_THRESHOLD,
    useConnectivityStore,
} from './stores/connectivityStore';

beforeEach(() => {
    useConnectivityStore.setState({
        promptOpen: false,
        lastDiagnosticsAt: 0,
        retryTimestamps: [],
    });
});

describe('connectivity store', () => {
    it('opens the prompt after repeated retries within the window', () => {
        const { noteRetry } = useConnectivityStore.getState();
        const start = QUIET_PERIOD_MS + 1;

        for (let i = 0; i < RETRY_THRESHOLD - 1; i++) {
            noteRetry(start + i * 1000);
        }

        expect(useConnectivityStore.getState().promptOpen).toBe(false);

        noteRetry(start + 10_000);

        expect(useConnectivityStore.getState().promptOpen).toBe(true);
    });

    it('ignores retries spread beyond the window', () => {
        const { noteRetry } = useConnectivityStore.getState();
        const start = QUIET_PERIOD_MS + 1;

        for (let i = 0; i < 5; i++) {
            noteRetry(start + i * 3 * 60 * 1000);
        }

        expect(useConnectivityStore.getState().promptOpen).toBe(false);
    });

    it('stays quiet after diagnostics ran', () => {
        const store = useConnectivityStore.getState();
        const now = QUIET_PERIOD_MS + 1;

        store.noteDiagnosticsRun(now);

        for (let i = 0; i < 5; i++) {
            store.noteRetry(now + i * 1000);
        }

        expect(useConnectivityStore.getState().promptOpen).toBe(false);
    });
});
