import Fastify, { type FastifyInstance } from 'fastify';

import './config/env.js';
import { env } from './config/env.js';
import { dbPlugin } from './plugins/db.js';
import { corsPlugin } from './plugins/cors.js';
import { apiDbLoggerPlugin } from './plugins/api-db-logger.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';

export type BuildAppOptions = {
  logger?: boolean;
};

const API_PREFIX = '/api/v1';

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: opts.logger ?? env.nodeEnv !== 'test',
    ajv: {
      plugins: [
        (ajvInstance: unknown) => {
          const hasAddKeyword = (value: unknown): value is { addKeyword: (definition: { keyword: string }) => void } => {
            return (
              typeof value === 'object' &&
              value !== null &&
              typeof (value as { addKeyword?: unknown }).addKeyword === 'function'
            );
          };

          if (!hasAddKeyword(ajvInstance)) return;

          // OpenAPI/Swagger metadata keyword that Ajv doesn't validate.
          // Allow it so validation schema compilation doesn't fail.
          try {
            ajvInstance.addKeyword({ keyword: 'example' });
          } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (!message.includes('already defined')) {
              throw err;
            }
          }
        }
      ]
    }
  });

  // Cross-cutting plugins
  void app.register(corsPlugin);
  void app.register(dbPlugin);
  void app.register(apiDbLoggerPlugin);
  void app.register(swaggerPlugin);
  void app.register(errorHandlerPlugin);

  // Feature modules
  void app.register(healthRoutes, { prefix: API_PREFIX });
  void app.register(authRoutes, { prefix: API_PREFIX });

  return app;
}

