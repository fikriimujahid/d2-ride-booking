import fp from 'fastify-plugin';
import cors from '@fastify/cors';

import { env } from '../config/env.js';

function parseOriginsCsv(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const corsPlugin = fp(async (app) => {
  const configuredOrigins = env.corsOrigins ? parseOriginsCsv(env.corsOrigins) : null;
  const isProd = env.nodeEnv === 'production';

  await app.register(cors, {
    // If request has no Origin header (curl/server-to-server), allow it.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      // Dev/test: allow all origins (frontend ports vary, and CORS is not a security boundary).
      if (!isProd) return cb(null, true);

      // Prod: require explicit allowlist.
      if (!configuredOrigins || configuredOrigins.length === 0) return cb(null, false);
      return cb(null, configuredOrigins.includes(origin));
    },
    credentials: env.corsCredentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});
