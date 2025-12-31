// Mock Redis client for now as we didn't install redis package yet
// In real app, import Redis from 'ioredis'

export const redisClient = {
    get: async (_key: string) => null,
    set: async (_key: string, _val: string, _mode?: string, _duration?: number) => "OK",
    incr: async (_key: string) => 1,
    expire: async (_key: string, _sec: number) => 1
};
