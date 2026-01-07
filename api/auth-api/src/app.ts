import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig } from './config.js';
import { createDbPool } from './db/pool.js';
import { createJwtService } from './auth/jwt.js';
import { registerAdminAuthRoutes } from './auth/routes/admin.js';
import { registerDriverAuthRoutes } from './auth/routes/driver.js';
import { registerPassengerAuthRoutes } from './auth/routes/passenger.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig(process.env);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.refreshToken',
          'req.body.code',
          'req.body.mfaToken',
          'req.body.enrollToken'
        ],
        remove: true
      }
    },
    ajv: {
      plugins: [
        (ajv: any) => {
          // Allow OpenAPI-friendly keywords in route schemas without relaxing strict validation.
          // Fastify uses AJV for validation, and `example` is not a JSON-Schema keyword.
          ajv.addKeyword('example');
          return ajv;
        }
      ]
    }
  });

  app.decorate('config', config);
  app.decorate('db', createDbPool(config.databaseUrl));
  app.decorate('jwt', createJwtService(config.jwt));

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Auth API',
        version: '0.1.0'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  app.get('/openapi.json', async () => app.swagger());

  app.get('/health', async () => ({ ok: true }));

  app.get('/ready', async () => {
    const result = await app.db.query('select 1 as ok');
    return { ok: result.rows?.[0]?.ok === 1 };
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request error');
    const statusCode = typeof (err as any).statusCode === 'number' ? (err as any).statusCode : 500;
    const message = err instanceof Error ? err.message : 'Error';
    reply.status(statusCode).send({
      error: 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal error' : message
    });
  });

  // Validate that requests are JSON where expected
  app.addHook('preValidation', async (req) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        // allow empty body
        if (req.body !== undefined) {
          throw Object.assign(new Error('Unsupported content-type'), { statusCode: 415 });
        }
      }
    }
  });

  await registerAdminAuthRoutes(app);
  await registerDriverAuthRoutes(app);
  await registerPassengerAuthRoutes(app);

  // Example protected route shape (kept minimal)
  app.get('/whoami', async (req, reply) => {
    return reply.status(501).send({ error: 'NOT_IMPLEMENTED' });
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof loadConfig>;
    db: ReturnType<typeof createDbPool>;
    jwt: ReturnType<typeof createJwtService>;
  }
}
