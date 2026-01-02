import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { env } from './env';

export const prisma = new PrismaClient({
	adapter: new PrismaMariaDb(env.DATABASE_URL)
});
