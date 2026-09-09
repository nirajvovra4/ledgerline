import type { ApiErrorCode } from '@ledgerline/shared';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_transition: 409,
  unbalanced_entry: 422,
  internal_error: 500,
};

/** An error that maps directly onto the API's JSON error envelope. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
  }

  toBody(): { error: { code: ApiErrorCode; message: string; details?: unknown } } {
    const body: { error: { code: ApiErrorCode; message: string; details?: unknown } } = {
      error: { code: this.code, message: this.message },
    };
    if (this.details !== undefined) body.error.details = this.details;
    return body;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function notFound(what = 'Resource'): AppError {
  return new AppError('not_found', `${what} not found`);
}

export function forbidden(message = 'You do not have permission to do that'): AppError {
  return new AppError('forbidden', message);
}

export function unauthenticated(message = 'Sign in to continue'): AppError {
  return new AppError('unauthenticated', message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError('conflict', message, details);
}

export function invalidTransition(message: string): AppError {
  return new AppError('invalid_transition', message);
}

export function unbalanced(debitCents: number, creditCents: number): AppError {
  return new AppError('unbalanced_entry', 'Debits must equal credits', { debitCents, creditCents });
}

/** A validation failure for a single field, shaped like a Zod issue so the web can render it. */
export function fieldError(path: string, message: string): AppError {
  return new AppError('validation_error', message, [{ path, message, code: 'custom' }]);
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError('validation_error', message, details);
}
