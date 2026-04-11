import { ref } from 'vue';

interface UseApiOptions {
    /** Whether to call immediately on creation */
    immediate?: boolean;
}

/**
 * Generic composable for making Ajax API calls with loading/error state.
 * Since the Hungu backend is slow, all data loading goes through this
 * rather than standard Inertia props.
 */
export function useApi<T>(
    fetcher: () => Promise<T>,
    options: UseApiOptions = {},
) {
    const data = ref<T | null>(null) as { value: T | null };
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function execute(): Promise<T | null> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await fetcher();
            data.value = result;

            return result;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '發生未知錯誤';

            return null;
        } finally {
            isLoading.value = false;
        }
    }

    if (options.immediate) {
        execute();
    }

    return { data, isLoading, error, execute };
}

const csrfToken = (): string =>
    document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

export async function apiFetch<T>(
    url: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            ...((options.headers as Record<string, string>) ?? {}),
        },
        ...options,
    });

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = '/login';

            throw new Error('請先登入');
        }

        const body = await response.json().catch(() => null);

        if (body?.message) {
            throw new Error(body.message);
        }

        throw new Error(`請求失敗 (${response.status})`);
    }

    return response.json() as Promise<T>;
}
