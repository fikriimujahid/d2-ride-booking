import "express";

declare module "express" {
    interface Request {
        user?: {
            id: string;
            email: string;
            system_role: string;
            roles: string[];
            permissions: string[];
        };
    }
}
