import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),

  MATCH_OFFER_REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  // Auth context is intentionally abstracted. In dev, we can use headers.
  AUTH_CONTEXT_MODE: z.enum(['headers', 'none']).default('headers')
});

export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.parse(env);

  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    googleMapsApiKey: parsed.GOOGLE_MAPS_API_KEY,
    googleMapsTimeoutMs: parsed.GOOGLE_MAPS_TIMEOUT_MS,
    matchOfferReaperIntervalMs: parsed.MATCH_OFFER_REAPER_INTERVAL_MS,
    authContextMode: parsed.AUTH_CONTEXT_MODE,
    port: parsed.PORT ? Number(parsed.PORT) : undefined
  };
}
