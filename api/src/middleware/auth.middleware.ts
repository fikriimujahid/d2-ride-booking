import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/error.util';
import { prisma } from '../config/database';

// Extend Express Request type
interface UserPayload {
    id: string;
    email: string;
    system_role: string;
    roles: string[];
    permissions: string[];
}

// Extend Express Request type locally for this module
interface AuthenticatedRequest extends Request {
    user?: UserPayload;
}

export async function authenticateJWT(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('Missing or invalid authorization header');
        }

        const token = authHeader.substring(7);  // Remove "Bearer "
        const payload = await verifyJWT(token);

        // Fetch user from DB to get granular role and permissions
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw new UnauthorizedError('User not found in system');
        }

        // Flatten permissions and roles
        const permissions = new Set<string>();
        const roles = new Set<string>();

        user.roles.forEach(ur => {
            roles.add(ur.role.name);
            ur.role.permissions.forEach(rp => {
                permissions.add(rp.permission.key);
            });
        });

        // Attach user info to request object
        (req as AuthenticatedRequest).user = {
            id: payload.sub,
            email: payload['email'] as string, // Cognito specific
            system_role: user.system_role,
            roles: Array.from(roles),
            permissions: Array.from(permissions)
        };

        next();  // Proceed to next middleware
    } catch {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}
