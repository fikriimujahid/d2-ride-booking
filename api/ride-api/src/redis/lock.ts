import type { RedisClientType } from 'redis';
import crypto from 'node:crypto';

const RELEASE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export type RedisLock = {
  key: string;
  token: string;
  release(): Promise<boolean>;
};

export async function tryAcquireLock(
  redis: RedisClientType,
  key: string,
  ttlMs: number
): Promise<RedisLock | null> {
  const token = crypto.randomUUID();
  const ok = await redis.set(key, token, { NX: true, PX: ttlMs });
  if (ok !== 'OK') return null;

  return {
    key,
    token,
    release: async () => {
      const res = await redis.eval(RELEASE_LUA, {
        keys: [key],
        arguments: [token]
      });
      return Number(res) > 0;
    }
  };
}
