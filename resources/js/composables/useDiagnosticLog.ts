import { computed, ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import { clearClientEvents, flushClientEvents } from '@/lib/diagnostics';

type EventList =
    AltUU.Domains.Diagnostics.ViewModels.DiagnosticEventListViewModel;
export type DiagnosticEventRow =
    AltUU.Domains.Diagnostics.ViewModels.DiagnosticEventViewModel;

export const BUNDLE_URL = '/api/diagnostics/log/bundle';

export function useDiagnosticLog() {
    const events = ref<DiagnosticEventRow[]>([]);
    const total = ref(0);
    const recordingEnabled = ref(true);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const problemsOnly = ref(false);

    const visibleEvents = computed(() => events.value);

    async function load(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            // Push the client ring buffer first so JS errors and navigations
            // appear on the same timeline as the requests they surround.
            await flushClientEvents();
            clearClientEvents();

            const result = await apiFetch<EventList>(
                `/api/diagnostics/log?problemsOnly=${problemsOnly.value ? 1 : 0}`,
                {},
            );

            events.value = result.events;
            total.value = result.total;
            recordingEnabled.value = result.recordingEnabled;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '載入診斷記錄失敗。';
        } finally {
            isLoading.value = false;
        }
    }

    async function toggleProblemsOnly(value: boolean): Promise<void> {
        problemsOnly.value = value;
        await load();
    }

    async function clear(): Promise<void> {
        clearClientEvents();

        await apiFetch('/api/diagnostics/log', { method: 'DELETE' });

        await load();
    }

    /**
     * Makes sure the client buffer has reached the server before the bundle
     * is generated, since the bundle is rendered server-side.
     */
    async function prepareBundle(): Promise<void> {
        await flushClientEvents();
        clearClientEvents();
    }

    return {
        events: visibleEvents,
        total,
        recordingEnabled,
        isLoading,
        error,
        problemsOnly,
        load,
        toggleProblemsOnly,
        clear,
        prepareBundle,
    };
}
