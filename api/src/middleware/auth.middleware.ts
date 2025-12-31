import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/error.util';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
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
        req.user = {
            id: payload.sub,
            email: payload['email'], // Cognito specific
            role: payload['custom:role'] || 'passenger'
        };

        next();  // Proceed to next middleware
    } catch (error) {
        next(new UnauthorizedError('Invalid or expired token'));
    }
}
