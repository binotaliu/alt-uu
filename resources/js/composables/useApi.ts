import { ref } from 'vue';
import { handleSessionInvalid } from '@/composables/useSessionExpiry';
import { ApiError, asApiError } from '@/lib/apiError';
import type { FailureStage, ServerExceptionDetail } from '@/lib/apiError';
import { recordClientEvent } from '@/lib/diagnostics';
import { resolveOperationKey } from '@/lib/operations';

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
    /** The same failure as `error`, with the context needed to diagnose it. */
    const errorDetail = ref<ApiError | null>(null);

    async function execute(): Promise<T | null> {
        isLoading.value = true;
        error.value = null;
        errorDetail.value = null;

        try {
            const result = await fetcher();
            data.value = result;

            return result;
        } catch (e) {
            error.value = e instanceof Error ? e.message : '發生未知錯誤';
            errorDetail.value = asApiError(e);

            return null;
        } finally {
            isLoading.value = false;
        }
    }

    if (options.immediate) {
        execute();
    }

    return { data, isLoading, error, errorDetail, execute };
}

export interface BootstrapSessionResult {
    ok: boolean;
    redirect: string;
    nouToolsIntegrationEnabled: boolean;
}

let inflightBootstrap: Promise<BootstrapSessionResult | null> | null = null;

export async function bootstrapSession(): Promise<BootstrapSessionResult | null> {
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
                return null;
            }

            return (await response.json()) as BootstrapSessionResult;
        } catch {
            return null;
        } finally {
            inflightBootstrap = null;
        }
    })();

    return inflightBootstrap;
}

async function attemptBootstrap(): Promise<boolean> {
    const result = await bootstrapSession();

    return result?.ok === true;
}

const REQUEST_ID_HEADER = 'X-Request-Id';
const OPERATION_HEADER = 'X-Alt-UU-Op';

/**
 * Generated client-side so a request that never reaches the server — an
 * offline device, a DNS failure — still has an id to log against. The server
 * echoes it back, which is what lets the two halves be lined up later.
 */
function newRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    }

    return Math.random().toString(16).slice(2, 10).padStart(8, '0');
}

async function rawFetch(
    url: string,
    options: RequestInit = {},
    tracing: { requestId: string; operationKey: string },
): Promise<Response> {
    return fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            [REQUEST_ID_HEADER]: tracing.requestId,
            [OPERATION_HEADER]: tracing.operationKey,
            ...((options.headers as Record<string, string>) ?? {}),
        },
    });
}

interface ErrorBody {
    message?: unknown;
    code?: unknown;
    raw?: unknown;
    accountId?: unknown;
    requestId?: unknown;
    exception?: unknown;
    upstreamStatus?: unknown;
}

interface RequestFacts {
    url: string;
    method: string;
    operationKey: string;
    requestId: string;
    startedAt: number;
}

function elapsed(facts: RequestFacts): number {
    return Math.round(performance.now() - facts.startedAt);
}

function serverExceptionFrom(
    body: ErrorBody | null,
): ServerExceptionDetail | null {
    const raw = body?.exception;

    if (raw === null || typeof raw !== 'object') {
        return null;
    }

    const detail = raw as Record<string, unknown>;

    return {
        class: String(detail.class ?? 'Exception'),
        message: String(detail.message ?? ''),
        file: String(detail.file ?? ''),
        line: Number(detail.line ?? 0),
        trace: Array.isArray(detail.trace) ? detail.trace.map(String) : [],
    };
}

/**
 * A 502/503 means our backend was reachable but the school system it depends
 * on was not, so the blame belongs upstream rather than with us. Telling
 * these apart is the whole point of the stage.
 */
function stageForStatus(status: number): FailureStage {
    return status === 502 || status === 503 || status === 504
        ? 'upstream'
        : 'http';
}

function buildError(
    facts: RequestFacts,
    stage: FailureStage,
    message: string,
    response: Response | null,
    body: ErrorBody | null,
    extra: Record<string, unknown> = {},
): ApiError {
    const status = response?.status ?? null;

    return new ApiError({
        message,
        operationKey: facts.operationKey,
        stage,
        url: facts.url,
        method: facts.method,
        status,
        upstreamStatus:
            typeof body?.upstreamStatus === 'number'
                ? body.upstreamStatus
                : stage === 'upstream'
                  ? status
                  : null,
        code: typeof body?.code === 'string' ? body.code : null,
        requestId:
            response?.headers.get(REQUEST_ID_HEADER) ??
            (typeof body?.requestId === 'string' ? body.requestId : null) ??
            facts.requestId,
        serverException: serverExceptionFrom(body),
        durationMs: elapsed(facts),
        raw: body?.raw,
        extra,
    });
}

function recordFailure(error: ApiError): void {
    recordClientEvent({
        type: 'api.request',
        level: 'error',
        summary: `${error.method} ${error.url} — ${error.displayCode} ${error.message}`,
        op: error.operationKey,
        requestId: error.requestId,
        status: error.status,
        durationMs: error.durationMs,
        context: {
            stage: error.stage,
            upstreamStatus: error.upstreamStatus,
            code: error.code,
            exception: error.serverException,
            ...error.extra,
        },
    });
}

function recordSuccess(
    facts: RequestFacts,
    status: number,
    requestId: string | null,
): void {
    recordClientEvent({
        type: 'api.request',
        level: 'info',
        summary: `${facts.method} ${facts.url}`,
        op: facts.operationKey,
        requestId: requestId ?? facts.requestId,
        status,
        durationMs: elapsed(facts),
        context: {},
    });
}

async function errorForResponse(
    response: Response,
    facts: RequestFacts,
): Promise<ApiError> {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;

    if (response.status === 401) {
        void handleSessionInvalid(
            typeof body?.accountId === 'number' ? body.accountId : null,
        );

        return buildError(facts, 'http', '請先登入', response, body);
    }

    const message =
        typeof body?.message === 'string' && body.message !== ''
            ? body.message
            : `請求失敗 (${response.status})`;

    return buildError(
        facts,
        stageForStatus(response.status),
        message,
        response,
        body,
    );
}

export interface ApiFetchOptions {
    /** Override the operation inferred from the URL. */
    op?: string;
}

export async function apiFetch<T>(
    url: string,
    options: RequestInit = {},
    apiOptions: ApiFetchOptions = {},
): Promise<T> {
    const facts: RequestFacts = {
        url,
        method: (options.method ?? 'GET').toUpperCase(),
        operationKey: resolveOperationKey(url, apiOptions.op),
        requestId: newRequestId(),
        startedAt: performance.now(),
    };

    let response: Response;

    try {
        response = await rawFetch(url, options, facts);
    } catch (error) {
        // fetch() rejects on network-level failure (offline, DNS, TLS) —
        // never for 4xx/5xx, which resolve normally below.
        throw fail(
            buildError(
                facts,
                'network',
                '網路連線失敗，請檢查網路狀態。',
                null,
                null,
                {
                    cause:
                        error instanceof Error ? error.message : String(error),
                },
            ),
        );
    }

    if (response.status === 409) {
        const body = (await response
            .json()
            .catch(() => null)) as ErrorBody | null;

        if (body?.code === 'boot_validation_required') {
            const bootstrapOk = await attemptBootstrap();

            if (!bootstrapOk) {
                void handleSessionInvalid(null);

                throw fail(
                    buildError(
                        facts,
                        'http',
                        '啟動驗證失敗，請重新登入。',
                        response,
                        body,
                    ),
                );
            }

            const retryResponse = await rawFetch(url, options, facts);

            if (!retryResponse.ok) {
                throw fail(await errorForResponse(retryResponse, facts));
            }

            return readBody<T>(retryResponse, facts);
        }

        const message =
            typeof body?.message === 'string' && body.message !== ''
                ? body.message
                : `請求失敗 (${response.status})`;

        throw fail(buildError(facts, 'http', message, response, body));
    }

    if (!response.ok) {
        throw fail(await errorForResponse(response, facts));
    }

    return readBody<T>(response, facts);
}

/**
 * A 2xx we cannot decode is our problem, not theirs — the parse stage exists
 * so that case stops looking like a server failure.
 */
async function readBody<T>(
    response: Response,
    facts: RequestFacts,
): Promise<T> {
    const requestId = response.headers.get(REQUEST_ID_HEADER);

    if (response.status === 204) {
        recordSuccess(facts, response.status, requestId);

        return undefined as T;
    }

    try {
        const parsed = (await response.json()) as T;
        recordSuccess(facts, response.status, requestId);

        return parsed;
    } catch {
        throw fail(
            buildError(
                facts,
                'parse',
                '伺服器回應格式錯誤，無法解析。',
                response,
                null,
            ),
        );
    }
}

function fail(error: ApiError): ApiError {
    recordFailure(error);

    return error;
}

export { ApiError };
export type { FailureStage };
