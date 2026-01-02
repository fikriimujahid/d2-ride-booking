import type { ErrorRequestHandler } from 'express';
import { ApiError, HttpError } from '../models/error.model.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

function isBadJsonBodyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // Express body-parser sets `type` for JSON parse failures.
  const maybe = err as { type?: unknown; name?: unknown };
  return maybe.type === 'entity.parse.failed' || maybe.name === 'SyntaxError';
}

function normalizeZodError(err: ZodError): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    details: {
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    }
  });
}

function normalizeJoseJwtError(err: unknown): ApiError | null {
  if (!err || typeof err !== 'object') return null;
  const name = (err as { name?: unknown }).name;
  if (name === 'JWTExpired') {
    return new ApiError({
      status: 401,
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
      action: 'LOGIN'
    });
  }

  // Common jose error names include: JWTInvalid, JOSEError, JWSSignatureVerificationFailed.
  if (typeof name === 'string' && (name.startsWith('JWT') || name.includes('JWS') || name.includes('JOSE'))) {
    return new ApiError({
      status: 401,
      code: 'AUTH_UNAUTHENTICATED',
      message: 'Invalid or missing authentication token.',
      action: 'LOGIN'
    });
  }

  return null;
}

function normalizeAwsCognitoError(err: unknown): ApiError | null {
  if (!err || typeof err !== 'object') return null;

  const anyErr = err as {
    name?: unknown;
    message?: unknown;
    $metadata?: { httpStatusCode?: number };
  };

  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const httpStatusCode = typeof anyErr.$metadata?.httpStatusCode === 'number' ? anyErr.$metadata.httpStatusCode : undefined;

  // Cognito / AWS SDK v3 common exceptions.
  switch (name) {
    case 'NotAuthorizedException':
      return new ApiError({
        status: 401,
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Invalid email or password.',
        action: 'LOGIN',
        details: { reason: 'INVALID_CREDENTIALS' }
      });
    case 'UserNotFoundException':
      // Avoid leaking account existence.
      return new ApiError({
        status: 401,
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Invalid email or password.',
        action: 'LOGIN',
        details: { reason: 'INVALID_CREDENTIALS' }
      });
    case 'PasswordResetRequiredException':
      return new ApiError({
        status: 401,
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Password reset is required to continue.',
        action: 'LOGIN',
        details: { reason: 'PASSWORD_RESET_REQUIRED' }
      });
    case 'UserNotConfirmedException':
      return new ApiError({
        status: 401,
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Account confirmation is required to continue.',
        action: 'LOGIN',
        details: { reason: 'USER_NOT_CONFIRMED' }
      });
    case 'CodeMismatchException':
      return new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid verification code.',
        details: { reason: 'INVALID_CODE' }
      });
    case 'ExpiredCodeException':
      return new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'The verification code has expired.',
        details: { reason: 'CODE_EXPIRED' }
      });
    case 'InvalidParameterException':
    case 'InvalidPasswordException':
      return new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: { reason: name }
      });
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return new ApiError({
        status: httpStatusCode ?? 429,
        code: 'INTERNAL_ERROR',
        message: 'Too many requests. Please try again later.',
        action: 'RETRY',
        details: { reason: 'RATE_LIMITED' }
      });
    default:
      break;
  }

  // Some AWS errors surface as generic service exceptions with HTTP status.
  if (httpStatusCode && httpStatusCode >= 400 && httpStatusCode < 500) {
    return new ApiError({
      status: httpStatusCode,
      code: httpStatusCode === 401 ? 'AUTH_UNAUTHENTICATED' : httpStatusCode === 403 ? 'AUTH_FORBIDDEN' : 'VALIDATION_ERROR',
      message: httpStatusCode === 401 ? 'Authentication is required.' : 'Request could not be processed.',
      action: httpStatusCode === 401 ? 'LOGIN' : undefined
    });
  }

  return null;
}

function withRequestContext(err: ApiError, req: any): ApiError {
  const details = {
    ...(err.details ?? {}),
    method: req.method,
    path: req.originalUrl
  };
  return new ApiError({
    status: err.status,
    code: err.code,
    message: err.message,
    action: err.action,
    details
  });
}

export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  // Never log Authorization header or request body.
  logger.error('http_error', {
    method: req.method,
    path: req.originalUrl,
    status: err instanceof ApiError ? err.status : err instanceof HttpError ? err.status : 500,
    name: err instanceof Error ? err.name : 'UnknownError',
    message: err instanceof Error ? err.message : String(err),
    ...(env.NODE_ENV === 'production'
      ? {}
      : {
          stack: err instanceof Error ? err.stack : undefined
        })
  });

  // 1) Already-standard error.
  if (err instanceof ApiError) {
    const e = withRequestContext(err, req);
    return res.status(e.status).json(e.toResponse());
  }

  // 2) Legacy HttpError.
  if (err instanceof HttpError) {
    const e = withRequestContext(err, req);
    return res.status(e.status).json(e.toResponse());
  }

  // 3) Zod validation.
  if (err instanceof ZodError) {
    const e = withRequestContext(normalizeZodError(err), req);
    return res.status(e.status).json(e.toResponse());
  }

  // 4) Malformed JSON body.
  if (isBadJsonBodyError(err)) {
    const e = withRequestContext(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request body must be valid JSON.',
        details: { reason: 'INVALID_JSON' }
      }),
      req
    );
    return res.status(e.status).json(e.toResponse());
  }

  // 5) JWT verification errors.
  const jose = normalizeJoseJwtError(err);
  if (jose) {
    const e = withRequestContext(jose, req);
    return res.status(e.status).json(e.toResponse());
  }

  // 6) AWS Cognito (AWS SDK) errors.
  const cognito = normalizeAwsCognitoError(err);
  if (cognito) {
    const e = withRequestContext(cognito, req);
    return res.status(e.status).json(e.toResponse());
  }

  // Fail closed with minimal details.
  const internal = withRequestContext(
    new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.'
    }),
    req
  );
  return res.status(internal.status).json(internal.toResponse());
};
