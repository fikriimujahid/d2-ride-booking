import fp from 'fastify-plugin';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../config/env.js';

/**
 * CORS CONFIGURATION PLUGIN
 * 
 * PURPOSE:
 * - Control which frontend domains can make API requests to this backend
 * - Prevent unauthorized websites from stealing user data (CSRF protection)
 * - Allow legitimate frontends (admin dashboard, driver app, passenger app)
 * 
 * SECURITY CONTEXT:
 * - Browser enforces Same-Origin Policy (blocks cross-origin requests by default)
 * - CORS headers tell browser: "This backend allows requests from these origins"
 * - Without CORS, frontend at https://app.example.com can't call API at https://api.example.com
 * 
 * PRODUCTION BEHAVIOR:
 * - Only origins in CORS_ORIGINS environment variable are allowed
 * - Example: CORS_ORIGINS="https://admin.example.com,https://driver.example.com"
 * - Requests from unlisted origins → blocked (browser sees no Access-Control-Allow-Origin header)
 * 
 * DEVELOPMENT BEHAVIOR:
 * - All origins allowed (permissive mode)
 * - Simplifies local development (frontend on localhost:3000, backend on localhost:3001)
 */

/**
 * Parse comma-separated origins from environment variable
 * 
 * INPUT:  "https://app.example.com, https://admin.example.com, https://driver.example.com"
 * OUTPUT: ["https://app.example.com", "https://admin.example.com", "https://driver.example.com"]
 * 
 * WHY:
 * - Environment variables are strings (can't store arrays directly)
 * - Need to convert "origin1,origin2" → ["origin1", "origin2"]
 * - Trim whitespace (users might add spaces after commas)
 * - Filter empty strings (trailing commas, double commas)
 * 
 * EXAMPLE ENV VAR:
 * CORS_ORIGINS=https://admin.example.com,https://driver.example.com,https://passenger.example.com
 * 
 * EDGE CASES HANDLED:
 * - Empty string → [] (no origins allowed)
 * - Trailing comma → ignored
 * - Extra spaces → trimmed
 * - Multiple commas → filtered out
 */
function parseOriginsCsv(input: string): string[] {
  return input
    .split(',')              // Split "a,b,c" → ["a", "b", "c"]
    .map((s) => s.trim())    // Remove whitespace: " a " → "a"
    .filter((s) => s.length > 0);  // Remove empty strings: ["", "a"] → ["a"]
}

/**
 * Validate if incoming request origin is in the allowlist
 * 
 * WHY URL PARSING:
 * - Origins must be EXACT matches (security requirement)
 * - URL parser normalizes: "HTTPS://EXAMPLE.COM" → "https://example.com"
 * - Prevents bypass via case differences (Https:// vs https://)
 * - Extracts origin (protocol + host + port), ignores path
 * 
 * EXAMPLES:
 * 
 * ALLOWED:
 * origin = "https://admin.example.com"
 * allowed = ["https://admin.example.com"]
 * → Returns true (exact match)
 * 
 * BLOCKED:
 * origin = "https://evil.com"
 * allowed = ["https://admin.example.com"]
 * → Returns false (not in allowlist)
 * 
 * BLOCKED (invalid URL):
 * origin = "not-a-url"
 * → URL constructor throws → catch block → returns false
 * 
 * SECURITY NOTE:
 * - Case-insensitive comparison (HTTPS:// === https://)
 * - Only compares origin (ignores query params, paths)
 * - Invalid URLs automatically rejected
 * 
 * @param origin - Request Origin header (e.g., "https://app.example.com")
 * @param allowed - Array of allowed origins from env var
 * @returns true if origin is allowed, false otherwise
 */
function isOriginAllowed(origin: string, allowed: string[]): boolean {
  try {
    // Parse origin into URL object
    // Normalizes: "HTTPS://EXAMPLE.COM/path" → origin property: "https://example.com"
    const url = new URL(origin);
    
    // Check if normalized origin is in allowlist (case-insensitive)
    return allowed.includes(url.origin.toLowerCase());
  } catch {
    // Invalid URL (malformed, missing protocol, etc.) → reject
    // Example: "evil.com" (no protocol) throws, returns false
    return false;
  }
}

/**
 * FASTIFY CORS PLUGIN
 * 
 * Registers @fastify/cors plugin with environment-specific configuration
 * - Development: Permissive (allow all origins)
 * - Production: Strict (only allowed origins)
 */
export const corsPlugin: FastifyPluginAsync = fp(
  async (app) => {
    // Determine environment: production vs dev/test
    const isProd = env.nodeEnv === 'production';
    
    // Parse allowed origins from environment variable
    // Example: CORS_ORIGINS="https://admin.example.com,https://driver.example.com"
    // Result: ["https://admin.example.com", "https://driver.example.com"]
    const allowedOrigins = env.corsOrigins ? parseOriginsCsv(env.corsOrigins) : [];

    // Configure CORS options
    const options: FastifyCorsOptions = {
      /**
       * ORIGIN VALIDATION FUNCTION
       * 
       * Called for EVERY incoming request with an Origin header
       * Determines if browser should allow the request
       * 
       * PARAMETERS:
       * @param origin - Value of Origin header (e.g., "https://app.example.com")
       * @param cb - Callback: cb(error, allowed)
       *   - cb(null, true) → Allow request (send Access-Control-Allow-Origin header)
       *   - cb(null, false) → Block request (no CORS header sent)
       * 
       * FLOW:
       * 1. Browser: "I'm from https://app.example.com, can I call this API?"
       * 2. This function: Check if origin is allowed
       * 3. If allowed → Backend: "Access-Control-Allow-Origin: https://app.example.com"
       * 4. Browser: "OK, I'll allow the response"
       */
      origin: (origin, cb) => {
        // CASE 1: No Origin header (e.g., curl, Postman, server-to-server)
        // → Allow (not a browser, no CORS needed)
        if (!origin) return cb(null, true);
        
        // CASE 2: Development/test environment
        // → Allow all origins (ease of development)
        // Local frontend (localhost:3000) can call local backend (localhost:3001)
        if (!isProd) return cb(null, true);
        
        // CASE 3: Production, but no origins configured
        // → Block all (security: fail closed)
        // Log warning: deployment misconfiguration
        if (allowedOrigins.length === 0) {
          app.log.warn('CORS blocked: no origins configured');
          return cb(null, false);
        }

        // CASE 4: Production, check if origin is in allowlist
        if (isOriginAllowed(origin, allowedOrigins)) {
          // Origin is allowed → send CORS headers
          return cb(null, true);
        }

        // CASE 5: Production, origin NOT in allowlist
        // → Block request (security: prevent unauthorized access)
        // Log security event for monitoring
        app.log.warn({ origin }, 'CORS blocked: origin not allowed');
        return cb(null, false);
      },
      
      /**
       * CREDENTIALS: Allow cookies and Authorization headers
       * 
       * - true: Browser sends cookies/auth headers with cross-origin requests
       * - false: Browser blocks cookies (even if frontend includes them)
       * 
       * SECURITY IMPLICATION:
       * - credentials: true → Must specify exact origins (can't use wildcard *)
       * - Enables: Session cookies, JWT in cookies, HTTP auth
       * 
       * PRODUCTION:
       * - Set CORS_CREDENTIALS=true in .env
       * - Required for: Cookie-based sessions, HTTP-only cookies
       */
      credentials: env.corsCredentials,
      
      /**
       * ALLOWED HTTP METHODS
       * 
       * Browser will allow these HTTP verbs in cross-origin requests
       * - GET, POST: Standard CRUD
       * - PUT, PATCH: Updates
       * - DELETE: Deletions
       * - OPTIONS: Preflight requests (browser automatically sends)
       */
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      
      /**
       * ALLOWED REQUEST HEADERS
       * 
       * Browser will allow frontend to send these headers
       * - Content-Type: JSON payload (application/json)
       * - Authorization: JWT tokens (Bearer <token>)
       * 
       * CUSTOM HEADERS:
       * If frontend sends custom headers (e.g., X-Request-ID), add them here
       */
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Request-Id'],

      /**
       * SECURITY & PERFORMANCE SETTINGS
       */
      
      /**
       * preflightContinue: false
       * - true: Pass preflight request to route handlers (manual handling)
       * - false: CORS plugin handles OPTIONS automatically (recommended)
       * 
       * WHY FALSE:
       * - Route handlers don't need to handle OPTIONS
       * - Faster (no business logic for preflight)
       */
      preflightContinue: false,
      
      /**
       * optionsSuccessStatus: 204
       * - HTTP status for successful OPTIONS (preflight) requests
       * - 204 No Content: Standard for OPTIONS (no body needed)
       * - Alternative: 200 OK (less efficient, body required)
       */
      optionsSuccessStatus: 204,
      
      /**
       * maxAge: 86400 (24 hours)
       * - How long browser caches preflight response
       * - Access-Control-Max-Age: 86400
       * 
       * BENEFIT:
       * - Browser only sends preflight once per day (per origin)
       * - Reduces OPTIONS requests by ~99%
       * - Faster frontend (no preflight delay)
       * 
       * EXAMPLE:
       * First request: OPTIONS → POST (2 requests)
       * Next 24h: POST only (1 request, cached preflight)
       */
      maxAge: 86400, // cache preflight for 24h
    };
    
    // Register CORS plugin with Fastify
    // All routes automatically get CORS headers based on above config
    await app.register(cors, options);
  },
  {
    // Plugin name (for debugging, logs)
    name: 'cors-plugin',
  }
);
