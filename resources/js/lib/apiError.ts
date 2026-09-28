import { operationFor } from '@/lib/operations';
import type { Operation } from '@/lib/operations';

/**
 * Where a request broke. This is the distinction the old generic message
 * could not express: an unreachable network, our own backend failing, the
 * upstream school system failing, or our code mis-reading a good response.
 */
export type FailureStage = 'network' | 'http' | 'upstream' | 'parse' | 'client';

const STAGE_LETTER: Record<FailureStage, string> = {
    network: 'N',
    http: 'H',
    upstream: 'U',
    parse: 'P',
    client: 'J',
};

export const STAGE_LABEL: Record<FailureStage, string> = {
    network: '無法連線到 App 伺服器',
    http: 'App 伺服器回應錯誤',
    upstream: '學校系統回應錯誤',
    parse: '回應內容無法解析',
    client: 'App 前端發生錯誤',
};

export interface ServerExceptionDetail {
    class: string;
    message: string;
    file: string;
    line: number;
    trace: string[];
}

export interface ApiErrorInit {
    message: string;
    operationKey: string;
    stage: FailureStage;
    url: string;
    method: string;
    status?: number | null;
    upstreamStatus?: number | null;
    code?: string | null;
    requestId?: string | null;
    serverException?: ServerExceptionDetail | null;
    durationMs?: number | null;
    raw?: unknown;
    /** Anything else worth carrying into the log, e.g. the raw fetch reason. */
    extra?: Record<string, unknown>;
}

/**
 * Extends Error and keeps `message` as the friendly zh-TW string on purpose:
 * roughly twenty call sites do `e instanceof Error ? e.message : '…失敗'`, and
 * they all keep working untouched while the extra context rides along for
 * anyone who wants it.
 */
export class ApiError extends Error {
    readonly operationKey: string;
    readonly operation: Operation;
    readonly stage: FailureStage;
    readonly url: string;
    readonly method: string;
    readonly status: number | null;
    readonly upstreamStatus: number | null;
    readonly code: string | null;
    readonly requestId: string | null;
    readonly serverException: ServerExceptionDetail | null;
    readonly durationMs: number | null;
    readonly occurredAt: string;
    readonly extra: Record<string, unknown>;
    readonly raw?: unknown;

    constructor(init: ApiErrorInit) {
        super(init.message);
        this.name = 'ApiError';
        this.operationKey = init.operationKey;
        this.operation = operationFor(init.operationKey);
        this.stage = init.stage;
        this.url = init.url;
        this.method = init.method;
        this.status = init.status ?? null;
        this.upstreamStatus = init.upstreamStatus ?? null;
        this.code = init.code ?? null;
        this.requestId = init.requestId ?? null;
        this.serverException = init.serverException ?? null;
        this.durationMs = init.durationMs ?? null;
        this.occurredAt = new Date().toISOString();
        this.extra = init.extra ?? {};

        if (init.raw !== undefined) {
            this.raw = init.raw;
        }
    }

    /**
     * The code shown inline next to the message, e.g. CRS-U500. Deliberately
     * visible without expanding anything, so a screenshot alone identifies
     * which part of the app failed and how.
     */
    get displayCode(): string {
        const letter = STAGE_LETTER[this.stage];
        const status =
            this.stage === 'upstream'
                ? this.upstreamStatus
                : this.stage === 'http'
                  ? this.status
                  : null;

        return `${this.operation.code}-${letter}${status ?? ''}`;
    }

    get stageLabel(): string {
        return STAGE_LABEL[this.stage];
    }

    /** A plain-text block for the clipboard, ready to paste into an issue. */
    toReport(): string {
        const lines = [
            `代碼：${this.displayCode}`,
            `項目：${this.operation.label}`,
            `狀況：${this.stageLabel}`,
            `訊息：${this.message}`,
            `請求：${this.method} ${this.url}`,
        ];

        if (this.status !== null) {
            lines.push(`狀態碼：${this.status}`);
        }

        if (this.upstreamStatus !== null) {
            lines.push(`學校系統狀態碼：${this.upstreamStatus}`);
        }

        if (this.durationMs !== null) {
            lines.push(`耗時：${this.durationMs}ms`);
        }

        if (this.requestId !== null) {
            lines.push(`識別碼：${this.requestId}`);
        }

        if (this.serverException) {
            lines.push(
                `伺服器：${this.serverException.class}: ${this.serverException.message}`,
                `位置：${this.serverException.file}:${this.serverException.line}`,
                ...this.serverException.trace.slice(0, 10).map((f) => `  ${f}`),
            );
        }

        lines.push(`時間：${this.occurredAt}`);

        return lines.join('\n');
    }
}

export function isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
}

/** Narrows an unknown catch value to an ApiError, or null if it isn't one. */
export function asApiError(value: unknown): ApiError | null {
    return value instanceof ApiError ? value : null;
}
