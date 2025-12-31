import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { rateLimiter } from '../middleware/rate-limit.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Rate limit: 5 attempts per 15 mins for login
const authLimiter = rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

router.post('/signup',
    /* 
        #swagger.tags = ['Auth']
        #swagger.summary = 'Register a new user'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'User registration data',
            required: true,
            schema: {
                email: "user@example.com",
                password: "Pass12345678!", // pragma: allowlist secret
                full_name: "John Doe",
                phone_number: "+1234567890",
                role: "PASSENGER"
            }
        }
        #swagger.responses[201] = {
            description: 'User registered successfully'
        }
    */
    authController.signup.bind(authController)
);

router.post('/login',
    authLimiter,
    /* 
        #swagger.tags = ['Auth']
        #swagger.summary = 'Login user'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Login credentials',
            required: true,
            schema: {
                email: "user@example.com",
                password: "Pass12345678!" // pragma: allowlist secret
            }
        }
        #swagger.responses[200] = {
            description: 'Login successful',
            schema: {
                success: true,
                data: {
                    access_token: "jwt_token", // pragma: allowlist secret
                    id_token: "jwt_token",
                    refresh_token: "jwt_token", // pragma: allowlist secret
                    expires_in: 3600,
                    token_type: "Bearer" // pragma: allowlist secret
                }
            }
        }
    */
    authController.login.bind(authController)
);

router.post('/verify-email',
    /* 
        #swagger.tags = ['Auth']
        #swagger.summary = 'Verify email address'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Verification code',
            required: true,
            schema: {
                email: "user@example.com",
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
        #swagger.tags = ['Auth']
        #swagger.summary = 'Refresh Access Token'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Refresh Token',
            required: true,
            schema: {
                refresh_token: "jwt_token", // pragma: allowlist secret
                email: "user@example.com"
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
        #swagger.tags = ['Auth']
        #swagger.summary = 'Logout user'
        #swagger.responses[200] = {
            description: 'Logged out successfully'
        }
    */
    authController.logout.bind(authController)
);

export default router;
