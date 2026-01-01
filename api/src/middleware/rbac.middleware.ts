
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/error.util';
import { Permission, Permissions } from '../config/rbac.config';

type UserPayload = NonNullable<Request['user']>;

export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = req.user as UserPayload | undefined;

        if (!user) {
            return next(new UnauthorizedError('User not authenticated'));
        }

        // Check System Role (Layer 1) or Fine-Grained Role (Layer 2)
        const hasRole = allowedRoles.includes(user.system_role) ||
            user.roles.some(r => allowedRoles.includes(r));

        if (!hasRole) {
            return next(new ForbiddenError('Insufficient permissions'));
        }

        next();
    };
};

export const requirePermission = (requiredPermission: Permission) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = req.user as UserPayload | undefined;

        if (!user) {
            return next(new UnauthorizedError('User not authenticated'));
        }

        // Check for exact permission or ALL_ACCESS
        if (user.permissions.includes(Permissions.ALL_ACCESS) || user.permissions.includes(requiredPermission)) {
            return next();
        }

        return next(new ForbiddenError(`Missing permission: ${requiredPermission} `));
    };
};
