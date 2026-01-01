import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { successResponse } from '../utils/response.util';
import { z } from 'zod';
import { PRIVILEGED_SYSTEM_ROLES, type PrivilegedSystemRoleName } from '../constants/roles';
import { ForbiddenError } from '../utils/error.util';

function isPrivilegedSystemRole(role: string): role is PrivilegedSystemRoleName {
    return (PRIVILEGED_SYSTEM_ROLES as readonly string[]).includes(role);
}

// Validation Schemas (Could move to validator file)
const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    full_name: z.string().min(2),
    phone_number: z.string().min(10),
    // Role comes from DB (Role.name). Validation happens in AuthService.
    role: z.string().min(1)
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const verifyEmailSchema = z.object({
    email: z.string().email(),
    code: z.string().length(6)
});

const refreshTokenSchema = z.object({
    refresh_token: z.string(),
    email: z.string().email().optional() // Make optional but logic might fail if secret hash is needed and email not provided
});

export class AuthController {

    async signup(req: Request, res: Response, next: NextFunction) {
        try {
            // Manual validation call since we defined schema here for simplicity, 
            // or rely on route middleware if we move schema.
            const data = signupSchema.parse(req.body);

            // Safety net: even if routes change, never allow anonymous signup for privileged system roles.
            const isPublicRequest = !req.user;
            if (isPublicRequest && isPrivilegedSystemRole(data.role)) {
                return next(new ForbiddenError('Public signup for this role is not allowed'));
            }

            const result = await authService.signup(data, { isPublicRequest });
            return successResponse(res, result, 'User registered successfully', 201);
        } catch (error) {
            return next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = loginSchema.parse(req.body);
            const result = await authService.login(email, password);
            return successResponse(res, result, 'Login successful');
        } catch (error) {
            return next(error);
        }
    }

    async verifyEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, code } = verifyEmailSchema.parse(req.body);
            const result = await authService.verifyEmail(email, code);
            return successResponse(res, result, 'Email verified successfully');
        } catch (error) {
            return next(error);
        }
    }

    async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            const { refresh_token, email } = refreshTokenSchema.parse(req.body);
            // If email is missing, we might need it for secret hash.
            // If the client doesn't send it, we have a problem if secret is enabled.
            // For now, we pass it. If undefined, authService might error or use undefined which fails calculation.
            // Let's assume we can get it or fail.
            if (!email) {
                // If email is not provided, we can't calculate secret hash.
                // We should probably throw an error if we know strict mode is on.
                // Or maybe we can proceed without it if secret is disabled.
                // But auth.service definitely uses it.
                // We'll throw detailed error for now.
                throw new z.ZodError([{
                    code: 'custom',
                    path: ['email'],
                    message: 'Email is required for refresh token flow with secret hash'
                }]);
            }

            const result = await authService.refreshToken(refresh_token, email);
            return successResponse(res, result, 'Token refreshed successfully');
        } catch (error) {
            return next(error);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // Should be handled by middleware usually, but logout might be called differently?
                // Actually logout endpoint is Authenticated, so middleware runs first.
                // So we can assume header exists.
            }
            // Middleware strips 'Bearer ', but we need to get it again or rely on middleware putting it somewhere?
            // Middleware puts payload in req.user. It doesn't put raw token in req.
            // So we grab it from header again.
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) throw new Error("No token found");

            const result = await authService.logout(token);
            return successResponse(res, result, 'Logged out successfully');
        } catch (error) {
            return next(error);
        }
    }
}

export const authController = new AuthController();
