import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

export type NodeEnv = 'development' | 'test' | 'production';

type Env = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;

  corsOrigins: string | undefined;
  corsCredentials: boolean;

  databaseUrl: string | undefined;

  pgHost: string | undefined;
  pgPort: number | undefined;
  pgDatabase: string | undefined;
  pgUser: string | undefined;
  pgPassword: string | undefined;

  pgPoolMax: number;
  pgSsl: boolean;

  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;

  totpSetupTokenTtlSeconds: number;
  mfaChallengeTokenTtlSeconds: number;

  seedAdminEmail: string;
  seedAdminPassword: string;
  seedDriverEmail: string;
  seedDriverPassword: string;
  seedPassengerEmail: string;
  seedPassengerPassword: string;

  totpIssuer: string;
  totpEncryptionKeyBase64: string;
};

function parseNodeEnv(value: string | undefined): NodeEnv {
  switch (value) {
    case undefined:
    case 'development':
      return 'development';
    case 'test':
      return 'test';
    case 'production':
      return 'production';
    default:
      throw new Error(`Invalid NODE_ENV: ${value}`);
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function getJwtSecret(name: string, nodeEnv: NodeEnv): string {
  const configured = process.env[name];
  if (configured) return configured;
  if (nodeEnv === 'test') return `test-${name.toLowerCase()}`;
  return requireEnv(name);
}

function requireBase64Aes256Key(name: string, value: string): string {
  const buf = Buffer.from(value, 'base64');
  if (buf.length !== 32) {
    throw new Error(`Invalid ${name}: must be base64 for 32 bytes (AES-256 key)`);
  }
  return value;
}

function getTotpEncryptionKeyBase64(nodeEnv: NodeEnv): string {
  const configured = process.env.TOTP_ENCRYPTION_KEY_BASE64;
  if (configured) return requireBase64Aes256Key('TOTP_ENCRYPTION_KEY_BASE64', configured);
  if (nodeEnv === 'test') {
    // Deterministic key for test environment only.
    return crypto.createHash('sha256').update('TOTP_ENCRYPTION_KEY_BASE64:test').digest('base64');
  }
  return requireBase64Aes256Key('TOTP_ENCRYPTION_KEY_BASE64', requireEnv('TOTP_ENCRYPTION_KEY_BASE64'));
}

function parsePositiveInt(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: must be a positive integer`);
  }
  return n;
}

function parsePort(value: string | undefined): number {
  const port = parsePositiveInt('PORT', value ?? '3001');
  if (port > 65535) {
    throw new Error('Invalid PORT: must be <= 65535');
  }
  return port;
}

function optionalString(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertDbConfigIsPresent(currentEnv: Pick<Env, 'databaseUrl' | 'pgHost' | 'pgPort' | 'pgDatabase' | 'pgUser' | 'pgPassword'>): void {
  if (currentEnv.databaseUrl) return;

  const missing: string[] = [];
  if (!currentEnv.pgHost) missing.push('PGHOST');
  if (!currentEnv.pgPort) missing.push('PGPORT');
  if (!currentEnv.pgDatabase) missing.push('PGDATABASE');
  if (!currentEnv.pgUser) missing.push('PGUSER');
  if (!currentEnv.pgPassword) missing.push('PGPASSWORD');

  if (missing.length > 0) {
    throw new Error(`Database configuration missing. Set DATABASE_URL or: ${missing.join(', ')}`);
  }
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);

export const env: Readonly<Env> = {
  nodeEnv,
  host: process.env.HOST ?? '0.0.0.0',
  port: parsePort(process.env.PORT),

  corsOrigins: optionalString('CORS_ORIGINS'),
  corsCredentials: process.env.CORS_CREDENTIALS ? process.env.CORS_CREDENTIALS === 'true' : true,

  databaseUrl: process.env.DATABASE_URL,

  pgHost: process.env.PGHOST,
  pgPort: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  pgDatabase: process.env.PGDATABASE,
  pgUser: process.env.PGUSER,
  pgPassword: process.env.PGPASSWORD,

  pgPoolMax: process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : 10,
  pgSsl: process.env.PGSSL ? process.env.PGSSL === 'true' : false,

  jwtAccessSecret: getJwtSecret('JWT_ACCESS_SECRET', nodeEnv),
  jwtRefreshSecret: getJwtSecret('JWT_REFRESH_SECRET', nodeEnv),
  jwtAccessTtlSeconds: parsePositiveInt('JWT_ACCESS_TTL_SECONDS', process.env.JWT_ACCESS_TTL_SECONDS ?? '900'),
  jwtRefreshTtlSeconds: parsePositiveInt('JWT_REFRESH_TTL_SECONDS', process.env.JWT_REFRESH_TTL_SECONDS ?? '2592000'),

  totpSetupTokenTtlSeconds: parsePositiveInt('TOTP_SETUP_TOKEN_TTL_SECONDS', process.env.TOTP_SETUP_TOKEN_TTL_SECONDS ?? '600'),
  mfaChallengeTokenTtlSeconds: parsePositiveInt('MFA_CHALLENGE_TOKEN_TTL_SECONDS', process.env.MFA_CHALLENGE_TOKEN_TTL_SECONDS ?? '300'),

  // Seed defaults (used for Swagger examples and db:seed)
  seedAdminEmail: optionalString('SEED_ADMIN_EMAIL') ?? 'admin@example.com',
  seedAdminPassword: optionalString('SEED_ADMIN_PASSWORD') ?? 'ChangeMe123!',

  seedDriverEmail: optionalString('SEED_DRIVER_EMAIL') ?? 'driver@example.com',
  seedDriverPassword: optionalString('SEED_DRIVER_PASSWORD') ?? 'ChangeMe123!',

  seedPassengerEmail: optionalString('SEED_PASSENGER_EMAIL') ?? 'passenger@example.com',
  seedPassengerPassword: optionalString('SEED_PASSENGER_PASSWORD') ?? 'ChangeMe123!',

  totpIssuer: optionalString('TOTP_ISSUER') ?? 'D2 Ride Booking',
  totpEncryptionKeyBase64: getTotpEncryptionKeyBase64(nodeEnv)
};

if (env.nodeEnv !== 'test') {
  assertDbConfigIsPresent(env);
}

