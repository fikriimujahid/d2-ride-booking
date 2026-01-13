import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../config/env.js';

export type SwaggerPluginOptions = {
  enabled?: boolean;
};

export const swaggerPlugin = fp<SwaggerPluginOptions>(async (app, opts) => {
  const enabled = opts.enabled ?? env.nodeEnv !== 'production';
  if (!enabled) return;

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'D2 Ride Booking API',
        version: '0.1.0'
      },
      servers: [
        {
          url: '/'
        }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    staticCSP: true
  });

  // Expose raw spec for tooling
  app.get('/openapi.json', async () => app.swagger());
});
