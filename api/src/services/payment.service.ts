import { logger } from "../config/logger";

export class PaymentService {
    async createPayment(rideId: string, amount: number) {
        logger.info(`Creating payment intent for ride ${rideId} amount ${amount}`);
        // Mock Stripe interaction
    }
}

export const paymentService = new PaymentService();
