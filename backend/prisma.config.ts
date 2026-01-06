import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  // Prisma CLI (migrate/db/studio) reads connection URL from here in Prisma ORM v7+
  // Use process.env directly so commands like `prisma generate` don't fail if DATABASE_URL is missing.
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
