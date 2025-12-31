import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/error.util';
import { Prisma } from '@prisma/client';

export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    // Log error
    logger.error('API Error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        // @ts-ignore
        user_id: req.user?.id
    });

    // Handle custom app errors
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.errorCode,
                message: error.message,
                details: error.details
            },
            timestamp: new Date().toISOString(),
            // @ts-ignore
            request_id: req.id
        });
    }

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {  // Unique constraint violation
            return res.status(409).json({
                success: false,
                error: {
                    code: 'DUPLICATE_RESOURCE',
                    message: 'Resource already exists'
                }
            });
        }
    }

    // Handle unknown errors (500)
    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred'
        }
    });
}
