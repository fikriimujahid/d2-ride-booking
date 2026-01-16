# Backend Lifecycle Documentation

> **Audience**: New backend engineers, SREs, and DevOps engineers  
> **Purpose**: Understand how the backend starts, runs, logs, and shuts down  
> **Written for**: ESL-friendly, clear, step-by-step explanations

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Startup Lifecycle](#backend-startup-lifecycle)
3. [Request Processing Lifecycle](#request-processing-lifecycle)
4. [Logging Lifecycle](#logging-lifecycle)
5. [Shutdown & Restart Lifecycle](#shutdown--restart-lifecycle)
6. [Production Failure Scenarios](#production-failure-scenarios)

---

## Overview

### What is This Backend?

- **Architecture**: Modular monolith (single Node.js process)
- **Framework**: Fastify (fast, low-overhead HTTP server)
- **Language**: TypeScript (compiled to JavaScript)
- **Runtime**: Node.js v20+
- **Database**: PostgreSQL (connection pool)
- **Deployment**: EC2 (dev) → Auto Scaling Group + ALB (production)

### Key Characteristics

- **ONE server**: Single process handles all requests
- **ONE port**: All routes served from the same port (default: 3001)
- **ONE package.json**: All dependencies in one place
- **Graceful shutdown**: Handles SIGTERM cleanly for rolling deployments

---

## Backend Startup Lifecycle

### Phase 1: Node.js Process Start

**What Happens:**
```
systemd/pm2 → node dist/server.js → V8 engine starts
```

**Details:**
- Operating system launches Node.js process
- V8 JavaScript engine initializes
- Memory allocated for heap and stack
- Event loop starts (but nothing scheduled yet)

**Monitoring:**
- Process ID (PID) assigned
- Memory usage: ~50MB initial
- CPU usage: ~20-30% during startup

---

### Phase 2: Configuration Loading

**File**: `src/config/env.ts`

**Execution Order:**

1. **dotenv loads `.env` file**
   ```typescript
   dotenv.config(); // Reads .env and sets process.env variables
   ```

2. **Environment variables parsed and validated**
   - `NODE_ENV` → `development` | `test` | `production`
   - `PORT` → number (validated: 1-65535)
   - Database credentials → validated
   - JWT secrets → validated or defaulted (test only)

3. **Validation failures crash the process**
   ```
   Error: Missing required env var: DATABASE_URL
   → Process exits with code 1
   → systemd/pm2 won't start the server
   ```

**Why This Happens First:**
- **Fail fast**: Catch config errors before accepting requests
- **Security**: Ensure secrets are present in production
- **Type safety**: Convert string env vars to proper types

**Timing**: ~5-10ms

---

### Phase 3: Application Build (`buildApp()`)

**File**: `src/app.ts`

**What Happens:**

1. **Fastify instance created**
   ```typescript
   const app = Fastify({
     logger: true,  // Pino logger initialized
     ajv: { ... }   // JSON schema validator configured
   });
   ```

2. **Plugins registered in ORDER** (order matters!)

   **Security Plugins (FIRST):**
   | Plugin | Purpose | Timing |
   |--------|---------|--------|
   | **helmet** | Set security HTTP headers | 1-2ms |
   | **rateLimit** | Prevent brute force/DDoS | 1-2ms |
   | **corsPlugin** | Handle CORS headers | 1-2ms |

   **Error Handling & Observability:**
   | Plugin | Purpose | Timing |
   |--------|---------|--------|
  | **correlationIdPlugin** | Resolve/store `x-correlation-id`, bind request-scoped logger context, echo response header | <1ms |
   | **errorHandlerPlugin** | Register global error handler | 1ms |
   | **swaggerPlugin** | Generate OpenAPI spec (conditional: dev/test enabled, prod disabled, optional auth protection) | 10-20ms |

   **Infrastructure:**
   | Plugin | Purpose | Timing |
   |--------|---------|--------|
   | **dbPlugin** | Create DB pool + verify connectivity (onReady hook prevents startup if DB unreachable) | 2-5ms |
   | **apiDbLoggerPlugin** | Register request logging hooks | 1ms |

3. **Routes registered**
   ```typescript
   app.register(healthRoutes, { prefix: '/api/v1' });
   app.register(authRoutes, { prefix: '/api/v1' });
   ```

**Important:** 
- No network binding yet
- Database pool created, connectivity verified via onReady hook
- Server is NOT listening

**Database Plugin Details:**

The database plugin has been refactored to include fail-fast connectivity verification:

**Lifecycle:**
```typescript
// 1. Plugin registration (Phase 3)
const pool = createDbPool();  // Create pool (no connections yet)
app.decorate('db', pool);     // Make available as app.db

// 2. onReady hook (after Phase 3, before Phase 5)
app.addHook('onReady', async () => {
  await pool.query('SELECT 1');  // Verify database reachable
  // If fails → throw error → server won't start
});

// 3. Server starts (Phase 5)
app.listen({ port: 3001 });  // Only if onReady succeeded

// 4. onClose hook (shutdown)
app.addHook('onClose', async () => {
  await pool.end();  // Gracefully close all connections
});
```

**Fail-Fast Behavior:**
```
Database Down:
1. createDbPool() → Pool created
2. onReady → SELECT 1 fails (connection timeout)
3. Log: "database connection failed" (fatal)
4. Throw error → Fastify aborts startup
5. app.listen() never called
6. Exit code 1 → systemd retries
7. Health checks fail → No traffic routed

Database Up:
1. createDbPool() → Pool created
2. onReady → SELECT 1 succeeds (< 10ms)
3. Log: "database connection established"
4. Continue to Phase 5 (network binding)
5. Server starts accepting requests
```

**Benefits:**
- ✅ **No partial failures**: Server only starts if database reachable
- ✅ **Fast detection**: Database issues caught at startup (not first request)
- ✅ **Zero 500 errors**: No requests accepted if database down
- ✅ **Clear logs**: "database connection failed" vs scattered query errors
- ✅ **Auto-recovery**: systemd restarts until database is available

**Connection Pool Settings:**
- **max**: 10 connections (configurable via PG_POOL_MAX)
- **idleTimeoutMillis**: 30 seconds (close idle connections)
- **connectionTimeoutMillis**: 5 seconds (fail fast if unreachable)
- **SSL**: Production (strict validation), Development (permissive)

**Timing**: ~50-100ms (longer in dev due to Swagger)

**Swagger Plugin Details:**

The swagger plugin has been refactored to support conditional enabling and authentication protection:

**Configuration Options:**
```typescript
// Development (default)
app.register(swaggerPlugin);
→ enabled: true (auto-detected)
→ protected: false
→ /docs publicly accessible

// Production (disabled by default)
app.register(swaggerPlugin);
→ enabled: false (NODE_ENV=production)
→ No /docs or /openapi.json routes

// Production with auth-protected docs
app.register(swaggerPlugin, { enabled: true, protected: true });
→ /docs and /openapi.json require Authorization header
→ Prevents public API disclosure

// Force disable in development
app.register(swaggerPlugin, { enabled: false });
→ No swagger even in dev
```

**Security Features:**
1. **Conditional enabling**: Disabled by default in production
2. **Auth protection**: Optional JWT-based access control for /docs and /openapi.json
3. **CSP headers**: Content Security Policy prevents XSS in swagger UI
4. **Consistent protection**: Both UI and JSON spec use same auth logic

**Endpoints Created (when enabled):**
- `GET /docs` - Interactive Swagger UI (browser-based API explorer)
- `GET /openapi.json` - OpenAPI 3.0.3 specification (JSON schema)

**Authentication Flow (when protected):**
```
1. User visits /docs
2. onRequest hook checks: protected && !development
3. If yes → check Authorization header
4. No header → 401 Unauthorized
5. Valid header → serve swagger UI
```

---

### Phase 4: Signal Handlers Registration

**File**: `src/server.ts`

**What Happens:**
```typescript
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // systemd/ALB
process.on('unhandledRejection', ...);             // Promise errors
process.on('uncaughtException', ...);              // Sync errors
```

**Why This Matters:**
- **SIGTERM**: Production graceful shutdown (systemd, pm2, Kubernetes)
- **SIGINT**: Local development Ctrl+C
- **Unhandled rejections**: Catch async errors that slip through
- **Uncaught exceptions**: Catch fatal errors before crash

**Real-World Example:**
```
AWS Auto Scaling → scale down → sends SIGTERM
Backend → closes connections gracefully → exits with code 0
systemd → sees clean exit → doesn't restart
```

**Timing**: <1ms

---

### Phase 5: Network Binding (`app.listen()`)

**File**: `src/server.ts`

**What Happens:**
```typescript
await app.listen({
  host: '0.0.0.0',  // Listen on ALL network interfaces
  port: 3001        // Bind to TCP port 3001
});
```

**Technical Details:**

1. **TCP socket created**
   - Operating system allocates socket
   - Binds to port 3001 on all interfaces

2. **Listening state active**
   - Server starts accepting incoming connections
   - Connection queue initialized (backlog: 511)

3. **First database connection established** (lazy)
   - Database pool created, but no connections yet
   - First HTTP request will trigger first DB connection

**Possible Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `EADDRINUSE` | Port already in use | Kill other process or change port |
| `EACCES` | Permission denied | Use port > 1024 or run as root |
| `EADDRNOTAVAIL` | Invalid host | Check network configuration |

**Success Log:**
```json
{
  "level": "info",
  "msg": "server started",
  "host": "0.0.0.0",
  "port": 3001
}
```

**Timing**: 5-10ms

---

### Phase 6: Application Ready

**What "Ready" Means:**
- ✅ Server listening on TCP socket
- ✅ Plugins initialized
- ✅ Routes registered
- ✅ Signal handlers active
- ✅ Logger running
- ❌ Database NOT connected yet (happens on first query)

**Health Check:**
```bash
curl http://localhost:3001/api/v1/health
# Response: { "status": "ok" }
```

**Production Monitoring:**
- ALB health checks start passing
- CloudWatch logs show "server started"
- Service marked as "healthy" in service mesh

**Total Startup Time**: ~100-200ms (fast startup!)

---

## Request Processing Lifecycle

### Overview: How a Request Flows Through the Backend

```
Client → ALB → Server → Security (Helmet, Rate Limit) → CORS → Logging → Routes → DB → Response
```

**Security Layer (NEW):**
- **Helmet**: Sets secure HTTP headers (X-Frame-Options, CSP, etc.)
- **Rate Limiting**: Blocks IPs exceeding 10 requests/minute
- **CORS**: Validates origin and sets access control headers

---

### Step-by-Step Request Flow

#### **1. TCP Connection Received**

**What Happens:**
- Client opens TCP connection to `backend:3001`
- Operating system accepts connection
- Connection added to Node.js event loop

**Production Context:**
- ALB maintains connection pool to backend
- ALB reuses connections (keep-alive)
- Backend handles ~1000 concurrent connections

---

#### **2. HTTP Request Parsed**

**Fastify's Role:**
- Parse HTTP headers
- Parse request body (JSON)
- Validate content-type
- Extract route from URL

**Example:**
```http
POST /api/v1/auth/login HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>

{"email": "user@example.com", "password": "secret"}
```

---

#### **3. Security Headers Applied (Helmet)**

**What Happens:**
- Helmet plugin adds security headers to EVERY response
- Happens automatically for all requests

**Headers Added:**
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=15552000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

**Purpose:**
- Prevent XSS attacks (cross-site scripting)
- Prevent clickjacking (iframe embedding)
- Enforce HTTPS (in production)
- Meet OWASP security standards

---

#### **4. Rate Limit Check**

**What Happens:**
- Track request count per IP address
- Check if IP exceeded limit (10 requests/minute)
- If exceeded → reject with 429 Too Many Requests

**Rate Limit Logic:**
```typescript
1. Extract client IP (from X-Forwarded-For or socket)
2. Increment request counter for this IP
3. If counter > 10 in last minute → reject
4. Add rate limit headers to response
```

**Response When Limited:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315905
Retry-After: 45

{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 45 seconds"
}
```

**Use Cases:**
- **Prevent brute force**: Login attempts limited to 10/min
- **Prevent DDoS**: Single IP can't overwhelm server
- **Prevent scraping**: Bots can't harvest data rapidly

**Production Tuning:**
```typescript
// Different limits per route
app.register(authRoutes, {
  prefix: '/api/v1',
  config: {
    rateLimit: {
      max: 5,           // Stricter limit for auth
      timeWindow: '1 minute'
    }
  }
});
```

---

#### **5. CORS Preflight (if needed)**

**When:**
- Browser sends OPTIONS request before POST/PUT/DELETE
- Cross-origin request with custom headers

**CORS Plugin Logic (with new helper functions):**

**Step 1: Parse allowed origins**
```typescript
// parseOriginsCsv() converts env var to array
// Input:  "https://app.example.com, https://admin.example.com"
// Output: ["https://app.example.com", "https://admin.example.com"]
const allowedOrigins = env.corsOrigins ? parseOriginsCsv(env.corsOrigins) : [];
```

**Step 2: Validate origin**
```typescript
// For each request, check if origin is allowed
if (!origin) return allow();           // No Origin header → allow (non-browser)
if (!isProd) return allow();           // Dev/test → allow all
if (allowedOrigins.length === 0) {     // Production, no config → block
  log.warn('CORS blocked: no origins configured');
  return block();
}

// isOriginAllowed() normalizes and validates URL
// 1. Parse origin into URL object (normalizes case)
// 2. Compare with allowlist (case-insensitive)
// 3. Invalid URLs automatically rejected
if (isOriginAllowed(origin, allowedOrigins)) {
  return allow();  // Origin in allowlist → send CORS headers
}

log.warn({ origin }, 'CORS blocked: origin not allowed');
return block();  // Origin not in allowlist → no CORS headers
```

**Step 3: Send CORS headers**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

**Why helper functions:**
- **parseOriginsCsv()**: Clean CSV parsing with whitespace handling
- **isOriginAllowed()**: URL normalization prevents case-based bypass
- **Security**: Consistent validation logic, no edge cases
- **Maintainability**: Clear separation of concerns

---

#### **6. Request Logging Starts (onRequest Hook)**

**API Logger Plugin:**
```typescript
app.addHook('onRequest', async (request) => {
  request.auditStartMs = Date.now();  // Record start time
  // Per-request ID (x-request-id) is generated/normalized by the api-db-logger plugin.
  // Flow-level correlation ID (x-correlation-id) is handled earlier by correlationIdPlugin
  // and is available as request.correlationId.
  request.auditRequestId = getRequestId(request);
});
```

**Timing Markers Set:**
- Start timestamp captured
- Per-request ID captured (`x-request-id`)
- Flow correlation available as `request.correlationId` (`x-correlation-id`)
- Later used to calculate request duration

---

#### **7. Schema Validation (AJV)**

**Fastify's Built-In Validation:**
```typescript
// Route defines schema
{
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 }
    }
  }
}

// AJV validates request body
// If invalid → 400 Bad Request (before route handler runs)
```

**Example Validation Error:**
```json
{
  "error": {
    "code": "FST_ERR_VALIDATION",
    "message": "body.email must be a valid email"
  }
}
```

---

#### **8. Route Handler Execution**

**Example: Login Route**
```typescript
app.post('/api/v1/auth/login', async (request, reply) => {
  // 1. Extract credentials from request body
  const { email, password } = request.body;

  // 2. Query database for user
  const user = await app.db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  // 3. Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new InvalidCredentialsError();

  // 4. Generate JWT tokens
  const accessToken = jwt.sign({ userId: user.id }, env.jwtAccessSecret);

  // 5. Return response
  return { accessToken };
});
```

**Database Query:**
- Borrows connection from pool
- Executes SQL query
- Returns connection to pool
- Total time: 1-10ms (depends on query complexity)

---

#### **9. Error Handling (if error thrown)**

**Error Handler Plugin (Refactored with Helper Functions):**

**Architecture:**
```typescript
// 1. Canonical error mapping (errors.ts)
const DEFAULT_STATUS_BY_CODE = {
  INVALID_CREDENTIALS: 401,
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
  // ... (single source of truth)
};

// 2. AppError class (errors.ts)
class AppError extends Error {
  constructor(message, { code }) {
    // Automatically maps code → status code
    this.statusCode = DEFAULT_STATUS_BY_CODE[code];
    this.code = code;
    Object.freeze(this);  // Immutable
  }
}

// 3. Error handler with helper functions (error-handler.ts)
app.setErrorHandler((error, request, reply) => {
  // Helper 1: Extract status code (handles AppError, Fastify errors, unknown)
  const statusCode = getStatusCode(error);
  
  // Helper 2: Log with appropriate level (5xx → error, 4xx → warn)
  logError(app, request, error, statusCode);
  
  // Helper 3: Get public message (hides 5xx details in production)
  const message = getPublicMessage(error, statusCode);
  
  // Helper 4: Extract error code (AppError.code or default)
  const code = isAppError(error) ? error.code : 'INTERNAL_ERROR';
  
  // Send standardized response
  reply.status(statusCode).send({
    error: { code, message, requestId: request.id }
  });
});
```

**Helper Function Details:**

**1. getStatusCode(error): Extract HTTP status code**
```typescript
function getStatusCode(error: unknown): number {
  if (isAppError(error)) return error.statusCode;  // AppError (our errors)
  
  if (error has statusCode property) {             // Fastify validation errors
    if (statusCode is 400-599) return statusCode;  // Valid HTTP error
  }
  
  return 500;  // Unknown error → default to 500
}
```

**2. logError(request, error, statusCode): Log with context**
```typescript
function logError(...) {
  const logContext = {
    requestId,      // Per-request ID
    correlationId,  // Flow ID (x-correlation-id)
    method,         // GET, POST, etc.
    url,            // /api/v1/auth/login
    statusCode,     // 400, 401, 500
    err: error      // Full error object (stack trace, etc.)
  };
  
  if (statusCode >= 500) {
    request.log.error(logContext, 'server error');  // Critical, needs investigation
  } else {
    request.log.warn(logContext, 'client error');   // Expected, client's fault
  }
}
```

**3. getPublicMessage(error, statusCode): Security filtering**
```typescript
function getPublicMessage(error, statusCode): string {
  // SECURITY: Hide 5xx error details in production
  if (production && statusCode >= 500) {
    return 'Internal Server Error';  // ❌ Don't leak database errors, stack traces
  }
  
  // Safe to show 4xx errors (client's fault)
  return error.message;  // ✅ "Invalid email format", "User not found"
}
```

**4. isAppError(error): Type guard**
```typescript
function isAppError(error: unknown): error is AppError {
  if (error instanceof AppError) return true;  // Standard check
  
  // Defensive: Check by name (cross-package-boundary errors)
  return error?.name === 'AppError';
}
```

**Benefits of Refactor:**
- ✅ **Canonical mapping**: Each error code → exactly one HTTP status
- ✅ **Consistent API**: Can't accidentally use wrong status code
- ✅ **Separation of concerns**: Each helper has one job
- ✅ **Security**: Production 5xx messages always hidden
- ✅ **Logging**: Automatic context, correct log levels
- ✅ **Type safety**: TypeScript validates error codes
- ✅ **Immutability**: AppError frozen, can't be modified

**Error Types (with Canonical Mapping):**

| Error Code | Status Code | Example |
|------------|-------------|---------|
| `INVALID_CREDENTIALS` | 401 | Wrong password |
| `VALIDATION_ERROR` | 400 | Invalid email format |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `UNAUTHORIZED` | 401 | No JWT token |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `OTP_REQUIRED` | 401 | Need 2FA code |
| `INTERNAL_ERROR` | 500 | Database error |

**Usage Example:**
```typescript
// In route handler
if (!user) {
  throw new AppError('Invalid email or password', { 
    code: 'INVALID_CREDENTIALS' 
  });
  // → Automatically returns 401 (from DEFAULT_STATUS_BY_CODE)
  // → Client sees: { error: { code: 'INVALID_CREDENTIALS', message: '...', requestId: '...' } }
}
```

---

#### **10. Response Sent**

**Fastify Serialization:**
```typescript
// Route handler returns object
return { accessToken: 'xyz...' };

// Fastify serializes to JSON
res.setHeader('Content-Type', 'application/json');
res.end(JSON.stringify({ accessToken: 'xyz...' }));
```

**HTTP Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 245

{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

---

#### **11. Response Logging (onResponse Hook)**

**API Logger Plugin:**
```typescript
app.addHook('onResponse', async (request, reply) => {
  const durationMs = Date.now() - request.auditStartMs;

  await app.db.query(`
    INSERT INTO api_request_logs (
      request_id, method, path, status_code, duration_ms, ...
    ) VALUES ($1, $2, $3, $4, $5, ...)
  `, [...]);
});
```

**What Gets Logged:**
- Request ID (correlation)
- HTTP method (GET, POST, etc.)
- URL path (without query params)
- Status code (200, 400, 500, etc.)
- Duration in milliseconds
- Authenticated user ID (if logged in)
- Error code (if request failed)

**Database Record:**
```json
{
  "occurred_at": "2026-01-15T10:30:45.123Z",
  "request_id": "req-abc-123",
  "http_method": "POST",
  "http_path": "/api/v1/auth/login",
  "status_code": 200,
  "duration_ms": 45,
  "authenticated_user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Request Timing Breakdown

**Typical Request:**
```
Security headers:   <1ms
Rate limit check:   <1ms
CORS check:         <1ms
Validation:         1-2ms
Route handler:      5-20ms
  ├─ DB query:      3-10ms
  ├─ Business logic: 2-5ms
  └─ JWT signing:   1-3ms
Serialization:      1-2ms
Response logging:   2-5ms
─────────────────────────
TOTAL:              10-35ms
```

**Slow Request (>100ms):**
- Complex SQL queries
- Multiple database round-trips
- External API calls
- Heavy computation

---

## Logging Lifecycle

### Why Structured Logging?

**Traditional Logging:**
```
[2026-01-15 10:30:45] INFO: User logged in
```

**Structured Logging:**
```json
{
  "level": "info",
  "time": "2026-01-15T10:30:45.123Z",
  "msg": "user logged in",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "ip": "203.0.113.45"
}
```

**Benefits:**
- ✅ **Searchable**: Query by userId, ip, status code
- ✅ **Parseable**: CloudWatch Insights, Datadog, Elasticsearch
- ✅ **Correlation**: Link all logs from one request
- ✅ **Alerting**: Trigger alerts on error rate, latency

---

### Logger Initialization

**When:** During `buildApp()` in Phase 3

**Fastify Logger (Pino):**
```typescript
const app = Fastify({
  logger: env.nodeEnv !== 'test'  // Enabled in dev/prod, disabled in tests
});
```

**Configuration:**
- **Format**: JSON (one log per line)
- **Level**: `info` (development), `warn` (production)
- **Output**: `stdout` (captured by systemd, CloudWatch, Docker)

**Example Log:**
```json
{
  "level": 30,
  "time": 1705315845123,
  "pid": 12345,
  "hostname": "ip-10-0-1-42",
  "msg": "server started",
  "host": "0.0.0.0",
  "port": 3001
}
```

---

### Log Levels

| Level | Number | Use Case | Example |
|-------|--------|----------|---------|
| `trace` | 10 | Debugging | Variable values |
| `debug` | 20 | Development | Function calls |
| **`info`** | 30 | Normal | Server started, user logged in |
| **`warn`** | 40 | Recoverable errors | Deprecated API used |
| **`error`** | 50 | Request failures | DB query failed |
| **`fatal`** | 60 | Unrecoverable | Server can't start |

**Production Setting:**
```bash
# Only log warn/error/fatal
LOG_LEVEL=warn
```

---

### Request Logging

**Automatic Logs (Fastify):**

**Start:**
```json
{
  "level": "info",
  "msg": "incoming request",
  "reqId": "req-1",
  "method": "POST",
  "url": "/api/v1/auth/login"
}
```

**End:**
```json
{
  "level": "info",
  "msg": "request completed",
  "reqId": "req-1",
  "statusCode": 200,
  "responseTime": 45
}
```

**Error:**
```json
{
  "level": "error",
  "msg": "request error",
  "reqId": "req-1",
  "err": {
    "type": "InvalidCredentialsError",
    "message": "Email or password is incorrect",
    "stack": "Error: ...\n    at ..."
  }
}
```

---

### Error Logging

**Example: Database Connection Error**

**Code:**
```typescript
try {
  await app.db.query('SELECT * FROM users');
} catch (err) {
  app.log.error({ err }, 'database query failed');
  throw new DatabaseError('Failed to fetch users');
}
```

**Log Output:**
```json
{
  "level": "error",
  "msg": "database query failed",
  "err": {
    "type": "Error",
    "message": "Connection terminated unexpectedly",
    "stack": "Error: Connection terminated unexpectedly\n    at Connection.parseE (/app/node_modules/pg/lib/connection.js:674:13)"
  }
}
```

---

### Startup/Shutdown Logs

**Startup:**
```json
{"level":"info","msg":"server started","host":"0.0.0.0","port":3001}
```

**Shutdown:**
```json
{"level":"info","msg":"shutting down server","signal":"SIGTERM"}
{"level":"info","msg":"server closed gracefully"}
```

**Crash:**
```json
{"level":"fatal","msg":"uncaught exception","err":{...}}
{"level":"fatal","msg":"failed to start server","err":{...}}
```

---

### Production Log Aggregation

**Flow:**
```
Node.js (stdout) → systemd → journald → CloudWatch Logs → Datadog/Elasticsearch
```

**CloudWatch Insights Query:**
```
fields @timestamp, msg, statusCode, duration_ms, userId
| filter statusCode >= 500
| sort @timestamp desc
| limit 100
```

**Common Queries:**

1. **Error rate:**
   ```
   filter level = "error"
   | stats count() by bin(5m)
   ```

2. **Slow requests:**
   ```
   filter responseTime > 1000
   | fields @timestamp, url, responseTime
   ```

3. **User activity:**
   ```
   filter userId = "550e8400-e29b-41d4-a716-446655440000"
   | sort @timestamp desc
   ```

---

## Shutdown & Restart Lifecycle

### Why Graceful Shutdown Matters

**Without Graceful Shutdown:**
```
systemd → SIGKILL → process terminated immediately
→ Active requests fail (502 Bad Gateway)
→ Database connections leak
→ Users see errors
```

**With Graceful Shutdown:**
```
systemd → SIGTERM → server stops accepting new requests
→ Wait for active requests to finish (10s timeout)
→ Close database connections
→ Exit cleanly (code 0)
→ No user-facing errors
```

---

### Shutdown Trigger: SIGTERM

**Who Sends SIGTERM:**

1. **systemd** (Linux service manager)
   ```bash
   sudo systemctl stop backend
   sudo systemctl restart backend
   ```

2. **pm2** (process manager)
   ```bash
   pm2 restart backend
   pm2 stop backend
   ```

3. **AWS Auto Scaling**
   - Instance scale-down
   - Instance refresh
   - Health check failure

4. **Kubernetes**
   - Pod termination
   - Rolling update
   - Node drain

---

### Graceful Shutdown Sequence

**File:** `src/server.ts`

**Step-by-Step:**

#### **1. SIGTERM Signal Received**

```typescript
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

**Log:**
```json
{"level":"info","msg":"shutting down server","signal":"SIGTERM"}
```

---

#### **2. Stop Accepting New Connections**

```typescript
await app.close();
```

**What Happens:**
- TCP socket stops listening
- New connection attempts → `Connection refused`
- Active connections → allowed to finish

**Production Context:**
- ALB stops sending new requests (health check failing)
- In-flight requests continue processing
- Timeout: 10 seconds (Fastify default)

---

#### **3. Wait for Active Requests**

**Fastify Behavior:**
- Track all active requests
- Wait for all to complete
- If timeout (10s), forcefully close

**Example:**
```
Active requests: 15
→ 10 complete in 2s
→ 4 complete in 5s
→ 1 slow query takes 8s
→ All complete in 8s
→ Proceed to next step
```

---

#### **4. Close Database Connections**

**DB Plugin `onClose` Hook:**
```typescript
app.addHook('onClose', async () => {
  await closeDbPool(pool);
});
```

**What Happens:**
```typescript
async function closeDbPool(pool: Pool): Promise<void> {
  await pool.end();  // Close all connections gracefully
}
```

**Database Side:**
- Postgres sees: `client_addr disconnected`
- Connections released back to Postgres connection pool
- No connection leaks

---

#### **5. Exit Process**

```typescript
process.exitCode = 0;  // Clean shutdown
```

**Log:**
```json
{"level":"info","msg":"server closed gracefully"}
```

**systemd Behavior:**
```bash
# systemd sees exit code 0
# Marks service as "deactivating"
# Does NOT restart (unless explicitly configured)
```

---

### Shutdown Timeout Handling

**If Shutdown Takes Too Long:**

**Fastify Timeout: 10 seconds**
```typescript
// After 10s, forcefully close
app.close({ timeout: 10000 });
```

**systemd Timeout: 90 seconds**
```ini
[Service]
TimeoutStopSec=90
```

**What Happens:**
```
0s  - SIGTERM sent
10s - Fastify forcefully closes connections
90s - systemd sends SIGKILL (forced termination)
```

**Best Practice:**
- Keep shutdown under 30 seconds
- Configure ALB connection draining: 30s
- Configure systemd timeout: 90s

---

### Restart Scenarios

#### **Scenario 1: Graceful Restart (systemd)**

**Command:**
```bash
sudo systemctl restart backend
```

**Flow:**
```
1. systemd → SIGTERM to old process
2. Old process → graceful shutdown (10s)
3. systemd → starts new process
4. New process → server started
5. Total downtime: 0-2s (overlap)
```

---

#### **Scenario 2: Rolling Deployment (AWS ASG)**

**Flow:**
```
1. ALB → starts health checks on new instance
2. New instance → healthy (after 2-3 health checks)
3. ALB → sends SIGTERM to old instance
4. Old instance → graceful shutdown
5. ALB → routes traffic to new instance only
6. Total downtime: 0s (zero-downtime deployment)
```

**Timeline:**
```
0s   - New instance launches
30s  - New instance health checks pass
35s  - ALB starts routing traffic to new instance
40s  - ALB stops routing to old instance
45s  - SIGTERM sent to old instance
55s  - Old instance shutdown complete
```

---

#### **Scenario 3: Crash Recovery**

**What Happens:**
```
1. Uncaught exception → process.exitCode = 1
2. Node.js exits
3. systemd sees exit code 1 (failure)
4. systemd → restarts service (per policy)
5. New process starts
```

**systemd Restart Policy:**
```ini
[Service]
Restart=on-failure
RestartSec=5s
```

**Implications:**
- Service auto-recovers from crashes
- Downtime: 5-10 seconds
- Health checks fail during downtime
- ALB routes traffic to healthy instances

---

## Production Failure Scenarios

### Scenario 1: Database Connection Failure at Startup

**What Happens:**

**Code:**
```typescript
// Config validation
if (env.nodeEnv !== 'test') {
  assertDbConfigIsPresent(env);  // Throws if DB config missing
}
```

**Error:**
```
Error: Database configuration missing. Set DATABASE_URL or: PGHOST, PGPORT
```

**Result:**
- Process crashes immediately (before listening on port)
- Exit code: 1
- systemd: Tries to restart
- After 5 restarts in 10 minutes → systemd gives up

**Fix:**
```bash
# Set DATABASE_URL in environment
export DATABASE_URL=postgres://user:pass@host:5432/dbname

# Restart service
sudo systemctl restart backend
```

---

### Scenario 2: Database Connection Lost During Runtime

**What Happens:**

**Code:**
```typescript
app.post('/api/v1/users', async (request, reply) => {
  const result = await app.db.query('SELECT * FROM users');
  // Database connection lost here ↑
});
```

**Error:**
```json
{
  "level": "error",
  "msg": "request error",
  "err": {
    "message": "Connection terminated unexpectedly",
    "code": "57P01"
  }
}
```

**Client Response:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal Server Error"
  }
}
```

**Result:**
- Request fails with 500 error
- Client sees generic error message (security)
- Database pool attempts reconnection
- Next request may succeed (if DB is back online)

**Mitigation:**
- **Retry logic** in client
- **Circuit breaker** for database calls
- **Health checks** detect DB issues
- **Alerts** on error rate spike

---

### Scenario 3: Unhandled Promise Rejection

**What Happens:**

**Code:**
```typescript
async function fetchUser(id: string) {
  const result = await app.db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Forgot to await!
fetchUser('123');  // Promise rejected, but no .catch()
```

**Error:**
```json
{
  "level": "error",
  "msg": "unhandled promise rejection",
  "reason": {
    "message": "Database query failed",
    "stack": "..."
  }
}
```

**Result:**
- **Process does NOT crash** (we handle this)
- Error logged for debugging
- Request may or may not fail (depends on timing)

**Prevention:**
```typescript
// Always await async functions
await fetchUser('123');

// Or handle errors explicitly
fetchUser('123').catch(err => {
  app.log.error({ err }, 'failed to fetch user');
});
```

---

### Scenario 4: Out of Memory (OOM)

**What Happens:**

**Cause:**
- Memory leak in application code
- Too many concurrent requests
- Large request bodies
- Database result set too large

**Symptoms:**
```json
{"level":"fatal","msg":"JavaScript heap out of memory"}
```

**Result:**
- Node.js crashes immediately
- Exit code: 134 (SIGABRT)
- systemd restarts service
- Same issue repeats (leak persists)

**Detection:**
```bash
# Monitor memory usage
ps aux | grep node
# Or use CloudWatch/Datadog

# Memory alert
if memory > 80% for 5 minutes → alert
```

**Fix:**
1. **Identify leak** (heap dump, profiling)
2. **Increase memory limit** (temporary)
   ```bash
   node --max-old-space-size=4096 dist/server.js
   ```
3. **Fix code** (release resources, limit concurrency)

---

### Scenario 5: Port Already in Use

**What Happens:**

**Code:**
```typescript
await app.listen({ host: '0.0.0.0', port: 3001 });
```

**Error:**
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

**Result:**
- Server fails to start
- Exit code: 1
- systemd keeps retrying
- Service never becomes healthy

**Fix:**
```bash
# Find process using port
sudo lsof -i :3001

# Kill old process
sudo kill <PID>

# Or use different port
export PORT=3002
```

---

### Scenario 6: Uncaught Exception

**What Happens:**

**Code:**
```typescript
// Synchronous error, no try/catch
const data = JSON.parse(invalidJson);  // Throws SyntaxError
```

**Error:**
```json
{
  "level": "fatal",
  "msg": "uncaught exception",
  "err": {
    "message": "Unexpected token in JSON at position 0",
    "stack": "..."
  }
}
```

**Result:**
- Error logged
- `process.exitCode = 1`
- Node.js exits after current event loop tick
- systemd restarts service

**Prevention:**
```typescript
// Always wrap risky operations
try {
  const data = JSON.parse(input);
} catch (err) {
  app.log.error({ err }, 'failed to parse JSON');
  throw new ValidationError('Invalid JSON');
}
```

---

### Scenario 7: Slow Requests (Timeout)

**What Happens:**

**Code:**
```typescript
app.post('/api/v1/report', async (request, reply) => {
  // Complex report generation takes 60 seconds
  const report = await generateComplexReport();
  return report;
});
```

**Client Timeout:**
```
Client: 30s timeout
Backend: Still processing (60s)
Result: Client sees timeout error
Backend: Completes successfully (wasted resources)
```

**Solution 1: Async Job**
```typescript
app.post('/api/v1/report', async (request, reply) => {
  // Queue job, return immediately
  const jobId = await queueReportGeneration(request.body);
  return { jobId, status: 'processing' };
});

app.get('/api/v1/report/:jobId', async (request, reply) => {
  // Check job status
  const result = await getJobResult(request.params.jobId);
  return result;
});
```

**Solution 2: Streaming**
```typescript
app.get('/api/v1/report', async (request, reply) => {
  reply.type('application/json');
  const stream = createReportStream();
  return reply.send(stream);
});
```

---ate Limit Attack

**What Happens:**

**Attack:**
```
Attacker: Sends 100 requests/second to /api/v1/auth/login
Goal: Brute force user passwords
```

**Rate Limiter Response:**
```
Request 1-10:   200 OK (allowed)
Request 11:     429 Too Many Requests (blocked)
Request 12-100: 429 Too Many Requests (blocked)
```

**Log Output:**
```json
{
  "level": "warn",
  "msg": "rate limit exceeded",
  "ip": "203.0.113.45",
  "path": "/api/v1/auth/login"
}
```

**Result:**
- Attacker blocked after 10 requests
- Must wait 1 minute before retry
- Legitimate users unaffected (different IPs)
- Server resources protected

**Detection:**
```
CloudWatch Alarm: 429 responses > 100/min
→ Investigate potential attack
→ Consider IP blocking at ALB level
```

**Mitigation:**
- **Lower limit** for auth endpoints (5 requests/min)
- **IP blocking** at ALB/WAF level
- **CAPTCHA** after 3 failed attempts
- **Alert** security team on repeated violations

---

### Scenario 9: R

### Scenario 8: Rolling Deployment Failure

**What Happens:**

**Bad Deployment:**
```
1. New code deployed with bug
2. New instance starts
3. Health check passes (server is listening)
4. ALB routes traffic
5. All requests fail (500 errors)
```

**Detection:**
```
CloudWatch Alarm: Error rate > 5%
→ Trigger rollback
```

**Rollback:**
```bash
# AWS Auto Scaling
aws autoscaling start-instance-refresh --auto-scaling-group-name backend-asg --rollback

# Or manual
systemctl stop backend
systemctl start backend.old
```

**Prevention:**
- **Smoke tests** before health checks pass
- **Gradual rollout** (10% → 50% → 100%)
- **Automated rollback** on error rate spike

---

## Summary: Key Takeaways

### Startup (100-200ms)
1. ✅ Config validated (fail fast)
2. ✅ Plugins registered (order matters)
3. ✅ Network bound (server listening)
4. ✅ Signal handlers active (graceful shutdown ready)

### Runtime
1. ✅ Request → CORS → Validation → Handler → DB → Response
2. ✅ All requests logged (audit trail)
3. ✅ Errors caught and logged (never crash)
4. ✅ Connection pooling (fast DB access)

### Shutdown (5-10s)
1. ✅ SIGTERM → Stop accepting requests
2. ✅ Wait for active requests (10s timeout)
3. ✅ Close DB connections (no leaks)
4. ✅ Exit cleanly (code 0)

### Production
1. ✅ Zero-downtime deployments (ALB + graceful shutdown)
2. ✅ Auto-recovery from crashes (systemd restart)
3. ✅ Comprehensive logging (CloudWatch, Datadog)
4. ✅ Health checks (ALB, systemd)

---

## Next Steps for New Engineers

### To Learn More:
1. Read annotated source code (heavily commented)
2. Run local server and observe logs
3. Trigger shutdown (Ctrl+C) and observe graceful shutdown
4. Simulate database failure and observe recovery

### To Debug Production Issues:
1. Check CloudWatch Logs for errors
2. Query `api_request_logs` table for failed requests
3. Correlate logs using `request_id`
4. Review health check failures in ALB

### To Improve Reliability:
1. Add retry logic for transient failures
2. Implement circuit breakers for external dependencies
3. Add request timeouts (prevent slow requests)
4. Monitor memory usage and set alerts

---

**End of Documentation**
