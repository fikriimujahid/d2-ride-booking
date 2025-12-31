import { logger } from "../config/logger";

export class NotificationService {
    async sendRideRequestConfirmation(userId: string, rideId: string) {
        logger.info(`Sending ride request confirmation to user ${userId} for ride ${rideId}`);
    }

    async sendDriverAssigned(userId: string, driverName: string) {
        logger.info(`Sending driver assigned notification to user ${userId}: ${driverName}`);
    }
}

export const notificationService = new NotificationService();
