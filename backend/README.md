# Backend (NestJS)

Production-ready NestJS skeleton with a security baseline, Swagger, and a health endpoint.

## Prerequisites

- Node.js (LTS recommended)

## Install

```bash
npm install
```

## Run (dev)

```bash
npm run start:dev
```

The server listens on `PORT` (default: `3000`).

## Health Check

- `GET /health` → `{ "status": "ok" }`

## Swagger

- Swagger UI: `http://localhost:3000/api`
- OpenAPI JSON: `http://localhost:3000/api-json`

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

## Auth (AWS Cognito, no Hosted UI)

This backend supports username/password authentication against an AWS Cognito User Pool via API calls (no Hosted UI).

### Required env vars

- `AWS_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET` (optional; only if the app client has a secret)
- `COGNITO_USE_ADMIN_AUTH` (optional; set to `true` to use `AdminInitiateAuth`)

### Login flow

1) Login

`POST /auth/login`

- If successful, returns `{ status: "SUCCESS", accessToken, idToken?, refreshToken? }`
- If a challenge is required, returns `{ status: "CHALLENGE", challengeName, session, challengeParameters? }`

Supported challenge names include:

- `NEW_PASSWORD_REQUIRED`
- `MFA_SETUP`
- `SOFTWARE_TOKEN_MFA`

2) Respond to challenge

`POST /auth/respond-challenge`

Provide `username`, `challengeName`, `session`, and `challengeResponses`.

Examples:

- `NEW_PASSWORD_REQUIRED`: include `NEW_PASSWORD`
- `SOFTWARE_TOKEN_MFA`: include the MFA code in the appropriate Cognito challenge response key

For `MFA_SETUP`, this project supports a two-step helper through the same endpoint:

- First call with `mfaSetup.action=ASSOCIATE` to receive a TOTP `secretCode`
- Then call with `mfaSetup.action=VERIFY` and `mfaSetup.code` to finish setup

3) Verify access token

`GET /auth/whoami` requires `Authorization: Bearer <accessToken>` and returns the validated JWT claims.

## Database (PostgreSQL + Prisma)

This repo includes a Postgres container in the root `docker-compose.yml`.

Start Postgres:

```bash
docker compose up -d postgres
```

### Migrations

Create/apply the initial migration (dev):

```bash
npm run db:migrate
```

Apply existing migrations (prod-like):

```bash
npm run db:migrate:deploy
```

### Seed

Seed RBAC roles/permissions:

```bash
npm run db:seed
```

Optional: bootstrap a SUPER_ADMIN user in both Cognito + Postgres by setting `SUPER_ADMIN_EMAIL` (and optionally `SUPER_ADMIN_PASSWORD`) before running the seed.

Provision demo users in BOTH Cognito and Postgres (temporary passwords, force password change):

```bash
npm run seed:demo-users
```

This creates:

- `superadmin@example.com` → Cognito Group `Admin`
- `driver1@example.com` → Cognito Group `Driver`
- `passenger1@example.com` → Cognito Group `Passenger`
