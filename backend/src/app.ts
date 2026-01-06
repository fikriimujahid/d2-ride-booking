import express from 'express';

import { env } from './config/env';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      env: env.NODE_ENV,
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: `No route for ${req.method} ${req.path}`,
    });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      // Keep error responses minimal by default.
      // In production, avoid leaking internals.
      const message = err instanceof Error ? err.message : 'Unknown error';

      res.status(500).json({
        error: 'internal_server_error',
        message: env.NODE_ENV === 'production' ? 'Internal server error' : message,
      });
    },
  );

  return app;
}
