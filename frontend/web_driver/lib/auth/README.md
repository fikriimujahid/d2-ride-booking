# Driver Auth (web_driver)

This frontend is deployed as a **static site** (`next.config.mjs` uses `output: 'export'`).
That means:

- No Next.js route handlers at runtime
- No middleware at runtime
- No httpOnly cookie session managed by Next

So the driver app uses **sessionStorage** for tokens (scoped to the tab) and relies on **client-side guards**.

## Layering

- `auth.api.ts`: raw backend calls for `/driver/auth/*`
- `tokenStore.ts`: single place for token persistence (`sessionStorage`)
- `auth.store.ts`: orchestration (login/refresh/logout) + defensive driver-only checks
- `auth.guard.ts`: shared redirect helpers + driver-only token guard

## Important constraints

- Backend remains the source of truth for authorization.
- Frontend role checks are **defensive/UX-only** and must fail closed.
- Do not add server-only auth features here unless the deployment changes away from static export.
