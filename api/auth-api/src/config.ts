import { z } from 'zod';

function normalizePem(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  // dotenv commonly stores multiline PEM as a single line with literal \n sequences
  return unquoted.replace(/\\n/g, '\n');
}

const EnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  JWT_ISSUER: z.string().min(1),
  JWT_AUD_ADMIN: z.string().min(1),
  JWT_AUD_DRIVER: z.string().min(1),
  JWT_AUD_PASSENGER: z.string().min(1),

  JWT_ALG: z.enum(['EdDSA', 'RS256', 'HS256']).default('EdDSA'),
  JWT_KEY_ID: z.string().min(1).default('auth-1'),
  JWT_PRIVATE_KEY_PEM: z.string().optional(),
  JWT_PUBLIC_KEY_PEM: z.string().optional(),
  JWT_SECRET: z.string().optional(),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MFA_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ENROLL_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  ADMIN_WEB_ORIGINS: z.string().optional(),

  TOTP_ENC_KEY_BASE64: z.string().min(1)
});

export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.parse(env);
  const adminWebOrigins = (parsed.ADMIN_WEB_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    jwt: {
      issuer: parsed.JWT_ISSUER,
      aud: {
        admin: parsed.JWT_AUD_ADMIN,
        driver: parsed.JWT_AUD_DRIVER,
        passenger: parsed.JWT_AUD_PASSENGER
      },
      alg: parsed.JWT_ALG,
      kid: parsed.JWT_KEY_ID,
      privateKeyPem: normalizePem(parsed.JWT_PRIVATE_KEY_PEM),
      publicKeyPem: normalizePem(parsed.JWT_PUBLIC_KEY_PEM),
      secret: parsed.JWT_SECRET,
      accessTtlSeconds: parsed.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS,
      mfaTtlSeconds: parsed.MFA_TOKEN_TTL_SECONDS,
      enrollTtlSeconds: parsed.ENROLL_TOKEN_TTL_SECONDS
    },
    adminWebOrigins,
    totpEncKeyBase64: parsed.TOTP_ENC_KEY_BASE64
  };
}
