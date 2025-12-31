import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { successResponse } from '../utils/response.util';
import { z } from 'zod';

const updateProfileSchema = z.object({
    full_name: z.string().min(2).optional(),
    phone_number: z.string().min(10).optional(),
    profile_photo_url: z.string().url().optional()
});

export class UserController {

    async getMe(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const result = await userService.getProfile(userId);
            return successResponse(res, result, 'User profile retrieved successfully');
        } catch (error) {
            return next(error);
        }
    }

    async updateMe(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const data = updateProfileSchema.parse(req.body);
            const result = await userService.updateProfile(userId, data);
            return successResponse(res, result, 'Profile updated successfully');
        } catch (error) {
            return next(error);
        }
    }
}

export const userController = new UserController();
