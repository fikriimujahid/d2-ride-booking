import { createClient, type RedisClientType } from 'redis';

export async function createRedisClient(redisUrl: string): Promise<RedisClientType> {
  const client: RedisClientType = createClient({ url: redisUrl });

  client.on('error', (err) => {
    // Fastify logger isn't available here; callers should add context.
    // This keeps the process from crashing on transient redis errors.
    // eslint-disable-next-line no-console
    console.error('redis error', err);
  });

  await client.connect();
  return client;
}
