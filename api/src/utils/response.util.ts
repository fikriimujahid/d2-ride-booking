import { Response } from 'express';

export function successResponse(
    res: Response,
    data: any,
    message = 'Success',
    statusCode = 200
) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
}

export function paginatedResponse(
    res: Response,
    data: any[],
    page: number,
    limit: number,
    totalItems: number
) {
    return res.status(200).json({
        success: true,
        data,
        pagination: {
            page,
            limit,
            total_items: totalItems,
            total_pages: Math.ceil(totalItems / limit),
            has_next: page * limit < totalItems,
            has_prev: page > 1
        }
    });
}
