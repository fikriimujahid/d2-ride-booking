import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/error.util';

// Extend Express Request type
interface UserPayload {
    id: string;
    email: string;
    role: string;
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

        // Attach user info to request object
        (req as AuthenticatedRequest).user = {
            id: payload.sub,
            email: payload['email'] as string, // Cognito specific
            role: (payload['custom:role'] || 'passenger') as string
        };

        next();  // Proceed to next middleware
    } catch {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}
