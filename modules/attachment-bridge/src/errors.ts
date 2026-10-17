import {
    ATTACHMENT_BRIDGE_ERROR_CODES,
    type AttachmentBridgeErrorCode,
} from './AttachmentBridge.types';

export type AttachmentBridgeError = Error & {
    code: AttachmentBridgeErrorCode;
    /** Set for `ERR_HTTP_STATUS`. */
    httpStatus?: number;
};

const knownCodes = new Set<string>(ATTACHMENT_BRIDGE_ERROR_CODES);

export function isAttachmentBridgeError(
    error: unknown,
    code?: AttachmentBridgeErrorCode,
): error is AttachmentBridgeError {
    if (!(error instanceof Error)) {
        return false;
    }

    const errorCode = (error as { code?: unknown }).code;

    if (typeof errorCode !== 'string' || !knownCodes.has(errorCode)) {
        return false;
    }

    return code === undefined || errorCode === code;
}

/**
 * Normalises a native rejection. Native HTTP errors end their message with
 * the status code (e.g. `下載失敗，HTTP 狀態碼：404`); it is exposed as
 * `httpStatus`.
 */
export function normalizeAttachmentBridgeError(error: unknown): unknown {
    if (!isAttachmentBridgeError(error, 'ERR_HTTP_STATUS')) {
        return error;
    }

    const match = /(\d{3})\s*$/.exec(error.message);

    if (match) {
        error.httpStatus = Number(match[1]);
    }

    return error;
}

/** Builds an error shaped like the ones native code rejects with. */
export function createAttachmentBridgeError(
    code: AttachmentBridgeErrorCode,
    message: string,
): AttachmentBridgeError {
    return Object.assign(new Error(message), { code });
}
