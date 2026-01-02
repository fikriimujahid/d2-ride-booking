export const ERROR_CONTRACT_VERSION = 1 as const;

export type ErrorCode =
  | 'AUTH_UNAUTHENTICATED'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'MFA_REQUIRED'
  | 'MFA_NOT_ENROLLED'
  | 'RBAC_INSUFFICIENT_ROLE'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export type ErrorAction =
  | 'LOGIN'
  | 'SETUP_MFA'
  | 'RETRY'
  | 'CONTACT_SUPPORT'
  | 'NONE'
  | string;

export type ErrorDetails = Record<string, unknown>;

export type ApiErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    action?: ErrorAction;
    details?: ErrorDetails;
  };
};

function defaultMessageForCode(code: ErrorCode): string {
  switch (code) {
    case 'AUTH_UNAUTHENTICATED':
      return 'Authentication is required.';
    case 'AUTH_TOKEN_EXPIRED':
      return 'Your session has expired. Please sign in again.';
    case 'AUTH_FORBIDDEN':
      return 'You do not have access to this resource.';
    case 'MFA_REQUIRED':
      return 'Multi-factor authentication is required.';
    case 'MFA_NOT_ENROLLED':
      return 'Multi-factor authentication is not enrolled for this account.';
    case 'RBAC_INSUFFICIENT_ROLE':
      return 'You do not have the required role to perform this action.';
    case 'VALIDATION_ERROR':
      return 'Request validation failed.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'INTERNAL_ERROR':
    default:
      return 'An unexpected error occurred.';
  }
}

function mergeDetails(base: ErrorDetails | undefined, extra: unknown): ErrorDetails | undefined {
  const safeBase: ErrorDetails = base ? { ...base } : {};
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      // Avoid overriding known keys.
      if (k in safeBase) continue;
      safeBase[k] = v;
    }
  }
  return Object.keys(safeBase).length ? safeBase : undefined;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly action?: ErrorAction;
  public readonly details?: ErrorDetails;

  constructor(params: {
    status: number;
    code: ErrorCode;
    message?: string;
    action?: ErrorAction;
    details?: ErrorDetails;
  }) {
    super(params.message ?? defaultMessageForCode(params.code));
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.action = params.action;
    this.details = params.details;
  }

  public toResponse(): ApiErrorResponse {
    const details = mergeDetails(this.details, { contract_version: ERROR_CONTRACT_VERSION });
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.action ? { action: this.action } : {}),
        ...(details ? { details } : {})
      }
    };
  }
}

function codeFromStatus(status: number): ErrorCode {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'AUTH_UNAUTHENTICATED';
  if (status === 403) return 'AUTH_FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

/**
 * Back-compat wrapper: legacy code constructs HttpError with (status, message, payload).
 * We normalize it into the standard error contract.
 */
export class HttpError extends ApiError {
  public readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    const code = codeFromStatus(status);
    super({
      status,
      code,
      message: defaultMessageForCode(code),
      details: mergeDetails(
        {
          reason: message
        },
        payload
      )
    });
    this.name = 'HttpError';
    this.payload = payload;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(reason = 'UNAUTHORIZED', payload?: unknown) {
    super({
      status: 401,
      code: 'AUTH_UNAUTHENTICATED',
      action: 'LOGIN',
      details: mergeDetails({ reason }, payload)
    });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(reason = 'FORBIDDEN', payload?: unknown) {
    super({
      status: 403,
      code: 'AUTH_FORBIDDEN',
      details: mergeDetails({ reason }, payload)
    });
    this.name = 'ForbiddenError';
  }
}
