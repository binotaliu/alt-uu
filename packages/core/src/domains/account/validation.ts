import { UserFacingHttpError } from '../../errors/errors';

/** Laravel ValidationException (HTTP 422): `errors` maps a field to its messages. */
export class ValidationError extends UserFacingHttpError {
  readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    const first = Object.values(errors)[0]?.[0] ?? '資料格式不正確。';

    super(422, first);
    this.errors = errors;
  }

  static field(field: string, message: string): ValidationError {
    return new ValidationError({ [field]: [message] });
  }
}

/** Legacy PremiumRequiredException (HTTP 402). */
export class PremiumRequiredError extends UserFacingHttpError {
  static readonly MESSAGE = '此功能需要有效的 Alt UU+ 訂閱。';

  constructor() {
    super(402, PremiumRequiredError.MESSAGE);
  }
}

/** Route-model-binding miss (HTTP 404). */
export class NotFoundError extends UserFacingHttpError {
  constructor(message = '找不到指定的資料。') {
    super(404, message);
  }
}

/** Tells whether the Alt UU+ entitlement is active (wired by the subscription domain). */
export type EntitlementChecker = () => Promise<boolean>;

/** LoginInputData / AddAccountInputData rules (username arrives trimmed). */
export function assertCredentialsInput(input: {
  username: string;
  password: string;
}): void {
  const errors: Record<string, string[]> = {};

  if (input.username === '') {
    errors.username = ['請輸入學號或帳號。'];
  } else if ([...input.username].length > 191) {
    errors.username = ['username 不可超過 191 個字元。'];
  }

  if (input.password === '') {
    errors.password = ['請輸入密碼。'];
  } else if ([...input.password].length > 191) {
    errors.password = ['password 不可超過 191 個字元。'];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}
