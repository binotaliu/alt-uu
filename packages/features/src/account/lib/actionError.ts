import { UserFacingHttpError } from '@altuu/core';

/**
 * Thrown from a service mutation when the service answered `ok: false`: the
 * user-facing message survives the runtime's error mapping, and `raw` (for
 * example the HUNGU payload of a failed login) stays reachable through
 * `ServiceError.cause`.
 */
export class RejectedActionError extends UserFacingHttpError {
  readonly raw: unknown;

  constructor(message: string, raw?: unknown) {
    super(422, message);
    this.name = 'RejectedActionError';
    this.raw = raw;
  }
}

/** Pulls `raw` out of a ServiceError produced from a {@link RejectedActionError}. */
export function rawOf(error: unknown): unknown {
  const cause = (error as { cause?: unknown } | null)?.cause;

  return cause instanceof RejectedActionError ? cause.raw : undefined;
}
