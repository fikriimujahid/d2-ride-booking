import { Router } from 'express';
import { rideController } from '../controllers/ride.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRideSchema } from '../validators/ride.validator';
import { rateLimiter } from '../middleware/rate-limit.middleware';
import { SYSTEM_ROLES } from '../constants/roles';

const router = Router();

router.post(
    '/', // Mounted at /rides in index.ts
    rateLimiter({ max: 10, windowMs: 60000 }),  // 10 requests per minute
    authenticateJWT,                             // Verify JWT token
    requireRole([SYSTEM_ROLES.PASSENGER]),       // Only passengers can request rides
    validate(createRideSchema),                  // Validate request body
    rideController.createRide                    // Handle request
);

export default router;
