import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { closeDbPool, createDbPool } from '../shared/db.js';

export const dbPlugin: FastifyPluginAsync = fp(async (app) => {
  const pool = createDbPool();
  app.decorate('db', pool);

  app.addHook('onClose', async () => {
    await closeDbPool(pool);
  });
});
