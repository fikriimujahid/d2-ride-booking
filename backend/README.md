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
