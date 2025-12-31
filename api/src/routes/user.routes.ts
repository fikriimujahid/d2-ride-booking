import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all user routes
router.use(authenticateJWT);

router.get('/me',
    /* 
        #swagger.tags = ['User']
        #swagger.summary = 'Get current user profile'
        #swagger.responses[200] = {
            description: 'User profile retrieved successfully',
            schema: {
                success: true,
                data: {
                    user_id: "user-uuid",
                    email: "user@example.com",
                    full_name: "John Doe",
                    phone_number: "+1234567890",
                    role: "passenger",
                    profile_photo_url: "url",
                    rating: 4.8,
                    created_at: "2025-01-01T00:00:00Z"
                }
            }
        }
    */
    userController.getMe.bind(userController)
);

router.patch('/me',
    /* 
        #swagger.tags = ['User']
        #swagger.summary = 'Update user profile'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Profile update data',
            required: true,
            schema: {
                full_name: "John Doe",
                phone_number: "+1234567890",
                profile_photo_url: "https://example.com/photo.jpg"
            }
        }
        #swagger.responses[200] = {
            description: 'Profile updated successfully'
        }
    */
    userController.updateMe.bind(userController)
);

export default router;
