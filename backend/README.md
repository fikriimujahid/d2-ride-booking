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
