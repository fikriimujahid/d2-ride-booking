/**
 * CENTRALIZED ERROR DEFINITIONS
 * 
 * PURPOSE:
 * - Define all application error types in ONE place
 * - Ensure consistent HTTP status codes across all routes
 * - Type-safe error handling (TypeScript validation)
 * 
 * WHY CENTRALIZED:
 * - Prevents inconsistent APIs (same error, different status codes)
 * - Single source of truth for error codes and status codes
 * - Easy to add new error types (update one file)
 * - Client can rely on consistent error codes
 * 
 * USAGE EXAMPLE:
 * // In route handler
 * throw new AppError('Invalid email or password', { 
 *   code: 'INVALID_CREDENTIALS' 
 * });
 * // → Automatically returns HTTP 401 (from DEFAULT_STATUS_BY_CODE)
 * // → Client sees: { error: { code: 'INVALID_CREDENTIALS', ... } }
 */

/**
 * Machine-readable error codes
 * 
 * NAMING CONVENTION:
 * - UPPERCASE_SNAKE_CASE
 * - Descriptive (explain what went wrong)
 * - Domain-specific (ADMIN_2FA_SETUP_REQUIRED, not GENERIC_ERROR)
 * 
 * CLIENT USAGE:
 * Client can switch on these codes to show different UI:
 * 
 * if (error.code === 'TOKEN_EXPIRED') {
 *   redirectToLogin();
 * } else if (error.code === 'INSUFFICIENT_PERMISSIONS') {
 *   showUpgradePrompt();
 * } else if (error.code === 'OTP_REQUIRED') {
 *   show2FAPrompt();
 * }
 * 
 * CATEGORIES:
 * - Generic: INTERNAL_ERROR, VALIDATION_ERROR
 * - Auth: INVALID_CREDENTIALS, UNAUTHORIZED, FORBIDDEN, TOKEN_EXPIRED
 * - 2FA: ADMIN_2FA_SETUP_REQUIRED, OTP_REQUIRED, INVALID_OTP
 * - Permissions: INSUFFICIENT_PERMISSIONS
 * - Config/Seed: AUTH_CONFIG_ERROR, SEED_CONFIG_ERROR, SEED_FAILED
 */
export type AppErrorCode =
  | 'INTERNAL_ERROR'              // Generic 500 error
  | 'VALIDATION_ERROR'            // Invalid request data (400)
  | 'INVALID_CREDENTIALS'         // Wrong email/password (401)
  | 'UNAUTHORIZED'                // Not logged in (401)
  | 'FORBIDDEN'                   // Logged in, but not allowed (403)
  | 'TOKEN_EXPIRED'               // JWT expired (401)
  | 'ADMIN_2FA_SETUP_REQUIRED'    // Admin must set up 2FA (403)
  | 'OTP_REQUIRED'                // Need OTP code (401)
  | 'INVALID_OTP'                 // Wrong OTP code (401)
  | 'INSUFFICIENT_PERMISSIONS'    // Missing required permission (403)
  | 'AUTH_CONFIG_ERROR'           // Auth configuration invalid (500)
  | 'SEED_CONFIG_ERROR'           // Seed configuration invalid (500)
  | 'SEED_FAILED';                // Database seeding failed (500)

/**
 * Canonical mapping: Error Code → HTTP Status Code
 * 
 * SINGLE SOURCE OF TRUTH:
 * - Each error code maps to exactly ONE HTTP status
 * - Prevents inconsistent APIs (same error, different status in different routes)
 * - Enforced at construction time (AppError validates against this)
 * 
 * WHY THIS MATTERS:
 * 
 * WITHOUT CANONICAL MAPPING (bad):
 * // Route A
 * throw new AppError('Invalid credentials', { code: 'INVALID_CREDENTIALS', statusCode: 401 });
 * 
 * // Route B (different developer, forgot status code)
 * throw new AppError('Invalid credentials', { code: 'INVALID_CREDENTIALS', statusCode: 403 });
 * 
 * → Same error code, different status codes → Client confused
 * 
 * WITH CANONICAL MAPPING (good):
 * // Route A
 * throw new AppError('Invalid credentials', { code: 'INVALID_CREDENTIALS' });
 * → Automatically gets 401 from DEFAULT_STATUS_BY_CODE
 * 
 * // Route B
 * throw new AppError('Invalid credentials', { code: 'INVALID_CREDENTIALS' });
 * → Automatically gets 401 from DEFAULT_STATUS_BY_CODE
 * 
 * → Consistent API, client can rely on status codes
 * 
 * HTTP STATUS CODE MEANINGS:
 * - 400 Bad Request: Invalid input (VALIDATION_ERROR)
 * - 401 Unauthorized: Not authenticated (INVALID_CREDENTIALS, UNAUTHORIZED, TOKEN_EXPIRED, OTP_REQUIRED, INVALID_OTP)
 * - 403 Forbidden: Authenticated but not allowed (FORBIDDEN, ADMIN_2FA_SETUP_REQUIRED, INSUFFICIENT_PERMISSIONS)
 * - 500 Internal Server Error: Server fault (INTERNAL_ERROR, AUTH_CONFIG_ERROR, SEED_CONFIG_ERROR, SEED_FAILED)
 * 
 * OVERRIDE CAPABILITY:
 * You CAN override if needed:
 * throw new AppError('Custom error', { code: 'VALIDATION_ERROR', statusCode: 422 });
 * But generally should use defaults for consistency
 */
const DEFAULT_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  INTERNAL_ERROR: 500,              // Server fault, investigate immediately
  VALIDATION_ERROR: 400,            // Invalid request body, query params, etc.
  INVALID_CREDENTIALS: 401,         // Wrong email/password
  UNAUTHORIZED: 401,                // No valid JWT token
  FORBIDDEN: 403,                   // Has token, but lacks permission
  TOKEN_EXPIRED: 401,               // JWT expired, need to re-login
  ADMIN_2FA_SETUP_REQUIRED: 403,    // Admin must enable 2FA first
  OTP_REQUIRED: 401,                // Need OTP code for 2FA
  INVALID_OTP: 401,                 // Wrong OTP code
  INSUFFICIENT_PERMISSIONS: 403,    // Missing required role/permission
  AUTH_CONFIG_ERROR: 500,           // Auth secrets missing, config invalid
  SEED_CONFIG_ERROR: 500,           // Seed data invalid
  SEED_FAILED: 500,                 // Database seeding failed
};

/**
 * Options for creating AppError
 * 
 * All fields are optional:
 * - statusCode: Override default HTTP status (rarely needed)
 * - code: Error code (defaults to 'INTERNAL_ERROR')
 * - cause: Underlying error that caused this error (for error chaining)
 * 
 * EXAMPLES:
 * 
 * // Minimal (message only)
 * throw new AppError('Something went wrong');
 * → code: 'INTERNAL_ERROR', statusCode: 500
 * 
 * // With error code
 * throw new AppError('User not found', { code: 'VALIDATION_ERROR' });
 * → code: 'VALIDATION_ERROR', statusCode: 400 (from mapping)
 * 
 * // With custom status code (rare)
 * throw new AppError('Too many requests', { code: 'VALIDATION_ERROR', statusCode: 429 });
 * → code: 'VALIDATION_ERROR', statusCode: 429 (override)
 * 
 * // With cause (error chaining)
 * try {
 *   await db.query(...);
 * } catch (err) {
 *   throw new AppError('Failed to fetch user', { 
 *     code: 'INTERNAL_ERROR',
 *     cause: err  // Original database error preserved
 *   });
 * }
 */
export type AppErrorOptions = {
  statusCode?: number;      // HTTP status code (overrides default)
  code?: AppErrorCode;      // Machine-readable error code
  cause?: unknown;          // Underlying error (for error chaining)
};

/**
 * Custom application error class
 * 
 * Extends native Error with:
 * - statusCode: HTTP status code (for error handler)
 * - code: Machine-readable error code (for client)
 * - Immutability: Object.freeze() prevents modification
 * - Validation: Ensures statusCode is valid HTTP error (400-599)
 * 
 * WHY CUSTOM ERROR CLASS:
 * - Type-safe error codes (TypeScript validates)
 * - Automatic status code mapping (from DEFAULT_STATUS_BY_CODE)
 * - Consistent error format across application
 * - Easy to identify app errors vs third-party errors (isAppError)
 */
export class AppError extends Error {
  // HTTP status code (400-599)
  // readonly: Cannot be changed after construction (immutability)
  public readonly statusCode: number;
  
  // Machine-readable error code
  // readonly: Cannot be changed after construction (immutability)
  public readonly code: AppErrorCode;

  /**
   * Create new application error
   * 
   * @param message - Human-readable error message (shown to users)
   * @param opts - Optional configuration (code, statusCode, cause)
   * 
   * CONSTRUCTION FLOW:
   * 1. Determine error code (from opts or default to 'INTERNAL_ERROR')
   * 2. Determine status code (from opts or lookup in DEFAULT_STATUS_BY_CODE)
   * 3. Validate status code (must be 400-599)
   * 4. Call super() to initialize Error base class
   * 5. Set properties (name, code, statusCode)
   * 6. Freeze object (immutability)
   */
  constructor(message: string, opts: AppErrorOptions = {}) {
    // STEP 1: Determine error code
    // Use provided code, or default to 'INTERNAL_ERROR'
    const code = opts.code ?? 'INTERNAL_ERROR';
    
    // STEP 2: Determine HTTP status code
    // Priority:
    // 1. opts.statusCode (explicit override)
    // 2. DEFAULT_STATUS_BY_CODE[code] (canonical mapping)
    // 3. 500 (ultimate fallback)
    const statusCode = opts.statusCode ?? DEFAULT_STATUS_BY_CODE[code] ?? 500;

    // STEP 3: Validate status code is in valid HTTP error range
    // 400-499: Client errors (bad request, unauthorized, forbidden, etc.)
    // 500-599: Server errors (internal error, service unavailable, etc.)
    // If invalid (e.g., 200, 999), throw error (fail fast)
    if (statusCode < 400 || statusCode > 599) {
      throw new Error(`Invalid statusCode for AppError: ${statusCode}`);
    }
    
    // STEP 4: Initialize Error base class
    // - message: Human-readable error message
    // - cause: Optional underlying error (error chaining)
    super(message, { cause: opts.cause });

    // STEP 5: Set error properties
    this.name = 'AppError';        // Error class name (for instanceof checks)
    this.code = code;              // Machine-readable code
    this.statusCode = statusCode;  // HTTP status code

    // STEP 6: Freeze object (immutability)
    // Prevents modification after construction:
    // const err = new AppError('test');
    // err.code = 'OTHER_CODE';  // Throws error (frozen)
    // err.statusCode = 400;     // Throws error (frozen)
    Object.freeze(this);
  }
}

/**
 * Type guard: Check if error is AppError
 * 
 * PURPOSE:
 * - Safely determine if unknown error is an AppError instance
 * - TypeScript narrows type (error is AppError)
 * - Access AppError properties safely (code, statusCode)
 * 
 * WHY TYPE GUARD:
 * Without type guard:
 * function handleError(error: unknown) {
 *   const code = error.code;  // TypeScript error: unknown has no 'code'
 * }
 * 
 * With type guard:
 * function handleError(error: unknown) {
 *   if (isAppError(error)) {
 *     const code = error.code;  // TypeScript knows error is AppError
 *   }
 * }
 * 
 * TWO-LEVEL CHECK:
 * 1. instanceof AppError (standard check)
 * 2. name === 'AppError' (defensive fallback)
 * 
 * WHY DEFENSIVE FALLBACK:
 * When errors cross package boundaries (e.g., different Node.js realms, webpack bundles),
 * instanceof may fail even for AppError instances:
 * 
 * // Package A
 * class AppError extends Error { ... }
 * throw new AppError('test');
 * 
 * // Package B (different class definition)
 * import { AppError } from 'package-a';
 * catch (err) {
 *   err instanceof AppError  // May be false (different class reference)
 *   err.name === 'AppError'  // Still true (string comparison)
 * }
 * 
 * EDGE CASES HANDLED:
 * - null/undefined → false
 * - Non-object types → false
 * - Objects without 'name' → false
 * - Objects with wrong 'name' → false
 * 
 * @param error - Any value (unknown type)
 * @returns true if error is AppError (TypeScript narrows type)
 */
export function isAppError(error: unknown): error is AppError {
  // PRIMARY CHECK: instanceof (standard, fast)
  if (error instanceof AppError) return true;
  
  // DEFENSIVE FALLBACK: Check by name property
  // Handles cross-package-boundary errors
  return typeof error === 'object' &&      // Is an object
    error !== null &&                      // Not null (typeof null === 'object')
    (error as { name?: unknown }).name === 'AppError';  // Has name property === 'AppError'
}
