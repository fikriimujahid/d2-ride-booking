# Auth API (Fastify + PostgreSQL)

This service implements production-grade authentication & authorization for:
- **Admin** users (Web Admin only + TOTP 2FA)
- **Driver** users (Driver app only)
- **Passenger** users (Passenger app only)

Key properties:
- Stateless request auth: **JWT access tokens**.
- Session continuity: **opaque refresh tokens** with rotation & reuse detection.
- Authorization: **RBAC** for Admins (roles, role hierarchy, permissions) enforced by middleware.

## Quickstart

1. `cp .env.example .env` and fill values.
2. Install deps: `npm i`.
3. Run migrations (dev): `npm run migrate:dev`.
4. Seed initial users & RBAC (dev): `npm run seed:dev`.
4. Start dev server: `npm run dev`.

Note: `npm run migrate` / `npm run seed` run the compiled scripts from `dist/` (intended for production deploys).

## Deliverables

- Architecture: see "Architecture" section.
- DB schema: see `migrations/001_init.sql`.
- Middleware: see `src/auth/middleware.ts`.
- Routes: see `src/auth/routes/*`.
- Edge cases & security notes: see "Security Notes" section.

## Auth Architecture

### Components

- Fastify API (this service)
  - Responsible for authentication, token issuance, and authorization decisions.
  - Stateless per-request verification via JWT.

- PostgreSQL
  - Source of truth for users, admin RBAC graph, refresh-token rotation state, and Admin TOTP enrollment.

### User types & login surfaces (server-side enforced)

User types are enforced in three ways:

1. Separate routes per user type:
   - Admin: `/admin/auth/*`
   - Driver: `/driver/auth/*`
   - Passenger: `/passenger/auth/*`

2. JWT audience (`aud`) bound to client type:
   - Admin: `aud=admin-web` (configured via `JWT_AUD_ADMIN`)
   - Driver: `aud=driver-app`
   - Passenger: `aud=passenger-app`

3. Admin-only Origin allowlist:
   - Admin auth endpoints require `Origin` to be in `ADMIN_WEB_ORIGINS`.
   - This does not replace JWT but adds a concrete server-side constraint for “Admin login only via Web Admin”.
  - `ADMIN_WEB_ORIGINS` must contain the **frontend website origin(s)** (the exact value of the browser `Origin` header), not the backend host.
    Examples:
    - S3 static website: `http://d2-ride-booking-dev-admin-731099197523.s3-website-ap-southeast-1.amazonaws.com`
    - Local dev: `http://localhost:5173`

### Token model

- Access token (JWT)
  - `typ=access`, short TTL (`ACCESS_TOKEN_TTL_SECONDS`)
  - Claims:
    - `sub`: user id
    - `ut`: user type (`ADMIN|DRIVER|PASSENGER`)
    - `aud`: client audience
    - `perm` (Admin only): effective permissions at issuance time

- Refresh token (opaque)
  - Long TTL (`REFRESH_TOKEN_TTL_DAYS`)
  - Stored as `sha256(refreshToken)` in DB (never store raw)
  - Rotation on refresh; reuse detection revokes whole token family

- Admin MFA token (JWT)
  - `typ=mfa`, short TTL (`MFA_TOKEN_TTL_SECONDS`)
  - Issued after successful password check; used to complete TOTP verification

- Admin enrollment token (JWT)
  - `typ=enroll`, short TTL (`ENROLL_TOKEN_TTL_SECONDS`)
  - Issued when Admin needs to enroll TOTP

### Admin 2FA flow

1. `/admin/auth/login` with email+password
   - If no enabled TOTP: returns `428 TWO_FACTOR_ENROLLMENT_REQUIRED` with `enrollToken`
   - Else returns `mfaToken`

2. `/admin/auth/verify-2fa` with `mfaToken` + TOTP code
   - On success, returns access + refresh tokens

3. Enrollment (only when required)
   - `/admin/auth/2fa/setup` with `enrollToken` returns `secret` + `otpauthUri`
   - `/admin/auth/2fa/confirm` with `enrollToken` + code enables TOTP and returns tokens

## Database Schema

Schema is implemented in `migrations/001_init.sql`.

### Core tables

- `users`
  - `user_type`: enum `ADMIN|DRIVER|PASSENGER`
  - `email` and/or `phone` identifiers
  - `password_hash`: argon2id
  - `failed_login_count`, `locked_until`: brute-force mitigation primitives

- `admin_totp`
  - `secret_enc`: AES-256-GCM encrypted secret
  - `enabled`, `enrolled_at`, `last_used_at`

- `refresh_tokens`
  - `token_hash`: SHA-256 of raw token (unique)
  - `family_id`: used for rotation and reuse-revocation
  - `used_at`, `replaced_by`: rotation linkage
  - `revoked_at`, `revoked_reason`: invalidation state

### Admin RBAC tables

- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_role_inheritance` (parent -> child; parent inherits child permissions)
- `admin_user_roles`

Effective permissions are computed with a recursive CTE in `src/rbac/permissions.ts`.

## Middleware Logic

Middleware entrypoints are in `src/auth/middleware.ts`.

### Authentication

- Extract bearer token from `Authorization: Bearer <jwt>`.
- Verify JWT with:
  - issuer (`iss`) and audience (`aud`)
  - token type (`typ`) matches expected (access/mfa/enroll)
- Populate `req.auth = { userId, userType, audience, permissions? }`.

### Authorization (RBAC)

- `requireUserType(req, 'ADMIN'|'DRIVER'|'PASSENGER')`
- `requirePermission(req, 'perm.key')` (Admin only)
  - Uses `perm` claim in access token.
  - Recompute permissions on token issuance (login/refresh) so changes apply at next refresh.

## API Routes

Implemented in `src/auth/routes/*`.

### Admin

- `POST /admin/auth/login`
  - Body: `{ email, password }`
  - Returns:
    - `428 TWO_FACTOR_ENROLLMENT_REQUIRED` with `{ enrollToken }` if 2FA not enabled
    - or `{ mfaRequired: true, mfaToken }`

- `POST /admin/auth/verify-2fa`
  - Body: `{ mfaToken, code }`
  - Returns `{ accessToken, refreshToken, expiresAt }`

- `POST /admin/auth/2fa/setup`
  - Body: `{ enrollToken }`
  - Returns `{ secret, otpauthUri }`

- `POST /admin/auth/2fa/confirm`
  - Body: `{ enrollToken, code }`
  - Returns `{ accessToken, refreshToken, expiresAt }`

- `POST /admin/auth/refresh`
  - Body: `{ refreshToken }`
  - Returns rotated `{ accessToken, refreshToken, expiresAt }`

- `POST /admin/auth/logout`
  - Body: `{ refreshToken }`
  - Revokes that refresh token

### Driver

- `POST /driver/auth/login` body `{ identifier, password }`
- `POST /driver/auth/refresh` body `{ refreshToken }`
- `POST /driver/auth/logout` body `{ refreshToken }`

### Passenger

- `POST /passenger/auth/login` body `{ identifier, password }`
- `POST /passenger/auth/refresh` body `{ refreshToken }`
- `POST /passenger/auth/logout` body `{ refreshToken }`

## Edge Cases & Security Notes

### Client separation & “stateless backend”

- Separation is enforced by:
  - dedicated endpoints per user type
  - JWT `aud` enforcement
  - Admin Origin allowlist
- This is still fundamentally a stateless JWT auth model; the only persisted “session state” is refresh token rotation state.

### Refresh token rotation & replay

- Every refresh rotates the token and marks the old one `used_at`.
- If a previously used/revoked token is presented again, the system:
  - revokes the entire family (`family_id`) to contain replay
  - returns 401

### TOTP enrollment

- The setup endpoint returns the raw `secret` for QR generation. In production you should:
  - only return `otpauthUri` (or QR) once
  - log an audit event (not implemented)
  - require password re-entry (step-up auth) for re-enrollment

### Admin Origin checks

- Origin allowlisting is a strong “only from web admin” constraint for browser clients.
- Non-browser clients can forge Origin; do not rely on Origin alone. JWT `aud` is the primary enforcement.

### JWT hardening recommendations

- Prefer asymmetric keys (`EdDSA`/`RS256`) with rotation using `kid`.
- Pin issuer/audience; reject unexpected `typ`.
- Keep access TTL short; use refresh rotation.

### Rate limiting

- This code includes lockout primitives but does not implement global IP rate limiting.
- In production, add:
  - per-IP rate limits on `/auth/login`, `/verify-2fa`, `/refresh`
  - per-account rate limits for Admin

### Password policy

- Current validation is minimal (`min(8)`). In production, enforce:
  - breached password checks
  - stronger rules for Admin
  - password reset flows + email/phone verification


## Architecture

### Token model

- **Access token (JWT)**
  - Short TTL (default 15m)
  - Contains: `sub` (user id), `ut` (user type), `aud` (client), `typ=access`
  - Admin tokens also contain `perm` (effective permissions at issuance)

- **Refresh token (opaque)**
  - Long TTL (default 30d)
  - Stored server-side as **SHA-256 hash** with metadata
  - Rotation on every refresh; **reuse detection** revokes the whole token family

- **Admin MFA token (JWT)**
  - Short TTL (default 5m)
  - `typ=mfa`, used only to complete TOTP verification

- **Admin enroll token (JWT)**
  - Short TTL (default 10m)
  - `typ=enroll`, used only to enroll TOTP when required

### Client-type enforcement (server-side)

Each user type has dedicated endpoints and enforced audience:
- Admin: `/admin/*` and `aud=admin-web` and Origin allowlist
- Driver: `/driver/*` and `aud=driver-app`
- Passenger: `/passenger/*` and `aud=passenger-app`

Note: client enforcement relies on **route separation + JWT `aud` enforcement**. For Admin, we additionally require a valid `Origin` header matching `ADMIN_WEB_ORIGINS`.

## Security Notes (high level)

- Password hashing: `argon2id`.
- Brute-force defenses: failed login counters + lockouts (schema supports this; enforce in routes).
- JWT hardening: issuer/audience/type checks; short TTL; key rotation via `kid`.
- Refresh tokens: opaque + hashed storage; rotation & family revocation on reuse.
- Admin 2FA: TOTP secret encrypted at rest (AES-256-GCM).

