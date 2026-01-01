import { Router } from 'express';
import { authController } from '../../controllers/auth.controller';
import { rateLimiter } from '../../middleware/rate-limit.middleware';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { SYSTEM_ROLES } from '../../constants/roles';

const router = Router();

// Rate limit: 5 attempts per 15 mins for login
const authLimiter = rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

router.post('/signup',
    // Only SUPER_ADMIN can create admin users/roles
    authenticateJWT,
    requireRole(['SUPER_ADMIN']),
    (req, _res, next) => {
        // Role validation is enforced against DB Role.name in AuthService.
        // Default to ADMIN if no role provided.
        if (!req.body.role) req.body.role = SYSTEM_ROLES.ADMIN;
        next();
    },
    /* 
        #swagger.tags = ['Auth - Admin']
        #swagger.summary = 'Register a new admin'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Admin registration data',
            required: true,
            schema: {
                email: "admin@example.com",
                password: "Pass12345678!",
                full_name: "Admin User",
                phone_number: "+1123456789"
            }
        }
        #swagger.responses[201] = {
            description: 'Admin registered successfully'
        }
    */
    authController.signup.bind(authController)
);

router.post('/login',
    authLimiter,
    /* 
        #swagger.tags = ['Auth - Admin']
        #swagger.summary = 'Login admin'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Login credentials',
            required: true,
            schema: {
                email: "admin@example.com",
                password: "Pass12345678!"
            }
        }
        #swagger.responses[200] = {
            description: 'Login successful',
            schema: {
                success: true,
                data: {
                    access_token: "jwt_token",
                    id_token: "jwt_token",
                    refresh_token: "jwt_token",
                    expires_in: 3600,
                    token_type: "Bearer"
                }
            }
        }
    */
    authController.login.bind(authController)
);

router.post('/verify-email',
    /* 
        #swagger.tags = ['Auth - Admin']
        #swagger.summary = 'Verify email address'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Verification code',
            required: true,
            schema: {
                email: "admin@example.com",
                code: "123456"
            }
        }
        #swagger.responses[200] = {
            description: 'Email verified successfully'
        }
    */
    authController.verifyEmail.bind(authController)
);

router.post('/refresh',
    /* 
        #swagger.tags = ['Auth - Admin']
        #swagger.summary = 'Refresh Access Token'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Refresh Token',
            required: true,
            schema: {
                refresh_token: "jwt_token",
                email: "admin@example.com"
            }
        }
        #swagger.responses[200] = {
            description: 'Token refreshed successfully'
        }
    */
    authController.refreshToken.bind(authController)
);

router.post('/logout',
    authenticateJWT,
    /* 
        #swagger.tags = ['Auth - Admin']
        #swagger.summary = 'Logout admin'
        #swagger.responses[200] = {
            description: 'Logged out successfully'
        }
    */
    authController.logout.bind(authController)
);

export default router;
