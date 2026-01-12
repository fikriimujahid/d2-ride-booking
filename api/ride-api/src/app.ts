import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig } from './config.js';
import { createDbPool } from './db/pool.js';
import { createRedisClient } from './redis/client.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerCors } from './plugins/cors.js';
import { registerAuthContext } from './plugins/authContext.js';
import { registerPassengerRoutes } from './modules/passenger/routes.js';
import { registerDriverRoutes } from './modules/driver/routes.js';
import { registerRideRoutes } from './modules/ride/routes.js';
import { startOfferReaper } from './modules/matching/offerReaper.js';

type AjvLike = {
  addKeyword(name: string): void;
};

function getErrorStatusCode(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return 500;
}

function getErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return 'INTERNAL_ERROR';
}

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig(process.env);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true
      }
    },
    ajv: {
      plugins: [
        (ajv: unknown) => {
          (ajv as AjvLike).addKeyword('example');
          return ajv as AjvLike;
        }
      ]
    }
  });

  app.decorate('config', config);
  app.decorate('db', createDbPool(config.databaseUrl));
  app.decorate('redis', await createRedisClient(config.redisUrl));

  app.addHook('onClose', async (instance) => {
    try {
      await instance.redis.quit();
    } catch {
      // ignore close errors
    }
  });

  await registerCors(app);
  await registerSwagger(app);
  await registerAuthContext(app);

  app.get('/health', async () => ({ ok: true }));

  app.get('/ready', async () => {
    const result = await app.db.query('select 1 as ok');
    return { ok: result.rows?.[0]?.ok === 1 };
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request error');
    const statusCode = getErrorStatusCode(err);
    const message = err instanceof Error ? err.message : 'Error';
    reply.status(statusCode).send({
      error: getErrorCode(err),
      message: statusCode >= 500 ? 'Internal error' : message
    });
  });

  await registerPassengerRoutes(app);
  await registerDriverRoutes(app);
  await registerRideRoutes(app);

  startOfferReaper(app, config.matchOfferReaperIntervalMs);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof loadConfig>;
    db: ReturnType<typeof createDbPool>;
    redis: Awaited<ReturnType<typeof createRedisClient>>;
  }
}
