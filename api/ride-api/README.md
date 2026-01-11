# Ride API

Core domain API for Passenger / Driver / Ride.

## Dev

- Required env: `DATABASE_URL`
- Optional: `PORT` (default 3001)
- Dev auth mode: `AUTH_CONTEXT_MODE=headers` and pass identity via headers:
  - `X-Auth-Sub`: UUID string for subject
  - `X-Auth-Role`: passenger|driver|admin|system
  - `X-Auth-Scopes`: comma-separated scopes (optional)

### Run

- `npm install`
- `npm run migrate:dev`
- `npm run dev`

### Docs

- Swagger UI: `GET /docs`
- JSON: `GET /openapi.json`
- Contract file: `docs/openapi.yaml`
- Authz matrix: `docs/authz-matrix.md`
