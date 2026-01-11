import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  // Auth context is intentionally abstracted. In dev, we can use headers.
  AUTH_CONTEXT_MODE: z.enum(['headers', 'none']).default('headers')
});

export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.parse(env);

  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    authContextMode: parsed.AUTH_CONTEXT_MODE,
    port: parsed.PORT ? Number(parsed.PORT) : undefined
  };
}
