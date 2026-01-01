import type { Request, Response, NextFunction } from 'express';

import { requirePermission, requireRole } from '../../../src/middleware/rbac.middleware';
import { Permissions } from '../../../src/config/rbac.config';

function makeReq(user?: any) {
    return { user } as unknown as Request;
}

describe('RBAC middleware', () => {
    const res = {} as Response;

    describe('requireRole', () => {
        it('allows when system_role matches (PASSENGER)', () => {
            const req = makeReq({
                system_role: 'PASSENGER',
                roles: [],
                permissions: []
            });
            const next = jest.fn() as NextFunction;

            requireRole(['PASSENGER'])(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('allows when granular role matches (SUPER_ADMIN)', () => {
            const req = makeReq({
                system_role: 'ADMIN',
                roles: ['SUPER_ADMIN'],
                permissions: []
            });
            const next = jest.fn() as NextFunction;

            requireRole(['SUPER_ADMIN'])(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('denies when neither system_role nor granular role matches (DRIVER trying admin)', () => {
            const req = makeReq({
                system_role: 'DRIVER',
                roles: [],
                permissions: []
            });
            const next = jest.fn() as NextFunction;

            requireRole(['ADMIN'])(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            const err = (next as jest.Mock).mock.calls[0][0];
            expect(err).toBeTruthy();
            expect(err.statusCode).toBe(403);
        });

        it('rejects when user is missing (unauthenticated)', () => {
            const req = makeReq(undefined);
            const next = jest.fn() as NextFunction;

            requireRole(['PASSENGER'])(req, res, next);

            const err = (next as jest.Mock).mock.calls[0][0];
            expect(err).toBeTruthy();
            expect(err.statusCode).toBe(401);
        });
    });

    describe('requirePermission', () => {
        it('allows when user has required permission', () => {
            const req = makeReq({
                system_role: 'ADMIN',
                roles: ['SUPPORT_AGENT'],
                permissions: [Permissions.MANAGE_USERS]
            });
            const next = jest.fn() as NextFunction;

            requirePermission(Permissions.MANAGE_USERS)(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('allows when user has ALL_ACCESS', () => {
            const req = makeReq({
                system_role: 'ADMIN',
                roles: ['SUPER_ADMIN'],
                permissions: [Permissions.ALL_ACCESS]
            });
            const next = jest.fn() as NextFunction;

            requirePermission(Permissions.MANAGE_USERS)(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('denies when user lacks permission (PASSENGER)', () => {
            const req = makeReq({
                system_role: 'PASSENGER',
                roles: [],
                permissions: []
            });
            const next = jest.fn() as NextFunction;

            requirePermission(Permissions.MANAGE_USERS)(req, res, next);

            const err = (next as jest.Mock).mock.calls[0][0];
            expect(err).toBeTruthy();
            expect(err.statusCode).toBe(403);
        });

        it('rejects when user is missing (unauthenticated)', () => {
            const req = makeReq(undefined);
            const next = jest.fn() as NextFunction;

            requirePermission(Permissions.MANAGE_USERS)(req, res, next);

            const err = (next as jest.Mock).mock.calls[0][0];
            expect(err).toBeTruthy();
            expect(err.statusCode).toBe(401);
        });
    });
});
