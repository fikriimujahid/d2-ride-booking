import { Router } from 'express';
import { authController } from '../../controllers/auth.controller';
import { rateLimiter } from '../../middleware/rate-limit.middleware';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { Permissions } from '../../config/rbac.config';
import { SYSTEM_ROLES } from '../../constants/roles';

const router = Router();

// Rate limit: 5 attempts per 15 mins for login
const authLimiter = rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

router.post('/signup',
    // Driver accounts must be created by privileged users (not public signup)
    authenticateJWT,
    requirePermission(Permissions.MANAGE_USERS),
    (req, _res, next) => {
        req.body.role = SYSTEM_ROLES.DRIVER;
        next();
    },
    /* 
        #swagger.tags = ['Auth - Driver']
        #swagger.summary = 'Register a new driver'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Driver registration data',
            required: true,
            schema: {
                email: "driver@example.com",
                password: "Pass12345678!",
                full_name: "Jane Driver",
                phone_number: "+1987654321"
            }
        }
        #swagger.responses[201] = {
            description: 'Driver registered successfully'
        }
    */
    authController.signup.bind(authController)
);

router.post('/login',
    authLimiter,
    /* 
        #swagger.tags = ['Auth - Driver']
        #swagger.summary = 'Login driver'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Login credentials',
            required: true,
            schema: {
                email: "driver@example.com",
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
        #swagger.tags = ['Auth - Driver']
        #swagger.summary = 'Verify email address'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Verification code',
            required: true,
            schema: {
                email: "driver@example.com",
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
        #swagger.tags = ['Auth - Driver']
        #swagger.summary = 'Refresh Access Token'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Refresh Token',
            required: true,
            schema: {
                refresh_token: "jwt_token",
                email: "driver@example.com"
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
        #swagger.tags = ['Auth - Driver']
        #swagger.summary = 'Logout driver'
        #swagger.responses[200] = {
            description: 'Logged out successfully'
        }
    */
    authController.logout.bind(authController)
);

export default router;
