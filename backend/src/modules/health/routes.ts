import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptimeSeconds: { type: 'number' }
            },
            required: ['status', 'uptimeSeconds']
          }
        }
      }
    },
    async () => {
    // Optional: a lightweight DB ping (kept simple for now)
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime())
    };
    }
  );
};
