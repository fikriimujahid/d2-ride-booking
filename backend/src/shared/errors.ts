export type AppErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TOKEN_EXPIRED'
  | 'ADMIN_2FA_SETUP_REQUIRED'
  | 'OTP_REQUIRED'
  | 'INVALID_OTP'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'AUTH_CONFIG_ERROR'
  | 'SEED_CONFIG_ERROR'
  | 'SEED_FAILED';

export type AppErrorOptions = {
  statusCode?: number;
  code?: AppErrorCode;
  cause?: unknown;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: AppErrorCode;

  constructor(message: string, opts: AppErrorOptions = {}) {
    // Prefer native Error.cause where supported (Node 18+).
    super(message, { cause: opts.cause });
    this.name = 'AppError';
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code ?? 'INTERNAL_ERROR';
  }
}

export function isAppError(error: unknown): error is AppError {
  if (error instanceof AppError) return true;
  // Defensive fallback for cases where errors cross package boundaries.
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AppError';
}
