import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import { asApiError } from '@/lib/apiError';
import type { ApiError } from '@/lib/apiError';

export type MaterialDirectory =
    AltUU.Domains.Diagnostics.ViewModels.MaterialDirectoryInspectionViewModel;
export type MaterialDirectoryNode =
    AltUU.Domains.Diagnostics.ViewModels.MaterialDirectoryNodeViewModel;
export type MaterialSource =
    AltUU.Domains.Diagnostics.ViewModels.MaterialSourceInspectionViewModel;

/**
 * Backs the material source tool: the course directory as the school sent it,
 * and one node's raw page alongside what our parser made of it.
 *
 * Both calls suppress the connectivity prompt — this is the page a user opens
 * to investigate a failure, so it should show the failure rather than pop a
 * second dialog over it.
 */
export function useMaterialSourceInspector() {
    const directory = ref<MaterialDirectory | null>(null);
    const source = ref<MaterialSource | null>(null);
    const isLoadingDirectory = ref(false);
    const isLoadingSource = ref(false);
    const directoryError = ref<string | null>(null);
    const directoryErrorDetail = ref<ApiError | null>(null);
    const sourceError = ref<string | null>(null);
    const sourceErrorDetail = ref<ApiError | null>(null);

    async function loadDirectory(cid: string): Promise<void> {
        isLoadingDirectory.value = true;
        directoryError.value = null;
        directoryErrorDetail.value = null;
        directory.value = null;

        try {
            directory.value = await apiFetch<MaterialDirectory>(
                `/api/diagnostics/material/${encodeURIComponent(cid)}/directory`,
                {},
            );
        } catch (e) {
            directoryError.value =
                e instanceof Error ? e.message : '載入教材目錄失敗。';
            directoryErrorDetail.value = asApiError(e);
        } finally {
            isLoadingDirectory.value = false;
        }
    }

    async function loadSource(cid: string, scoid: string): Promise<void> {
        isLoadingSource.value = true;
        sourceError.value = null;
        sourceErrorDetail.value = null;
        source.value = null;

        try {
            source.value = await apiFetch<MaterialSource>(
                `/api/diagnostics/material/${encodeURIComponent(cid)}/nodes/${encodeURIComponent(scoid)}`,
                {},
            );
        } catch (e) {
            sourceError.value =
                e instanceof Error ? e.message : '載入教材原始碼失敗。';
            sourceErrorDetail.value = asApiError(e);
        } finally {
            isLoadingSource.value = false;
        }
    }

    function clearSource(): void {
        source.value = null;
        sourceError.value = null;
        sourceErrorDetail.value = null;
    }

    function reset(): void {
        directory.value = null;
        directoryError.value = null;
        directoryErrorDetail.value = null;
        clearSource();
    }

    return {
        directory,
        source,
        isLoadingDirectory,
        isLoadingSource,
        directoryError,
        directoryErrorDetail,
        sourceError,
        sourceErrorDetail,
        loadDirectory,
        loadSource,
        clearSource,
        reset,
    };
}
