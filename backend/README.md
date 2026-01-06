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
