import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/error.util';

export function requireRole(role: string) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user || req.user.role !== role) {
            // Allow if admin? Maybe
            if (req.user?.role === 'admin') {
                return next();
            }
            return next(new ForbiddenError('Insufficient permissions'));
        }
        next();
    };
}
