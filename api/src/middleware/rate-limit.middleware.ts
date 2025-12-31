import { Request, Response, NextFunction } from 'express';
// import { redisClient } from '../config/redis';

export function rateLimiter(_options: { max: number; windowMs: number }) {
    return async (_req: Request, _res: Response, next: NextFunction) => {
        // Basic in-memory placeholder or no-op
        // Proper implementation would use Redis to count requests by IP/User
        next();
    };
}
