import type { AccountId } from '../session/types';

/**
 * Machine-readable error codes. They match the `code` field the legacy JSON
 * API returned, so UI code ported from the Vue app can keep switching on them.
 */
export type AltUUErrorCode =
  | 'external_service_unavailable'
  | 'session_invalid'
  | 'http_error'
  | 'server_error';

/**
 * Base class for errors whose `message` is written for the user (zh-Hant).
 * Anything that is not an AltUUError is a programming error and is shown
 * with the generic copy from {@link toUserFacingError}.
 */
export class AltUUError extends Error {
  readonly code: AltUUErrorCode;

  constructor(
    message: string,
    code: AltUUErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * An upstream service could not be reached (DNS, TLS, timeout, connection
 * reset). Port of legacy ExternalServiceUnavailableException, which Laravel
 * raised for every Http client ConnectionException (HTTP 503).
 */
export class ExternalServiceUnavailableError extends AltUUError {
  static readonly MESSAGE = '外部服務暫時無法連線，請稍後再試。';

  constructor(options?: { cause?: unknown }) {
    super(
      ExternalServiceUnavailableError.MESSAGE,
      'external_service_unavailable',
      options,
    );
  }
}

/**
 * The HUNGU session is missing and a remembered re-login failed. Port of the
 * legacy EnsureHunguSession 401 `{code: 'session_invalid', accountId}`.
 * `failedAccountId` is the account that was active when the check started,
 * so concurrent callers can all report which account died.
 */
export class SessionInvalidError extends AltUUError {
  static readonly MESSAGE = '請先登入課程平台。';

  readonly failedAccountId: AccountId | null;

  constructor(
    failedAccountId: AccountId | null,
    options?: { cause?: unknown },
  ) {
    super(SessionInvalidError.MESSAGE, 'session_invalid', options);
    this.failedAccountId = failedAccountId;
  }
}

/**
 * An error whose message was written for the user, like a legacy
 * `abort(403, '不允許存取外部資源')`. `status` is informational.
 */
export class UserFacingHttpError extends AltUUError {
  readonly status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, 'http_error', options);
    this.status = status;
  }
}
