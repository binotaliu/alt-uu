import { AltUUError, type AltUUErrorCode } from './errors';

/** Generic copy for unexpected errors (legacy JsonExceptionRenderer). */
export const UNEXPECTED_ERROR_MESSAGE = 'App 發生未預期的錯誤，請稍後再試。';

const MAX_STACK_FRAMES = 30;

export interface ErrorDetail {
    class: string;
    message: string;
    stack: string[];
}

export interface UserFacingError {
    message: string;
    code: AltUUErrorCode;
    failedAccountId?: number | null;
    /** Technical detail for the expandable panel / diagnostics bundle. */
    exception: ErrorDetail;
}

/**
 * Port of the legacy JsonExceptionRenderer mapping: AltUU errors keep their
 * user-facing message and code, anything else becomes `server_error` with
 * friendly copy while the original message stays in `exception`. Redaction
 * of `exception` is the diagnostics recorder's job.
 */
export function toUserFacingError(error: unknown): UserFacingError {
    const exception = describeError(error);

    if (error instanceof AltUUError) {
        const result: UserFacingError = {
            message:
                error.message.trim() !== ''
                    ? error.message
                    : UNEXPECTED_ERROR_MESSAGE,
            code: error.code,
            exception,
        };

        if ('failedAccountId' in error) {
            result.failedAccountId = error.failedAccountId as number | null;
        }

        return result;
    }

    return {
        message: UNEXPECTED_ERROR_MESSAGE,
        code: 'server_error',
        exception,
    };
}

export function describeError(error: unknown): ErrorDetail {
    if (error instanceof Error) {
        return {
            class: error.name,
            message: error.message,
            stack: (error.stack ?? '')
                .split('\n')
                .slice(1, MAX_STACK_FRAMES + 1)
                .map((frame) => frame.trim())
                .filter((frame) => frame !== ''),
        };
    }

    return { class: typeof error, message: String(error), stack: [] };
}
