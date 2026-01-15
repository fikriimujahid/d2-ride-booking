# Backend Auth & RBAC Onboarding (Modular Monolith)

This document explains the *existing* authentication and authorization implementation in the single Fastify backend.

Non-negotiables (from `ARCHITECTURE.beads.md`):
- One backend app, one Fastify server, one port.
- Frontends (`web_admin`, `web_driver`, `web_passenger`) integrate with *this* API.
- Authorization is owned by backend.
- No contract changes in this document.

---

## 1) Authentication Flow (step-by-step)

### 1.1 Route shape (role namespaces)
Auth endpoints are mounted under **role-specific prefixes**:

- `POST /admin/auth/login`
- `POST /admin/auth/login/mfa`
- `POST /admin/auth/2fa/setup`
- `POST /admin/auth/2fa/verify`
- `GET  /admin/auth/permissions`

- `POST /driver/auth/login`
- `POST /driver/auth/refresh`
- `POST /driver/auth/logout`

- `POST /passenger/auth/login`
- `POST /passenger/auth/refresh`
- `POST /passenger/auth/logout`

See: backend/src/modules/auth/routes.ts

Why this exists:
- Makes the client boundary explicit (`web_admin` uses `/admin/*`, etc).
- Keeps authentication flows role-scoped.

What would break if role prefixes were removed:
- You lose a clear server-side enforcement point for "which frontend is allowed".
- You risk cross-role login/refresh (e.g., admin credentials via driver endpoints).

---

### 1.2 Login endpoint (line-by-line walkthrough)
Login flow entrypoints:
- Admin: `POST /admin/auth/login`
- Driver: `POST /driver/auth/login`
- Passenger: `POST /passenger/auth/login`

Route handler → controller → service:
- Route: `handleAdminLogin()` or `handleRoleLogin()`
- Controller: extracts request metadata (IP, UA, requestId)
- Service: `authenticateUserWithCredentials()` contains the actual auth logic

Key file chain:
- backend/src/modules/auth/routes.ts
- backend/src/modules/auth/auth.controller.ts
- backend/src/modules/auth/auth.service.ts

#### Step A — Validate input
In `authenticateUserWithCredentials()`:
- Validates email format and OTP format (if present).

Why:
- All external inputs must be validated.

If removed:
- Malformed identifiers can create inconsistent behavior and noisy logs.

#### Step B — Enforce role-scoped login (frontend-type restriction)
In `authenticateUserWithCredentials()`:
- Calls `findActiveUserByEmailAndRole(db, email, role)`.

Why:
- The `role` parameter comes from the URL namespace (`/driver` vs `/passenger` vs `/admin`).
- The repository query includes `WHERE role = $1`.

If removed:
- An `ADMIN` account could authenticate via `/driver/auth/login`.
- That breaks the boundary between frontends and makes authz assumptions harder.

#### Step C — Verify password
In `authenticateUserWithCredentials()`:
- Calls `verifyPassword(plain, user.password_hash)`.

Password hashing implementation:
- Algorithm: `scrypt`.
- Verification uses `timingSafeEqual`.

Why:
- `scrypt` is slow and memory-hard (resists brute force).
- Timing-safe compare reduces side-channel leakage.

If removed:
- Password verification becomes weaker or leaky.

#### Step D — Admin 2FA branching
Admins do not receive tokens immediately.

If admin is NOT enrolled in TOTP:
- Returns a short-lived `totp_setup` token.
- Admin must call `/admin/auth/2fa/setup` and then `/admin/auth/2fa/verify`.

If admin IS enrolled in TOTP:
- Returns an `mfa_challenge` session token.
- Admin must call `/admin/auth/login/mfa` with the OTP.

Why:
- Admin accounts have elevated power; they require stronger auth.

If removed:
- Admin login becomes single-factor.

#### Step E — Driver/Passenger token issuance
Driver and Passenger receive tokens directly via `issueTokenPair()`.

`issueTokenPair()` does:
- Generates a refresh ID (`jti`).
- Signs an access token (short-lived).
- Signs a refresh token (longer-lived, contains `jti`).
- Hashes refresh token and stores the hash in `refresh_tokens`.

Why:
- Access tokens remain stateless.
- Refresh tokens are revocable/rotatable via DB.

If removed:
- Logout and refresh rotation no longer work safely.

---

### 1.3 Refresh token logic (step-by-step)
Endpoint:
- `POST /<role>/auth/refresh`

Implementation:
- Service method: `refreshUserSession()`

Steps:
1. Verify refresh token JWT signature/expiry/type (`verifyRefreshToken`).
2. Enforce role namespace match: `claims.role === role`.
3. Hash the provided refresh token and look it up in DB (`findRefreshTokenByHash`).
4. Ensure it is not revoked and matches both:
   - `tokenRow.user_id === claims.sub`
   - `tokenRow.id === claims.jti`
5. Rotate:
   - Revoke old token row
   - Store a newly-issued refresh token (new `jti`)
   - Return new access + refresh tokens

Why rotation exists:
- A stolen refresh token can be invalidated as soon as it’s used.

If removed:
- Refresh tokens become replayable until they naturally expire.

---

### 1.4 Logout logic
Endpoint:
- `POST /<role>/auth/logout`

Implementation:
- Service method: `revokeUserSession()`

Behavior:
- Hashes the refresh token.
- Revokes the token row by hash.
- Does **not** reveal whether the token existed (best-effort).

Why:
- Prevents logout from becoming a token validity oracle.

---

## 2) Authorization Flow

### 2.1 JWT verification
Authorization uses middleware in backend/src/modules/auth/middleware.ts:

- `requireAuth()`
  - Reads `Authorization: Bearer <token>`
  - Calls `verifyAccessToken()`
  - Sets `request.authUser = { userId, role }`

Why middleware-based:
- Centralizes auth logic.
- Ensures handlers run only after identity is established.

If removed:
- Each handler would re-implement auth (inconsistent + error-prone).

### 2.2 Building user context
`request.authUser` is the minimal per-request identity:
- `userId`
- `role`

Why minimal:
- Avoids trusting mutable authorization data in JWT.
- Keeps request handling deterministic.

---

## 3) Admin RBAC Model (role vs permission)

### 3.1 Role vs Permission
- **Role (system role):** `ADMIN | DRIVER | PASSENGER`
  - Coarse boundary: determines which *namespace* and *general capabilities* apply.

- **Permission (RBAC permission code):** e.g. `ADMIN_USER_READ`, `ADMIN_USER_WRITE`, etc
  - Fine-grained authorization checks for admin actions.

Why both:
- Roles separate entire application surfaces.
- Permissions control specific sensitive admin capabilities.

### 3.2 How permissions are checked
Middleware:
- `requirePermission(permission)`

Flow:
1. Ensures an authenticated user exists.
2. Ensures `role === 'ADMIN'`.
3. Queries DB via RBAC joins to confirm permission exists for the user.
4. Logs a `auth.permission_denied` security event on failure.

Why backend-owned:
- Frontend cannot be trusted to enforce authorization (users can modify client code).
- Backend is the only trusted enforcement point.

---

## 4) Frontend-Type Restriction (server-side)

Goal:
- Admin credentials should not be usable on driver/passenger login endpoints.

How it works:
- Role-specific routes call the service with an explicit `role`.
- The repository lookup uses `WHERE role = $1`.

Result:
- Even if the email/password is correct for an admin account, `/driver/auth/login` will not find that user.

---

## 5) Security Design Rationale

### Stateless access JWT
Why:
- Fast, scalable: no per-request DB lookup required to validate access token.
- Fits the monolith being stateless (no in-memory sessions).

Risk tradeoff:
- Cannot revoke an access token instantly without additional infrastructure.

Mitigation:
- Short TTL for access token.
- Refresh token rotation + revocation.

### Refresh tokens
Why:
- Allows long-lived sessions without long-lived access tokens.
- Enables logout/revocation and replay detection.

### Middleware-based authorization
Why:
- Makes auth checks consistent.
- Keeps route handlers focused on business logic.

---

## 6) Common mistakes & anti-patterns

- Putting permissions/authorization decisions in the frontend.
- Accepting refresh tokens without DB-backed rotation.
- Storing refresh tokens in plaintext in the DB.
- Returning different error messages for "user not found" vs "wrong password".
- Letting token type confusion happen (using refresh token where access token is expected).
- Putting mutable authorization data (like permission lists) inside JWT claims.
