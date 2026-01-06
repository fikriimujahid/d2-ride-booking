import { env } from './env';

export type DbConfig = {
  connectionString: string;
  ssl: boolean;
};

export function getDbConfig(): DbConfig {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Provide it in .env (see .env.example) before using the database layer.',
    );
  }

  return {
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL,
  };
}
