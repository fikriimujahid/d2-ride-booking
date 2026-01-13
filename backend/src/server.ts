import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main() {
  const app = buildApp();

  const shutdown = async (signal: string) => {
    try {
      app.log.info({ signal }, 'shutting down');
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err, signal }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: env.host, port: env.port });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
