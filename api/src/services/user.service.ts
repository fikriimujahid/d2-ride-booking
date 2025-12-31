import { prisma } from '../config/database';
import { AppError } from '../utils/error.util';
import { logger } from '../config/logger';
import { authService } from './auth.service';

export class UserService {

    async getProfile(userId: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    full_name: true,
                    phone_number: true,
                    role: true,
                    profile_photo_url: true,
                    rating: true,
                    created_at: true,
                    updated_at: true,
                    _count: {
                        select: {
                            rides_as_passenger: { where: { status: 'COMPLETED' } },
                            rides_as_driver: { where: { status: 'COMPLETED' } }
                        }
                    }
                }
            });

            if (!user) {
                throw new AppError('User not found', 404, 'USER_NOT_FOUND');
            }

            const total_rides = user.role === 'DRIVER'
                ? user._count.rides_as_driver
                : user._count.rides_as_passenger;

            // Remove _count from result before returning
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _count, ...userData } = user;

            return {
                user_id: user.id,
                ...userData,
                total_rides
            };

        } catch (error) {
            logger.error(`Error fetching profile for user ${userId}`, error);
            throw error;
        }
    }

    async updateProfile(userId: string, data: { full_name?: string; phone_number?: string; profile_photo_url?: string }) {
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    ...data,
                    updated_at: new Date()
                },
                select: {
                    id: true,
                    email: true,
                    full_name: true,
                    phone_number: true,
                    profile_photo_url: true,
                    updated_at: true
                }
            });

            if (data.full_name || data.phone_number) {
                await authService.updateUserAttributes(user.email, {
                    full_name: data.full_name,
                    phone_number: data.phone_number
                });
            }

            return {
                user_id: user.id,
                full_name: user.full_name,
                phone_number: user.phone_number,
                profile_photo_url: user.profile_photo_url,
                updated_at: user.updated_at
            };

        } catch (error) {
            logger.error(`Error updating profile for user ${userId}`, error);
            throw error;
        }
    }
}

export const userService = new UserService();
