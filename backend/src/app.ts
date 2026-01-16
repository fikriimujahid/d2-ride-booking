// ========================================
// APPLICATION BUILDER
// ========================================
// This module creates and configures the Fastify application instance.
// It does NOT start the server - that happens in server.ts.
//
// Responsibilities:
// - Create Fastify instance with configuration (logger, JSON schema validator, proxy trust)
// - Register security plugins FIRST (helmet, rate limiting, CORS)
// - Register cross-cutting plugins (DB, logging, error handling, documentation)
// - Register feature modules (health check, authentication)
//
// **CRITICAL: Plugin registration order matters!**
// 1. Security plugins (helmet, rate limit, CORS) - protect all routes
// 2. Error handling - catch errors from all routes
// 3. Documentation (Swagger) - introspect routes after registration
// 4. Infrastructure (DB, logging) - available to all routes
// 5. Route modules (health, auth) - define HTTP endpoints
//
// This modular structure allows:
// - Testing the app without starting a server (integration tests)
// - Reusing the same config in different environments
// - Adding new feature modules without touching infrastructure
// - Security-first approach (security plugins loaded before any routes)

import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

// Import config as a side effect to validate environment variables early.
// If any required env vars are missing, the process will crash before creating the app.
// This "fail fast" approach prevents misconfigured servers from starting.
import './config/env.js';
import { env } from './config/env.js';

// Infrastructure plugins
import { dbPlugin } from './plugins/db.js';
import { corsPlugin } from './plugins/cors.js';
import { correlationIdPlugin } from './plugins/correlation-id.js';

// Middleware plugins
import { apiDbLoggerPlugin } from './plugins/api-db-logger.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';

// Documentation plugin
import { swaggerPlugin } from './plugins/swagger.js';

// Feature modules (route handlers)
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';

// Options for buildApp() - allows tests to disable logging
export type BuildAppOptions = {
  logger?: boolean; // If false, disable Fastify's built-in logger
};

// API versioning prefix for all routes
// Example: /api/v1/health, /api/v1/auth/login
const API_PREFIX = '/api/v1';

/**
 * Build and configure the Fastify application instance.
 * 
 * This function is idempotent and pure - it creates a new app each time.
 * Used by:
 * - server.ts (production entry point)
 * - test files (integration/unit tests)
 * 
 * @param opts - Configuration options
 * @param opts.logger - Enable/disable logging (default: true in dev/prod, false in tests)
 * @returns Configured Fastify instance (not yet listening on a port)
 */
export function buildApp(
  opts: BuildAppOptions = {}
): FastifyInstance {
  // ========================================
  // STEP 1: CREATE FASTIFY INSTANCE
  // ========================================
  const app = Fastify({
    // ========================================
    // LOGGER CONFIGURATION
    // ========================================
    // Enable structured JSON logging in dev/prod, disable in tests.
    // Logger is built on Pino - high-performance, low-overhead JSON logger.
    // Logs include:
    // - Request/response logs (method, path, status, duration)
    // - Error logs (stack traces, context)
    // - Custom application logs (app.log.info(), app.log.error(), etc.)
    logger: opts.logger ?? env.nodeEnv !== 'test',

    // ========================================
    // PROXY TRUST CONFIGURATION
    // ========================================
    // trustProxy: true
    // Trust X-Forwarded-* headers from reverse proxy (ALB, nginx, CloudFlare).
    // 
    // Why this matters:
    // - Behind ALB: Client IP is in X-Forwarded-For, not socket.remoteAddress
    // - Without this: request.ip would be ALB's IP (10.0.x.x), not client's real IP
    // - With this: request.ip correctly returns client's public IP
    // 
    // Headers trusted:
    // - X-Forwarded-For: Original client IP
    // - X-Forwarded-Host: Original host header
    // - X-Forwarded-Proto: Original protocol (http/https)
    // 
    // Security note:
    // - Only enable if behind a trusted proxy (ALB, nginx)
    // - If directly exposed to internet, set to false (clients can spoof headers)
    trustProxy: true,

    // ========================================
    // JSON SCHEMA VALIDATOR (AJV) CONFIGURATION
    // ========================================
    // Fastify uses AJV to validate request/response against JSON schemas.
    // These options control validation behavior and error reporting.
    ajv: {
      customOptions: {
        // Collect ALL validation errors, not just the first one.
        // Better developer experience: see all issues at once.
        // Example: If email and password are both invalid, report both errors.
        allErrors: true,

        // Automatically strip unknown fields from request body/query/params.
        // Security: prevents clients from injecting unexpected data.
        // Example: If schema defines { email, password }, ignore { email, password, isAdmin }.
        removeAdditional: 'all',

        // Attempt to coerce types automatically.
        // Example: Query param "?page=5" (string) → coerced to number 5.
        // Useful for URL params which are always strings by default.
        coerceTypes: true,

        // Apply default values defined in schema.
        // Example: If schema says { limit: { type: 'number', default: 10 } }, missing limit → 10.
        useDefaults: true
      },

      // ========================================
      // AJV PLUGINS: CUSTOM KEYWORDS
      // ========================================
      // AJV plugins allow extending the validator with custom keywords.
      // Here we register the "example" keyword for OpenAPI/Swagger compatibility.
      plugins: [
        (ajvInstance: unknown) => {
          // ========================================
          // TYPE GUARD: Ensure ajvInstance has addKeyword method
          // ========================================
          // TypeScript doesn't know the shape of ajvInstance (it's unknown).
          // We need to verify it has the addKeyword method before calling it.
          if(
            typeof ajvInstance === 'object' &&
            ajvInstance !== null &&
            'addKeyword' in ajvInstance &&
            typeof (ajvInstance as { addKeyword: (def: { keyword: string }) => void })
            .addKeyword === 'function'
          ) {
            try {
              // ========================================
              // REGISTER "example" KEYWORD
              // ========================================
              // OpenAPI/Swagger uses "example" field in schemas for documentation.
              // Example:
              // {
              //   type: 'string',
              //   format: 'email',
              //   example: 'user@example.com'  ← This field
              // }
              // 
              // AJV doesn't recognize this keyword and would fail validation.
              // Register "example" as a no-op keyword so AJV ignores it.
              (ajvInstance as {
                addKeyword: (def: { keyword: string }) => void;
              }).addKeyword({ keyword: 'example' });
            } catch (err) {
              // ========================================
              // ERROR HANDLING: Keyword already registered
              // ========================================
              // If keyword already registered (e.g., by another plugin), ignore error.
              // This prevents crashes on re-initialization (hot reload, tests).
              if(
                err instanceof Error &&
                err.message.includes('already defined')
              ) {
                return; // Keyword exists, continue silently
              }
              // Unknown error: re-throw
              throw err;
            }
          }
        }
      ]
    }
  });

  // ========================================
  // STEP 2: REGISTER SECURITY PLUGINS (FIRST!)
  // ========================================
  // Security plugins MUST be registered before routes.
  // They protect all HTTP endpoints from common attacks.
  // 
  // **Order matters**: Security → Error Handling → Routes

  /**
   * ===== Core Security Plugins =====
   * These MUST be registered before routes
   */

  // ========================================
  // HELMET: Security Headers
  // ========================================
  // Sets secure HTTP headers to protect against common web vulnerabilities.
  // 
  // Headers added:
  // - X-Content-Type-Options: nosniff (prevent MIME sniffing)
  // - X-Frame-Options: DENY (prevent clickjacking)
  // - X-XSS-Protection: 1; mode=block (XSS protection)
  // - Strict-Transport-Security: max-age=15552000 (force HTTPS)
  // - Content-Security-Policy: restrict resource loading
  // 
  // Why this matters:
  // - Prevents XSS attacks (cross-site scripting)
  // - Prevents clickjacking (embedding site in iframe)
  // - Enforces HTTPS in production
  // - Meets OWASP security standards
  void app.register(helmet);

  // ========================================
  // RATE LIMITING: Protect Against Abuse
  // ========================================
  // Limits number of requests per IP address to prevent:
  // - Brute force attacks (login, password reset)
  // - DDoS attacks (distributed denial of service)
  // - API abuse (scraping, spam)
  // 
  // Configuration:
  // - max: 10 requests
  // - timeWindow: 1 minute
  // - Result: 10 requests per minute per IP
  // 
  // Response when limit exceeded:
  // - Status: 429 Too Many Requests
  // - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  // 
  // Production tuning:
  // - Auth endpoints: 5 requests/min (prevent brute force)
  // - Read endpoints: 100 requests/min (normal usage)
  // - Write endpoints: 20 requests/min (prevent spam)
  // 
  // Note: Current config is global (all routes).
  // For route-specific limits, configure in route handlers.
  void app.register(rateLimit, {
    max: 50,              // Maximum requests per window
    timeWindow: '1 minute', // Time window for rate limit
  });

  // ========================================
  // CORS: Cross-Origin Resource Sharing
  // ========================================
  // Handles Cross-Origin Resource Sharing headers.
  // Allows frontend (web_admin, web_driver, web_passenger) to call the API.
  // 
  // Configuration:
  // - Dev/test: Allow all origins (localhost:3000, localhost:5173, etc.)
  // - Prod: Only allow origins in CORS_ORIGINS env var
  // 
  // See plugins/cors.ts for detailed explanation.
  void app.register(corsPlugin);

  // ========================================
  // CORRELATION ID: User Action / Flow Tracing
  // ========================================
  // Must run early so ALL downstream hooks/handlers can access request.correlationId
  // and so request-scoped logging is automatically bound to the correlationId.
  void app.register(correlationIdPlugin);

  // ========================================
  // STEP 3: REGISTER ERROR HANDLING & OBSERVABILITY
  // ========================================
  // Error handler MUST be registered before routes.
  // It catches all errors thrown by routes and formats responses.

  /**
   * ===== Observability & Error Handling =====
   */

  // ========================================
  // ERROR HANDLER: Centralized Error Management
  // ========================================
  // Centralizes error handling for all HTTP requests.
  // Converts errors to consistent JSON format:
  // { error: { code: 'ERROR_CODE', message: 'Human-readable message' } }
  // 
  // Behavior:
  // - Known errors (AppError): Return custom status code and message
  // - Unknown errors: Return 500 Internal Server Error
  // - Production: Hide internal error messages (security)
  // - Dev/test: Show full error messages for debugging
  // 
  // See plugins/error-handler.ts for detailed explanation.
  void app.register(errorHandlerPlugin);

  // ========================================
  // SWAGGER: API Documentation
  // ========================================
  // Generates OpenAPI spec and serves Swagger UI.
  // - Enabled in dev/test for API exploration
  // - Disabled in production (security: don't expose API structure)
  // 
  // Accessible at:
  // - /docs (Swagger UI)
  // - /openapi.json (raw spec)
  // 
  // See plugins/swagger.ts for detailed explanation.
  void app.register(swaggerPlugin);

  // ========================================
  // STEP 4: REGISTER INFRASTRUCTURE PLUGINS
  // ========================================
  // Infrastructure plugins provide core services to routes.
  // Registered after security/error handling, before routes.

  /**
   * ===== Infrastructure Plugins =====
   */

  // ========================================
  // DATABASE: PostgreSQL Connection Pool
  // ========================================
  // Creates a PostgreSQL connection pool and decorates Fastify with app.db.
  // All routes can access the database via app.db.query().
  // On app.close(), the pool is automatically cleaned up (onClose hook).
  // 
  // See plugins/db.ts for detailed explanation.
  void app.register(dbPlugin);

  // ========================================
  // API LOGGER: Request Audit Logging
  // ========================================
  // Logs every request to the api_request_logs table.
  // Tracks:
  // - HTTP method, path, query params, headers
  // - User ID, role (if authenticated)
  // - Status code, duration, error code
  // 
  // Used for:
  // - Security audit (who accessed what, when)
  // - Performance monitoring (slow requests)
  // - Debugging production issues
  // 
  // See plugins/api-db-logger.ts for detailed explanation.
  void app.register(apiDbLoggerPlugin); 

  // ========================================
  // STEP 5: REGISTER FEATURE MODULES (ROUTES)
  // ========================================
  // Feature modules define HTTP endpoints.
  // Each module is a Fastify plugin that registers routes.
  // All routes are prefixed with /api/v1.
  // 
  // Registered LAST so security/error handling applies to all routes.

  /**
   * ===== Routes =====
   */

  // ========================================
  // HEALTH CHECK ROUTES
  // ========================================
  // Provides /api/v1/health endpoint for monitoring.
  // Used by:
  // - ALB health checks (production)
  // - systemd health checks (EC2)
  // - Uptime monitoring services
  void app.register(healthRoutes, { prefix: API_PREFIX });

  // ========================================
  // AUTHENTICATION ROUTES
  // ========================================
  // Provides endpoints for:
  // - User login (email/password)
  // - Token refresh
  // - MFA (TOTP setup, challenge, verify)
  // - Session management
  void app.register(authRoutes, { prefix: API_PREFIX });

  // ========================================
  // STEP 6: RETURN CONFIGURED APP
  // ========================================
  // The app is fully configured but NOT listening on a port yet.
  // server.ts will call app.listen() to start accepting connections.
  return app;
}