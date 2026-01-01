import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/error.util';

export function validate(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            const validated = schema.parse(req.body);
            req.body = validated;  // Replace with validated/sanitized data
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                next(new ValidationError(error.issues));
            } else {
                next(error);
            }
        }
    };
}
