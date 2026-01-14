/**
 * Authentication Error Helpers
 * 
 * Centralized error creation for authentication and authorization failures.
 * Provides consistent error codes and messages across the auth module.
 */

import { AppError } from '../../shared/errors.js';

/**
 * Invalid credentials (wrong password, user not found, inactive user).
 * Generic message to avoid leaking user existence.
 */
export function createInvalidCredentialsError(): AppError {
  return new AppError('Invalid credentials', {
    statusCode: 401,
    code: 'INVALID_CREDENTIALS'
  });
}

/**
 * Missing or invalid authentication token.
 */
export function createUnauthorizedError(message = 'Unauthorized'): AppError {
  return new AppError(message, {
    statusCode: 401,
    code: 'UNAUTHORIZED'
  });
}

/**
 * Valid auth but insufficient permissions.
 */
export function createForbiddenError(message = 'Forbidden'): AppError {
  return new AppError(message, {
    statusCode: 403,
    code: 'FORBIDDEN'
  });
}

/**
 * User lacks required permission for action.
 */
export function createInsufficientPermissionsError(): AppError {
  return new AppError('Insufficient permissions', {
    statusCode: 403,
    code: 'INSUFFICIENT_PERMISSIONS'
  });
}

/**
 * Admin must set up 2FA before proceeding.
 */
export function createAdmin2faSetupRequiredError(): AppError {
  return new AppError('Admin 2FA setup required', {
    statusCode: 428,
    code: 'ADMIN_2FA_SETUP_REQUIRED'
  });
}

/**
 * Invalid TOTP code provided.
 */
export function createInvalidOtpError(): AppError {
  return new AppError('Invalid OTP', {
    statusCode: 401,
    code: 'INVALID_OTP'
  });
}

/**
 * Input validation failure (bad format, missing fields).
 */
export function createValidationError(message: string): AppError {
  return new AppError(message, {
    statusCode: 400,
    code: 'VALIDATION_ERROR'
  });
}

/**
 * Configuration error in auth system (e.g., missing email for TOTP).
 */
export function createAuthConfigError(message: string): AppError {
  return new AppError(message, {
    statusCode: 500,
    code: 'AUTH_CONFIG_ERROR'
  });
}

/**
 * Resource conflict (e.g., 2FA already enabled).
 */
export function createConflictError(message: string): AppError {
  return new AppError(message, {
    statusCode: 409,
    code: 'VALIDATION_ERROR'
  });
}
