import { describe, expect, it } from 'vitest';

import {
    ExternalServiceUnavailableError,
    SessionInvalidError,
    UserFacingHttpError,
} from './errors';
import { toUserFacingError, UNEXPECTED_ERROR_MESSAGE } from './userFacing';

describe('errors', () => {
    it('keeps the legacy codes and zh-Hant messages', () => {
        const unavailable = new ExternalServiceUnavailableError({
            cause: new TypeError('x'),
        });

        expect(unavailable).toMatchObject({
            code: 'external_service_unavailable',
            message: '外部服務暫時無法連線，請稍後再試。',
            name: 'ExternalServiceUnavailableError',
        });
        expect(unavailable.cause).toBeInstanceOf(TypeError);
        expect(new SessionInvalidError(7)).toMatchObject({
            code: 'session_invalid',
            message: '請先登入課程平台。',
            failedAccountId: 7,
        });
    });

    it('maps errors to user-facing payloads like JsonExceptionRenderer', () => {
        expect(toUserFacingError(new SessionInvalidError(3))).toMatchObject({
            code: 'session_invalid',
            failedAccountId: 3,
        });
        expect(
            toUserFacingError(
                new UserFacingHttpError(403, '不允許存取外部資源'),
            ),
        ).toMatchObject({
            code: 'http_error',
            message: '不允許存取外部資源',
        });

        const unexpected = toUserFacingError(
            new RangeError('index out of range'),
        );

        expect(unexpected).toMatchObject({
            code: 'server_error',
            message: UNEXPECTED_ERROR_MESSAGE,
            exception: { class: 'RangeError', message: 'index out of range' },
        });
        expect(toUserFacingError('weird').exception).toEqual({
            class: 'string',
            message: 'weird',
            stack: [],
        });
    });
});
