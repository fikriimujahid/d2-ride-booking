import { prisma } from '../config/database';
import { Ride, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class RideRepository extends BaseRepository<Ride> {
    constructor() {
        super(prisma, 'ride');
    }

    // Override create to include relations if needed or add custom methods
    async createWithRelations(data: Prisma.RideCreateInput): Promise<Ride> {
        return prisma.ride.create({
            data,
            include: {
                passenger: { select: { id: true, full_name: true, phone_number: true } },
                driver: { select: { id: true, full_name: true, vehicle: true } }
            }
        });
    }

    async updateStatus(id: string, status: any): Promise<Ride> {
        return prisma.ride.update({
            where: { id },
            data: { status }
        });
    }
}

export const rideRepository = new RideRepository();
