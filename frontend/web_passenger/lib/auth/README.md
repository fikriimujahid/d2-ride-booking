# Web Passenger Auth (Reference)

This folder contains **authentication + session plumbing** for `web_passenger`.

Design goals (refactor-only):
- Keep the v0-generated UI unchanged.
- Keep backend API contracts unchanged.
- Make auth flow easy to follow by separating layers:
  - `auth.api.ts` (talks to our Next route handlers)
  - `auth.service.ts` (orchestrates login/logout/redirect decisions)
  - `auth.store.ts` (client-side session view + helpers)
  - `guards.ts` (route protection helpers)

Important:
- Backend remains the source of truth for authorization (role/permissions).
- Frontend checks are **UX-only** and must fail-closed.
