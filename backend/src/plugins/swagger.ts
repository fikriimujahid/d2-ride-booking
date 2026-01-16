/**
 * SWAGGER API DOCUMENTATION PLUGIN
 * 
 * PURPOSE:
 * - Generate interactive API documentation from route schemas
 * - OpenAPI 3.0 specification (industry standard)
 * - SwaggerUI (browser-based API explorer)
 * 
 * WHY SWAGGER:
 * - Interactive testing: Try API endpoints in browser
 * - Auto-generated: No need to manually write docs
 * - Always up-to-date: Docs generated from code
 * - Schema validation: Route schemas define both validation and docs
 * 
 * SECURITY:
 * - Development: Swagger enabled, publicly accessible
 * - Production: Swagger DISABLED (prevent API disclosure)
 * - Optional: Auth-protected swagger for internal use
 * 
 * ENDPOINTS CREATED:
 * - GET /docs - SwaggerUI interface (interactive docs)
 * - GET /openapi.json - OpenAPI spec (JSON schema)
 * 
 * USAGE:
 * 1. Developer: Visit http://localhost:3001/docs
 * 2. See all routes, request/response schemas
 * 3. Test endpoints directly in browser
 * 4. No Postman needed for manual testing
 */

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../config/env.js';

/**
 * Swagger plugin configuration options
 * 
 * FLEXIBLE DEPLOYMENT:
 * - Can enable/disable swagger per environment
 * - Can protect swagger with authentication
 * - Defaults: enabled in dev/test, disabled in production
 * 
 * OPTIONS:
 * 
 * enabled (boolean, optional):
 *   - true: Register swagger and swagger-ui
 *   - false: Skip swagger registration entirely
 *   - Default: enabled if NODE_ENV !== 'production'
 *   
 *   Use case:
 *   app.register(swaggerPlugin, { enabled: false });  // Force disable
 * 
 * protected (boolean, optional):
 *   - true: Require authentication to access /docs and /openapi.json
 *   - false: Public access (default in development)
 *   - Default: false
 *   
 *   Use case:
 *   app.register(swaggerPlugin, { protected: true });  // Auth required
 *   
 * PRODUCTION SCENARIOS:
 * 
 * 1. Public API (external developers):
 *    { enabled: true, protected: false }
 *    → Swagger accessible to everyone
 * 
 * 2. Internal API (employees only):
 *    { enabled: true, protected: true }
 *    → Swagger requires JWT token
 * 
 * 3. Strict security (no API disclosure):
 *    { enabled: false }
 *    → No swagger endpoints at all
 */
export type SwaggerPluginOptions = {
  enabled?: boolean;      // Enable/disable swagger registration
  protected?: boolean;    // Require auth to access docs
};

/**
 * FASTIFY SWAGGER PLUGIN
 * 
 * Conditionally registers swagger and swagger-ui based on configuration
 * Supports authentication protection for sensitive environments
 */
export const swaggerPlugin = fp<SwaggerPluginOptions>(
  async (app, opts) => {
    /**
     * CONDITIONAL ENABLING
     * 
     * Determine if swagger should be registered
     * 
     * LOGIC:
     * 1. If opts.enabled explicitly set → use that value
     * 2. Otherwise → enabled if NOT production
     * 
     * EXAMPLES:
     * 
     * Development (NODE_ENV=development):
     *   opts.enabled = undefined
     *   → enabled = true (env.nodeEnv !== 'production')
     *   → Swagger registered
     * 
     * Production (NODE_ENV=production):
     *   opts.enabled = undefined
     *   → enabled = false (env.nodeEnv === 'production')
     *   → Swagger NOT registered
     * 
     * Forced enable in production:
     *   opts.enabled = true
     *   → enabled = true (explicit override)
     *   → Swagger registered (use with protected: true)
     * 
     * Forced disable in development:
     *   opts.enabled = false
     *   → enabled = false (explicit override)
     *   → Swagger NOT registered
     */
    const enabled = opts.enabled ?? env.nodeEnv !== 'production';
    
    /**
     * EARLY RETURN: Skip swagger registration if disabled
     * 
     * WHY:
     * - No swagger routes created
     * - No OpenAPI spec generated
     * - Faster startup (no schema processing)
     * - Smaller bundle (swagger code not loaded)
     * 
     * PRODUCTION BENEFIT:
     * - /docs returns 404 (route doesn't exist)
     * - Attackers can't discover API structure
     * - No documentation endpoints to secure
     */
    if (!enabled) {
      app.log.info('Swagger disabled');
      return;  // Exit plugin, don't register swagger
    }

    /**
     * REGISTER @fastify/swagger
     * 
     * Generates OpenAPI specification from Fastify route schemas
     * Does NOT serve UI (that's swagger-ui below)
     * 
     * AUTOMATIC SCHEMA GENERATION:
     * Route definition:
     * app.post('/api/v1/users', {
     *   schema: {
     *     body: { type: 'object', properties: { name: { type: 'string' } } },
     *     response: { 200: { type: 'object', properties: { id: { type: 'string' } } } }
     *   }
     * }, handler);
     * 
     * → Swagger automatically generates:
     * - POST /api/v1/users endpoint documentation
     * - Request body schema
     * - Response schema
     * - Try it out button in UI
     */
    await app.register(swagger, {
      openapi: {
        /**
         * OpenAPI specification version
         * 3.0.3 is stable, widely supported
         * (Not Swagger 2.0, that's deprecated)
         */
        openapi: '3.0.3',
        
        /**
         * API metadata (shown in swagger UI header)
         */
        info: {
          title: 'D2 Ride Booking API',    // API name
          version: '0.1.0'                  // API version (semantic versioning)
        },
        
        /**
         * Server URLs for "Try it out" feature
         * 
         * Development: [{ url: '/' }] → calls http://localhost:3001/api/v1/...
         * Production: Can specify full URL:
         *   [{ url: 'https://api.example.com' }]
         */
        servers: [{ url: '/' }],
        
        /**
         * SECURITY SCHEMES: Define authentication methods
         * 
         * BearerAuth (JWT):
         * - type: 'http' → Standard HTTP authentication
         * - scheme: 'bearer' → Authorization: Bearer <token>
         * - bearerFormat: 'JWT' → Token is a JSON Web Token
         * 
         * USAGE IN SWAGGER UI:
         * 1. User clicks "Authorize" button
         * 2. Enters JWT token
         * 3. Swagger adds "Authorization: Bearer <token>" to all requests
         * 4. Can test protected endpoints
         */
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',           // HTTP authentication (not OAuth, not API key)
              scheme: 'bearer',       // Authorization: Bearer <token>
              bearerFormat: 'JWT',    // Token format hint
            },
          },
        },
        
        /**
         * GLOBAL SECURITY REQUIREMENT
         * 
         * Tells swagger: "All endpoints require BearerAuth by default"
         * Individual routes can override:
         *   app.get('/public', { schema: { security: [] } }, handler);
         *   → No lock icon in swagger (public endpoint)
         */
        security: [{ BearerAuth: [] }],
      },
    });

    /**
     * REGISTER @fastify/swagger-ui
     * 
     * Serves interactive Swagger UI at /docs
     * Uses OpenAPI spec from @fastify/swagger above
     * 
     * SWAGGER UI FEATURES:
     * - Browse all API endpoints
     * - See request/response schemas
     * - Try endpoints directly in browser
     * - Authenticate with JWT token
     * - See example requests/responses
     */
    await app.register(swaggerUi, {
      /**
       * Route prefix for swagger UI
       * GET /docs → Serves swagger UI HTML
       * GET /docs/static/* → Swagger UI assets (CSS, JS)
       */
      routePrefix: '/docs',
      
      /**
       * SWAGGER UI CONFIGURATION
       * Customizes UI behavior and appearance
       */
      uiConfig: {
        /**
         * docExpansion: 'list'
         * - 'list': Show endpoints, hide schemas (cleaner)
         * - 'full': Expand everything (overwhelming)
         * - 'none': Collapse everything (requires clicks)
         */
        docExpansion: 'list',
        
        /**
         * deepLinking: true
         * - URL updates when clicking endpoints
         * - Can share direct links: /docs#/auth/post_api_v1_auth_login
         * - Browser back button works
         */
        deepLinking: true
      },
      
      /**
       * staticCSP: true
       * - Enables Content Security Policy for swagger UI
       * - Prevents XSS attacks in swagger UI itself
       * - Required for production security
       */
      staticCSP: true,
      
      /**
       * UI HOOKS: Intercept requests to /docs
       * 
       * AUTHENTICATION PROTECTION:
       * If opts.protected = true (and not development):
       * → Require Authorization header to access swagger UI
       * → Prevents unauthorized API disclosure
       * 
       * WHY PROTECT:
       * - Internal APIs shouldn't be publicly documented
       * - Staging environments need access control
       * - Prevent competitors from discovering API structure
       * 
       * FLOW:
       * 1. User visits /docs
       * 2. onRequest hook runs (before serving UI)
       * 3. Check if protected && not development
       * 4. If yes, require Authorization header
       * 5. If no header → 401 Unauthorized
       * 6. If valid → serve swagger UI
       */
      uiHooks: {
        /**
         * Runs before serving swagger UI
         * Can block access based on authentication
         */
        onRequest: async (req, reply) => {
          /**
           * PROTECTION LOGIC:
           * 
           * Protect if:
           * - opts.protected = true (explicit protection enabled)
           * - AND env.nodeEnv !== 'development' (not local dev)
           * 
           * WHY SKIP IN DEVELOPMENT:
           * - Local developers need easy access
           * - No security risk (localhost only)
           * - Faster iteration (no auth needed)
           * 
           * PRODUCTION/STAGING:
           * - Requires JWT token in Authorization header
           * - Only authenticated users can see docs
           * - Prevents public API disclosure
           */
          if (opts.protected && env.nodeEnv !== 'development') {
            /**
             * SIMPLE AUTH CHECK:
             * - Check if Authorization header exists
             * - In real implementation: Validate JWT token
             * 
             * ENHANCEMENT (TODO):
             * - Verify JWT signature
             * - Check token expiration
             * - Validate user permissions
             * - Only allow admin users
             * 
             * Example with real auth:
             * const token = req.headers.authorization?.replace('Bearer ', '');
             * const user = await verifyJWT(token);
             * if (!user || !user.isAdmin) {
             *   reply.code(403).send({ message: 'Forbidden' });
             * }
             */
            if (!req.headers.authorization) {
              reply.code(401).send({ message: 'Unauthorized' });
            }
          }
        },
      },
    });

    /**
     * CUSTOM ROUTE: OpenAPI specification endpoint
     * 
     * WHY CUSTOM ROUTE:
     * - @fastify/swagger creates /openapi.json by default
     * - But we need to protect it (same as /docs)
     * - Custom route allows applying authentication
     * 
     * WITHOUT PROTECTION:
     * curl http://api.example.com/openapi.json
     * → Full API schema exposed (all routes, schemas)
     * → Competitors can reverse-engineer API
     * 
     * WITH PROTECTION:
     * curl http://api.example.com/openapi.json
     * → 401 Unauthorized (no token)
     * 
     * curl -H "Authorization: Bearer <token>" http://api.example.com/openapi.json
     * → 200 OK + OpenAPI spec (authenticated)
     * 
     * USE CASES:
     * - Client SDKs: Generate API clients from OpenAPI spec
     * - Postman: Import OpenAPI spec to create collections
     * - Code generators: Generate TypeScript types from schemas
     */
    app.get(
      '/openapi.json',
      {
        /**
         * onRequest hook: Same protection as swagger UI
         * 
         * CONSISTENCY:
         * - If /docs requires auth, /openapi.json should too
         * - Both expose same information (UI vs JSON)
         * - Same security policy for both endpoints
         */
        onRequest: async (req, reply) => {
          if (opts.protected && env.nodeEnv !== 'development') {
            /**
             * Require Authorization header
             * Same logic as swagger UI protection above
             */
            if (!req.headers.authorization) {
              reply.code(401).send({ message: 'Unauthorized' });
            }
          }
        },
      },
      /**
       * Route handler: Return OpenAPI specification
       * 
       * app.swagger() returns the generated OpenAPI object:
       * {
       *   openapi: '3.0.3',
       *   info: { title: '...', version: '...' },
       *   paths: {
       *     '/api/v1/auth/login': { post: { ... } },
       *     '/api/v1/users': { get: { ... }, post: { ... } }
       *   },
       *   components: { schemas: { ... }, securitySchemes: { ... } }
       * }
       */
      async () => app.swagger()
    );
  },
  {
    // Plugin name (for debugging, logs)
    name: 'swagger-plugin',
  }
);
