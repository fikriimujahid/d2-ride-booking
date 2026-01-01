import { Request, Response, NextFunction } from 'express';
import { rideService } from '../services/ride.service';
import { successResponse } from '../utils/response.util';

export class RideController {
    async createRide(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;  // From auth middleware
            const rideData = req.body;   // Already validated by Zod

            const ride = await rideService.createRide(userId, rideData);

            return successResponse(res, ride, 'Ride requested successfully', 201);
        } catch (error) {
            return next(error);  // Pass to error middleware
        }
    }
}

export const rideController = new RideController();
