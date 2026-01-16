# Web Admin Auth & RBAC Onboarding (Frontend)

This doc explains the *existing* Web Admin authentication and authorization implementation.

Constraints (per project guidance):
- Do not regenerate UI.
- Do not refactor logic.
- Do not change backend integration / API contracts.
- Frontend guards are for UX; backend remains the enforcement point.

---

## Quick map (files to read)

### Login & MFA UI
- `src/app/components/auth/LoginScreen.tsx`
- `src/app/components/auth/CredentialsStep.tsx`
- `src/app/components/auth/MfaChallengeScreen.tsx`
- `src/app/components/auth/MfaEnrollmentFlow.tsx`
- `src/app/components/auth/ForbiddenPage.tsx`

### Auth state + token lifecycle
- `src/auth/AuthContext.tsx` (auth state machine)
- `src/auth/authClient.ts` (admin auth API calls + token store)
- `src/auth/authStore.ts` (sessionStorage persistence)
- `src/auth/jwt.ts` (client-side JWT payload decoding)

### Routing, guards, and error handling
- `src/app/App.tsx` (route wiring + AuthErrorListener)
- `src/app/routing/ProtectedRoute.tsx` (protects routes)
- `src/app/routing/guards.tsx` (permission utilities)
- `src/app/routing/authEvents.ts` (auth error event bus)

### API client (401/403/expired handling)
- `src/app/api/http.ts` (auth header + refresh-on-401 + auth error events)

---

## 1) Admin Login Flow (line-by-line)

### 1.1 Login form (UI)
File: `src/app/components/auth/LoginScreen.tsx`

1. `useAuth()` provides `loginWithPassword(email, password)`.
2. `handleCredentialsSubmit()`:
   - `preventDefault()` stops browser navigation.
   - Clears the previous error.
   - Calls `loginWithPassword(email, password)`.
   - Does **not** call `navigate()` on success.

Why no explicit `navigate()` here?
- Routing decisions are centralized in `src/app/App.tsx` + `ProtectedRoute` based on auth status.
- This prevents multiple UI components from implementing their own ad-hoc rules for MFA, expired tokens, etc.

The actual form fields are in `src/app/components/auth/CredentialsStep.tsx`.

### 1.2 API call (admin login step 1)
File: `src/auth/authClient.ts`

`authClient.login(email, password)`:
1. `POST /admin/auth/login` via `authFetch()`.
2. Parses the response into one of:
   - `MFA_SETUP_REQUIRED` (admin must enroll TOTP)
   - `MFA_CHALLENGE` (admin must enter OTP)
   - `AUTHENTICATED` (tokens returned immediately)

Important: Web Admin does not infer MFA needs locally.
- The backend is the security authority and decides whether MFA is required.

### 1.3 Token handling (store + validate)
Files:
- `src/auth/authClient.ts` (`storeTokens()`)
- `src/auth/authStore.ts` (persistence)

When tokens are received:
1. `storeTokens()` decodes the access token payload using `decodeJwtPayload()`.
2. It enforces a defensive client rule: `role` must be `ADMIN`.
3. Builds an `AuthState` object and persists it via `authStore.set()`.

Why store tokens in `sessionStorage`?
- Tab-scoped persistence: tokens are cleared when the tab closes.
- Reduces persistence risk vs `localStorage` on shared devices.

Security note:
- Anything in Web Storage is still readable by JavaScript.
- This is not as strong as httpOnly cookies against XSS.
- The system relies on short-lived access tokens + backend refresh rotation + backend authz enforcement.

### 1.4 Post-login routing (centralized)
File: `src/app/App.tsx`

`LoginRoute()`:
- If `status === AUTHENTICATED` → `<Navigate to="/app" />`
- If `status === MFA_SETUP_REQUIRED` → `<Navigate to="/mfa/setup" />`
- If `status === MFA_CHALLENGE` → `<Navigate to="/mfa/challenge" />`

`/app` is wrapped in `ProtectedRoute`, so even if a user manually edits the URL, the UI fails closed.

---

## 2) Token Lifecycle in Web Admin

### 2.1 What we store
File: `src/auth/authStore.ts`

The `AuthState` includes:
- `access_token` (used in `Authorization: Bearer ...`)
- `refresh_token` (used only for refresh/logout API calls)
- `expires_at` (for bootstrapping / pre-expiry checks)
- `user` + `adminContext` (identity + permissions for UI)

### 2.2 Bootstrapping on refresh
File: `src/auth/AuthContext.tsx`

On app start:
1. If `authStore` has a stored access token, `authClient.bootstrap()` runs.
2. `bootstrap()` checks `expires_at`:
   - If expired → `authClient.refresh()`.
   - Else → permissions hydration runs.
3. If anything fails → clear auth and render as unauthenticated.

Why “fail closed”?
- Admin surfaces are sensitive.
- If token state is inconsistent, we prefer redirect-to-login over partial access.

### 2.3 Refresh behavior (expired access token)
File: `src/app/api/http.ts`

For `apiRequest(..., { auth: true })`:
- Adds `Authorization` header.
- If response is `401` and a refresh token exists:
  1. Calls `authClient.refresh()`.
  2. Retries the original request with the new access token.
  3. If refresh fails → clears auth, emits `AUTH_TOKEN_EXPIRED`, and throws.

### 2.4 Logout behavior
File: `src/auth/authClient.ts`

- Clears local auth state first (instant UI lock).
- Then best-effort `POST /admin/auth/logout` with refresh token.

---

## 3) Admin RBAC in UI

### 3.1 Roles vs Permissions in the frontend
- The **role** (`ADMIN`) is read from the access token payload (UX sanity check).
- **Permissions** are not assumed from the token; they are hydrated from the backend via `GET /admin/auth/permissions`.

Why fetch permissions instead of embedding them in the JWT?
- Permissions change more frequently than identity.
- Avoids large tokens.
- Keeps authorization state backend-driven.

### 3.2 How permissions affect rendering
Files:
- `src/app/components/layout/menuConfig.ts` (maps modules → required permission)
- `src/app/components/layout/Sidebar.tsx` (filters menu items)
- `src/app/routing/guards.tsx` (helpers/HOCs)

Typical patterns:
- Hide a module if the user lacks the module’s `requiredPermission`.
- Hide a button/action if the user lacks a specific action permission.

### 3.3 Why check permissions in the frontend if backend enforces them?
- UX and clarity: users should not see actions they can’t perform.
- Performance: avoids unnecessary API calls.
- Safety: reduces the chance of accidentally building UI paths that always fail.

But:
- Frontend checks are not security.
- Backend permission checks remain mandatory.

---

## 4) Admin 2FA (TOTP) Handling

The admin flow is intentionally multi-step and backend-driven.

### 4.1 MFA Challenge
Files:
- `src/auth/authClient.ts` (`respondToMfaChallenge()`)
- `src/app/components/auth/MfaChallengeScreen.tsx`

Flow:
1. Login returns `MFA_CHALLENGE` + `session`.
2. UI collects OTP.
3. `POST /admin/auth/login/mfa` exchanges session+OTP for tokens.
4. AuthContext transitions to `AUTHENTICATED`.

### 4.2 MFA Setup (Enrollment)
Files:
- `src/auth/authClient.ts` (`startTotpSetup`, `verifyTotpSetup`)
- `src/app/components/auth/MfaEnrollmentFlow.tsx`

Flow:
1. Login returns `MFA_SETUP_REQUIRED` + `setupToken`.
2. `POST /admin/auth/2fa/setup` returns:
   - QR code data URL
   - secret
3. User enters OTP.
4. `POST /admin/auth/2fa/verify` returns tokens.

Why frontend does not decide security outcomes:
- Frontend cannot be trusted (user can modify client code).
- Backend validates OTP, issues tokens, and logs security events.

---

## 5) Error Handling (unauthorized, forbidden, expired)

### 5.1 Unauthorized (401)
Where it happens:
- API calls in `src/app/api/http.ts`.

Behavior:
- Attempt refresh once.
- If refresh fails → emit `AUTH_TOKEN_EXPIRED`.
- `AuthErrorListener` in `src/app/App.tsx` responds by logging out and redirecting to `/login`.

### 5.2 Forbidden (403)
Two common cases:
- `AUTH_FORBIDDEN`: treated as fail-closed → logout + back to login.
- `RBAC_INSUFFICIENT_ROLE`: user is authenticated but not allowed to use admin surface → navigate to `/forbidden`.

### 5.3 Expired token
- Implemented as `AUTH_TOKEN_EXPIRED`.
- Triggered when refresh fails.
- Handled centrally by `AuthErrorListener`.

---

## 6) Frontend vs Backend Responsibility

Frontend responsibilities:
- Present login/MFA UI.
- Store tokens for API calls (as designed in this repo).
- Hide/disable UI based on permissions (UX).
- Redirect to correct routes based on auth state.

Backend responsibilities (authoritative):
- Verify password + OTP.
- Decide whether MFA is required.
- Sign/verify JWTs.
- Enforce RBAC permissions on every endpoint.

---

## 7) Security reasoning (why the design looks like this)

- Centralized auth state machine (`AuthContext`) prevents inconsistent UI auth behavior.
- Session-scoped storage reduces persistence risk.
- Refresh-on-401 keeps sessions smooth while still expiring access tokens.
- UI permission gating improves UX but never replaces backend enforcement.
