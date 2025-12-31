import { z } from 'zod';

const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().min(5).max(200).optional()
});

export const createRideSchema = z.object({
    pickup_location: locationSchema,
    dropoff_location: locationSchema,
    ride_type: z.enum(['standard', 'premium', 'xl']),
    notes: z.string().max(500).optional()
});

export type CreateRideDto = z.infer<typeof createRideSchema>;
