import {
    ExternalServiceUnavailableError,
    SessionInvalidError,
    UserFacingHttpError,
    toUserFacingError,
    type AltUUErrorCode,
    type ErrorDetail,
} from '@altuu/core';

import { operationFor, type Operation } from './operations';

/**
 * Where a call broke (legacy FailureStage). With everything in-process the
 * old `network` stage (cannot reach the app server) no longer happens; it is
 * kept so persisted logs and copy stay compatible.
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
    network: '無法連線到網路',
    http: 'App 回應錯誤',
    upstream: '學校系統回應錯誤',
    parse: '回應內容無法解析',
    client: 'App 發生錯誤',
};

export interface ServiceErrorInit {
    message: string;
    operationKey: string;
    stage: FailureStage;
    code: AltUUErrorCode;
    status?: number | null;
    upstreamStatus?: number | null;
    requestId?: string | null;
    durationMs?: number | null;
    exception: ErrorDetail;
    failedAccountId?: number | null;
    cause?: unknown;
}

/**
 * The error every service hook rejects with (legacy ApiError). `message` is
 * always the user-facing zh-Hant text, so
 * `error instanceof Error ? error.message : ...` keeps working in screens.
 */
export class ServiceError extends Error {
    readonly operationKey: string;
    readonly operation: Operation;
    readonly stage: FailureStage;
    readonly code: AltUUErrorCode;
    readonly status: number | null;
    readonly upstreamStatus: number | null;
    readonly requestId: string | null;
    readonly durationMs: number | null;
    readonly exception: ErrorDetail;
    readonly failedAccountId: number | null;
    readonly occurredAt: string;

    constructor(init: ServiceErrorInit) {
        super(init.message, { cause: init.cause });
        this.name = 'ServiceError';
        this.operationKey = init.operationKey;
        this.operation = operationFor(init.operationKey);
        this.stage = init.stage;
        this.code = init.code;
        this.status = init.status ?? null;
        this.upstreamStatus = init.upstreamStatus ?? null;
        this.requestId = init.requestId ?? null;
        this.durationMs = init.durationMs ?? null;
        this.exception = init.exception;
        this.failedAccountId = init.failedAccountId ?? null;
        this.occurredAt = new Date().toISOString();
    }

    /** Shown inline next to the message, e.g. `CRS-U503`. */
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

    /** True for failures that suggest running connectivity diagnostics. */
    get isConnectivityFailure(): boolean {
        return this.stage === 'network' || this.stage === 'upstream';
    }

    /** A plain-text block for the clipboard, ready to paste into an issue. */
    toReport(): string {
        const lines = [
            `代碼：${this.displayCode}`,
            `項目：${this.operation.label}`,
            `狀況：${this.stageLabel}`,
            `訊息：${this.message}`,
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

        lines.push(
            `錯誤：${this.exception.class}: ${this.exception.message}`,
            ...this.exception.stack.slice(0, 10).map((frame) => `  ${frame}`),
            `時間：${this.occurredAt}`,
        );

        return lines.join('\n');
    }
}

export function isServiceError(value: unknown): value is ServiceError {
    return value instanceof ServiceError;
}

/** Narrows a caught value to a ServiceError, or null. */
export function asServiceError(value: unknown): ServiceError | null {
    return value instanceof ServiceError ? value : null;
}

const UPSTREAM_STATUSES = new Set([502, 503, 504]);

/**
 * Maps whatever a service threw onto a ServiceError (legacy
 * JsonExceptionRenderer + useApi stage rules): typed AltUU errors keep their
 * user-facing message, unexpected errors get the generic copy while the
 * original stays in `exception`.
 */
export function toServiceError(
    error: unknown,
    context: {
        operationKey: string;
        durationMs?: number | null;
        requestId?: string | null;
    },
): ServiceError {
    if (error instanceof ServiceError) {
        return error;
    }

    const facts = toUserFacingError(error);
    let stage: FailureStage = 'client';
    let status: number | null = null;
    let upstreamStatus: number | null = null;

    if (error instanceof ExternalServiceUnavailableError) {
        stage = 'upstream';
        status = 503;
        upstreamStatus = 503;
    } else if (error instanceof SessionInvalidError) {
        stage = 'http';
        status = 401;
    } else if (error instanceof UserFacingHttpError) {
        status = error.status;
        stage = UPSTREAM_STATUSES.has(error.status) ? 'upstream' : 'http';
        upstreamStatus = stage === 'upstream' ? error.status : null;
    }

    return new ServiceError({
        message: facts.message,
        operationKey: context.operationKey,
        stage,
        code: facts.code,
        status,
        upstreamStatus,
        requestId: context.requestId ?? null,
        durationMs: context.durationMs ?? null,
        exception: facts.exception,
        failedAccountId: facts.failedAccountId ?? null,
        cause: error,
    });
}
