import { rideRepository } from '../repositories/ride.repository';
import { mapsService } from './maps.service';
import { matchingService } from './matching.service';
import { notificationService } from './notification.service';
import { CreateRideDto } from '../validators/ride.validator';

export class RideService {
    async createRide(userId: string, rideData: CreateRideDto) {
        // 1. Geocode addresses (Google Maps API)
        // Note: Zod schema provides coords, but we might want to verify address or vice versa
        // For now we trust the coordinates from frontend usually, but here we simulated geocoding
        // In the prompt example, it did both. We'll assume coords are provided.

        // 2. Calculate estimated fare
        const { distance, duration } = await mapsService.getDirections(
            rideData.pickup_location,
            rideData.dropoff_location
        );
        const estimatedFare = this.calculateFare(distance, duration);

        // 3. Create ride in database
        const ride = await rideRepository.createWithRelations({
            passenger: { connect: { id: userId } },
            pickup_latitude: rideData.pickup_location.latitude,
            pickup_longitude: rideData.pickup_location.longitude,
            pickup_address: rideData.pickup_location.address || "Unknown",
            dropoff_latitude: rideData.dropoff_location.latitude,
            dropoff_longitude: rideData.dropoff_location.longitude,
            dropoff_address: rideData.dropoff_location.address || "Unknown",
            estimated_distance_km: distance,
            estimated_duration_min: Math.ceil(duration),
            estimated_fare: estimatedFare,
            status: 'SEARCHING'
        });

        // 4. Find nearby drivers (matching algorithm)
        await matchingService.findDriversForRide(ride.id, rideData.pickup_location);

        // 5. Send notification to passenger
        await notificationService.sendRideRequestConfirmation(userId, ride.id);

        return ride;
    }

    private calculateFare(distance: number, duration: number): number {
        const BASE_FARE = 5.00;
        const PRICE_PER_KM = 1.50;
        const PRICE_PER_MINUTE = 0.25;

        return parseFloat((BASE_FARE + (distance * PRICE_PER_KM) + (duration * PRICE_PER_MINUTE)).toFixed(2));
    }
}

export const rideService = new RideService();
