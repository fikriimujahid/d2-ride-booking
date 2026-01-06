import http from 'node:http';

import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);

  server.close((err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
