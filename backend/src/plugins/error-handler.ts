/**
 * CENTRALIZED ERROR HANDLER PLUGIN
 * 
 * PURPOSE:
 * - Catch ALL errors thrown in route handlers, plugins, or middleware
 * - Convert errors into standardized JSON responses
 * - Hide sensitive error details in production (security)
 * - Log errors with request context for debugging
 * 
 * WHY CENTRALIZED:
 * - Consistent error format across all routes (code, message, requestId)
 * - Single place to implement security rules (hide stack traces, 5xx messages)
 * - Automatic error logging (no need to log in every route handler)
 * - Reduces code duplication (no try/catch in every route)
 * 
 * FLOW:
 * 1. Route handler throws error: throw new AppError('User not found')
 * 2. Fastify catches error (doesn't crash server)
 * 3. This error handler runs (setErrorHandler)
 * 4. Determine status code (getStatusCode)
 * 5. Log error with context (logError)
 * 6. Return standardized JSON (ErrorResponse)
 * 
 * SECURITY FEATURES:
 * - Production: Hide 5xx error messages (prevent info leakage)
 * - Development: Show full error messages (easier debugging)
 * - Always include requestId (correlate logs with requests)
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { isAppError, type AppError } from '../shared/errors.js';
import { env } from '../config/env.js';

/**
 * Standardized error response format
 * 
 * All errors return this JSON structure:
 * {
 *   "error": {
 *     "code": "INVALID_CREDENTIALS",
 *     "message": "Invalid email or password",
 *     "requestId": "req-abc123"
 *   }
 * }
 * 
 * FIELDS:
 * - code: Machine-readable error code (uppercase snake_case)
 * - message: Human-readable description (shown to users)
 * - requestId: Correlation ID (find logs for this request)
 * 
 * CLIENT USAGE:
 * if (response.error.code === 'INVALID_CREDENTIALS') {
 *   showLoginError();
 * }
 */
type ErrorResponse = {
  error: {
    code: string;        // Error code (e.g., "VALIDATION_ERROR")
    message: string;     // User-facing message
    requestId: string;   // Correlation ID for logs
  };
};

/**
 * Extract HTTP status code from error object
 * 
 * WHY:
 * - Errors come from different sources (AppError, Fastify, third-party libraries)
 * - Need consistent logic to determine HTTP status code
 * - Default to 500 if unable to determine (fail safe)
 * 
 * PRIORITY ORDER:
 * 1. AppError.statusCode (our custom errors)
 * 2. error.statusCode (Fastify validation errors, etc.)
 * 3. 500 Internal Server Error (unknown errors)
 * 
 * EXAMPLES:
 * 
 * AppError:
 * throw new AppError('Not found', { code: 'VALIDATION_ERROR' });
 * → getStatusCode() → 400 (from AppError.statusCode)
 * 
 * Fastify validation error:
 * { statusCode: 400, message: 'body.email must be valid' }
 * → getStatusCode() → 400 (from error.statusCode)
 * 
 * Unknown error:
 * throw new Error('Something broke');
 * → getStatusCode() → 500 (default)
 * 
 * VALIDATION:
 * - Only accept status codes in range 400-599 (valid HTTP errors)
 * - Reject invalid codes (e.g., 200, 999) → default to 500
 * 
 * @param error - Any error thrown in the application
 * @returns HTTP status code (400-599)
 */
function getStatusCode(error: unknown): number {
  // CASE 1: AppError (our custom error class)
  // Has guaranteed valid statusCode property
  if (isAppError(error)) return error.statusCode;
  
  // CASE 2: Generic error object with statusCode property
  // (Fastify validation errors, third-party libraries)
  if (
    typeof error === 'object' &&      // Is an object
    error !== null &&                 // Not null
    'statusCode' in error &&          // Has statusCode property
    typeof (error as { statusCode: unknown }).statusCode === 'number'  // statusCode is a number
  ) {
    const status = (error as { statusCode: number }).statusCode;
    
    // Validate status code is in valid HTTP error range (400-599)
    // 400-499: Client errors (bad request, unauthorized, etc.)
    // 500-599: Server errors (internal error, service unavailable, etc.)
    if (status >= 400 && status <= 599) return status;
  }
  
  // CASE 3: Unknown error type → default to 500
  // Safe fallback for unexpected errors
  return 500;
}

/**
 * Determine user-facing error message (with security filtering)
 * 
 * SECURITY RULE:
 * - Production + 5xx error → HIDE details (return generic message)
 * - Development or 4xx error → SHOW details (return actual message)
 * 
 * WHY HIDE 5xx MESSAGES IN PRODUCTION:
 * BAD (reveals internal details):
 *   "Database connection failed at postgresql://admin:password@db.internal:5432"
 *   "Error: Cannot read property 'id' of undefined at AuthService.ts:45"
 * 
 * GOOD (generic message):
 *   "Internal Server Error"
 * 
 * SECURITY BENEFITS:
 * - Don't leak database credentials
 * - Don't leak file paths and line numbers
 * - Don't leak internal service names
 * - Don't leak stack traces (contain code structure)
 * 
 * 4xx ERRORS (client errors) - SAFE TO SHOW:
 * - "Invalid email format" (400)
 * - "User not found" (404)
 * - "Insufficient permissions" (403)
 * → Client's fault, no internal details leaked
 * 
 * 5xx ERRORS (server errors) - HIDE IN PRODUCTION:
 * - "Database connection lost" (500)
 * - "Failed to connect to Redis" (500)
 * - "Null pointer exception" (500)
 * → Server's fault, may contain sensitive info
 * 
 * DEVELOPMENT MODE:
 * - Always show full error messages (easier debugging)
 * - Stack traces visible in logs
 * 
 * @param error - Any error thrown in the application
 * @param statusCode - HTTP status code (from getStatusCode)
 * @returns User-facing error message (filtered for security)
 */
function getPublicMessage(error: unknown, statusCode: number): string {
  // SECURITY FILTER: Hide 5xx error details in production
  if (env.nodeEnv === 'production' && statusCode >= 500) {
    // Return generic message (no internal details)
    // Full error still logged (see logError function)
    return 'Internal Server Error';
  }

  // Extract message from error object
  // CASE 1: Standard Error object (has .message property)
  if (error instanceof Error) return error.message;
  
  // CASE 2: String thrown as error (rare)
  // Example: throw 'Something went wrong'
  if (typeof error === 'string') return error;

  // CASE 3: Unknown error type (very rare)
  // Example: throw 123 or throw null
  return 'Unknown error';
}

/**
 * Log error with request context (for debugging and monitoring)
 * 
 * PURPOSE:
 * - All errors logged with request details (correlation)
 * - Different log levels for client vs server errors
 * - Full error object logged (even if hidden from client)
 * 
 * LOG LEVELS:
 * - 5xx errors → log.error() (critical, needs investigation)
 * - 4xx errors → log.warn() (expected, client's fault)
 * 
 * WHY DIFFERENT LEVELS:
 * - 5xx: Server bug, alert on-call engineer, investigate immediately
 * - 4xx: Expected behavior (invalid input, auth failures), lower priority
 * 
 * LOG CONTEXT (structured logging):
 * {
 *   "requestId": "req-abc123",   // Correlate with request logs
 *   "method": "POST",             // HTTP method
 *   "url": "/api/v1/auth/login",  // Route that failed
 *   "statusCode": 401,            // HTTP status
 *   "err": { ... }                // Full error object (message, stack, etc.)
 * }
 * 
 * DEBUGGING WORKFLOW:
 * 1. User reports error, provides requestId
 * 2. Search logs: { requestId: "req-abc123" }
 * 3. Find error log with full context
 * 4. See stack trace, request details, error cause
 * 
 * MONITORING:
 * - Alert on error rate spike (5xx errors > 1% of requests)
 * - Track 4xx patterns (brute force attempts, API abuse)
 * - Analyze error trends (which endpoints fail most)
 * 
 * @param app - Fastify app instance (has logger)
 * @param request - Fastify request object (for context)
 * @param error - Full error object (logged completely)
 * @param statusCode - HTTP status code (determines log level)
 */
function logError(
  request: FastifyRequest,
  error: unknown,
  statusCode: number
): void {
  // Build structured log context
  const logContext = {
    requestId: request.id,      // Per-request identifier (Fastify's request.id)
    correlationId: request.correlationId, // Flow identifier (x-correlation-id)
    method: request.method,     // GET, POST, PUT, etc.
    url: request.url,           // /api/v1/auth/login
    statusCode,                 // 400, 401, 500, etc.
    err: error,                 // Full error object (Pino serializes this)
  };

  // Log level based on error type
  if (statusCode >= 500) {
    // Server error (5xx) → ERROR level
    // Indicates server bug, needs immediate attention
    // May trigger alerts in production monitoring
    // Use request-scoped logger so correlationId binding stays correct under concurrency.
    request.log.error(logContext, 'server error');
  } else {
    // Client error (4xx) → WARN level
    // Expected errors (bad input, auth failures)
    // Lower priority, but still tracked
    request.log.warn(logContext, 'client error');
  }
}

/**
 * FASTIFY ERROR HANDLER PLUGIN
 * 
 * Registers global error handler that processes ALL uncaught errors
 * Runs AFTER route handlers throw errors
 * 
 * EXECUTION FLOW:
 * 1. Route handler: throw new AppError('User not found', { code: 'VALIDATION_ERROR' });
 * 2. Fastify: Catches error, passes to setErrorHandler
 * 3. This function: Processes error, builds response
 * 4. Client: Receives standardized JSON error
 * 
 * PROCESSING STEPS:
 * 1. Extract status code (getStatusCode) → 400, 401, 500, etc.
 * 2. Log error with context (logError) → CloudWatch, Datadog
 * 3. Determine error code (AppError.code or default)
 * 4. Get public message (getPublicMessage) → security-filtered
 * 5. Build response object (ErrorResponse)
 * 6. Send to client (reply.send)
 */
export const errorHandlerPlugin: FastifyPluginAsync = fp(async (app) => {
  /**
   * Global error handler registered with Fastify
   * 
   * PARAMETERS:
   * @param error - Error thrown anywhere in request lifecycle
   * @param request - Fastify request object (for context)
   * @param reply - Fastify reply object (to send response)
   * 
   * WHEN IT RUNS:
   * - Route handler throws: throw new AppError(...)
   * - Validation fails: AJV validation error
   * - Unhandled promise rejection in route
   * - Plugin initialization error
   * - Any uncaught error in request processing
   */
  app.setErrorHandler((error, request, reply) => {
    // STEP 1: Determine HTTP status code
    // Extracts from AppError, Fastify error, or defaults to 500
    const statusCode = getStatusCode(error);
    
    // STEP 2: Log error with full context
    // - 5xx → log.error (critical)
    // - 4xx → log.warn (expected)
    // Full error object logged (even if hidden from client)
    logError(request, error, statusCode);
    
    // STEP 3: Determine error code (machine-readable)
    // - AppError → use error.code (e.g., "INVALID_CREDENTIALS")
    // - Other errors → default to "INTERNAL_ERROR"
    const code = isAppError(error) ? (error as AppError).code : 'INTERNAL_ERROR';
    
    // STEP 4: Get public message (security-filtered)
    // - Production + 5xx → "Internal Server Error" (hide details)
    // - Development or 4xx → actual error message
    const message = getPublicMessage(error, statusCode);

    // STEP 5: Build standardized error response
    const response: ErrorResponse = {
      error: {
        code,                // Machine-readable code
        message,             // Human-readable message (security-filtered)
        requestId: request.id,  // Per-request identifier (use x-correlation-id header for flow-level tracing)
      },
    };

    // STEP 6: Send error response to client
    // void keyword: Ignore promise (Fastify handles async send internally)
    void reply.status(statusCode).send(response);
  });
});
