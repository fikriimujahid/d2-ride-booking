# Backend (Node.js + Express + TypeScript)

## Local run

1. Install deps

```bash
cd backend
npm install
```

2. Create a `.env`

```bash
copy .env.example .env
```

If you want to use the database layer, set `DATABASE_URL` in `.env`.

3. Start dev server

```bash
npm run dev
```

Health check:
- `GET http://localhost:3000/health`

## Auth (JWT)

The API supports JWT verification via `Authorization: Bearer <token>`.

Roles:
- `admin`
- `driver`
- `passenger`

To verify auth end-to-end (non-business test endpoint):
- `GET http://localhost:3000/auth/whoami` (requires a valid token)

Required token claims:
- `sub` (user id)
- `role` (one of the roles above)

Env:
- `JWT_SECRET` (required to verify JWTs)
- `JWT_ISSUER` (optional)
- `JWT_AUDIENCE` (optional)

## Database

Migrations are plain `.sql` files in `db/migrations`, applied in filename order.

If you see `The server does not support SSL connections`, set `DB_SSL=false` in `.env` (and remove `sslmode=require` from `DATABASE_URL` if present).

- Run migrations: `npm run db:migrate`
- Run example raw query: `npm run db:example`

## Scripts

- `npm run dev` - run with file watch
- `npm run build` - compile to `dist/`
- `npm start` - run compiled server
- `npm run lint` - eslint
- `npm run format` - prettier
- `npm run typecheck` - TypeScript typecheck

## E2E auth test

Runs a self-contained script that boots the API on a random port, then checks:
- `/health` returns 200
- `/auth/whoami` returns 401 without a token
- `/auth/whoami` returns 200 with a valid JWT

Command:
- `npm run test:e2e:auth`
