import { calculateDistance } from "../utils/geocoding.util";

export class MapsService {
    async geocode(address: string): Promise<{ latitude: number; longitude: number }> {
        // Mock implementation for portfolio
        console.log(`Geocoding address: ${address}`);
        return {
            latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
            longitude: -122.4194 + (Math.random() - 0.5) * 0.1
        };
    }

    async getDirections(origin: { latitude: number; longitude: number }, dest: { latitude: number; longitude: number }): Promise<{ distance: number; duration: number }> {
        // Mock implementation
        const distance = calculateDistance(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
        const speedKmH = 30; // Average speed
        const duration = (distance / speedKmH) * 60; // Minutes

        return {
            distance: parseFloat(distance.toFixed(1)),
            duration: Math.ceil(duration)
        };
    }
}

export const mapsService = new MapsService();
