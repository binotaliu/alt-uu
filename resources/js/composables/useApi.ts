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

let inflightBootstrap: Promise<boolean> | null = null;

async function attemptBootstrap(): Promise<boolean> {
    if (inflightBootstrap) {
        return inflightBootstrap;
    }

    inflightBootstrap = (async () => {
        try {
            const response = await fetch('/api/auth/bootstrap-session', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                return false;
            }

            const payload = (await response.json()) as { ok?: boolean };

            return payload.ok === true;
        } catch {
            return false;
        } finally {
            inflightBootstrap = null;
        }
    })();

    return inflightBootstrap;
}

async function rawFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    return fetch(url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) ?? {}),
        },
        ...options,
    });
}

async function handleErrorResponse(response: Response): Promise<never> {
    if (response.status === 401) {
        window.location.href = '/login';

        throw new Error('請先登入');
    }

    const body = await response.json().catch(() => null);

    if (body?.message) {
        throw new Error(body.message as string);
    }

    throw new Error(`請求失敗 (${response.status})`);
}

export async function apiFetch<T>(
    url: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await rawFetch(url, options);

    if (response.status === 409) {
        const body = await response.json().catch(() => null);

        if (body?.code === 'boot_validation_required') {
            const bootstrapOk = await attemptBootstrap();

            if (!bootstrapOk) {
                window.location.href = '/login';

                throw new Error('啟動驗證失敗，請重新登入。');
            }

            const retryResponse = await rawFetch(url, options);

            if (!retryResponse.ok) {
                return handleErrorResponse(retryResponse);
            }

            return retryResponse.json() as Promise<T>;
        }

        if (body?.message) {
            throw new Error(body.message as string);
        }

        throw new Error(`請求失敗 (${response.status})`);
    }

    if (!response.ok) {
        return handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
}
