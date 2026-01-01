import type { Request, Response, NextFunction } from 'express';

const prismaMock = {
    user: {
        findUnique: jest.fn()
    }
};

const verifyJWTMock = jest.fn();

jest.mock('../../../src/config/database', () => ({
    prisma: prismaMock
}));

jest.mock('../../../src/utils/jwt.util', () => ({
    verifyJWT: (token: string) => verifyJWTMock(token)
}));

import { authenticateJWT } from '../../../src/middleware/auth.middleware';

function makeReq(authHeader?: string) {
    return {
        headers: authHeader ? { authorization: authHeader } : {}
    } as unknown as Request;
}

describe('authenticateJWT middleware', () => {
    const res = {} as Response;

    beforeEach(() => {
        prismaMock.user.findUnique.mockReset();
        verifyJWTMock.mockReset();
    });

    it('rejects missing authorization header', async () => {
        const req = makeReq(undefined);
        const next = jest.fn() as NextFunction;

        await authenticateJWT(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = (next as jest.Mock).mock.calls[0][0];
        expect(err).toBeTruthy();
        expect(err.statusCode).toBe(401);
    });

    it('rejects invalid bearer token', async () => {
        const req = makeReq('Bearer badtoken');
        const next = jest.fn() as NextFunction;

        verifyJWTMock.mockRejectedValueOnce(new Error('Invalid token'));

        await authenticateJWT(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = (next as jest.Mock).mock.calls[0][0];
        expect(err).toBeTruthy();
        expect(err.statusCode).toBe(401);
    });

    it('rejects when user does not exist in DB', async () => {
        const req = makeReq('Bearer goodtoken');
        const next = jest.fn() as NextFunction;

        verifyJWTMock.mockResolvedValueOnce({ sub: 'user-1', email: 'a@example.com' });
        prismaMock.user.findUnique.mockResolvedValueOnce(null);

        await authenticateJWT(req, res, next);

        expect(prismaMock.user.findUnique).toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
        const err = (next as jest.Mock).mock.calls[0][0];
        expect(err).toBeTruthy();
        expect(err.statusCode).toBe(401);
    });

    it('attaches user payload with roles and permissions (admin RBAC)', async () => {
        const req = makeReq('Bearer goodtoken');
        const next = jest.fn() as NextFunction;

        verifyJWTMock.mockResolvedValueOnce({ sub: 'admin-1', email: 'admin@example.com' });

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 'admin-1',
            system_role: 'ADMIN',
            roles: [
                {
                    role: {
                        name: 'SUPER_ADMIN',
                        permissions: [
                            { permission: { key: '*' } },
                            { permission: { key: 'manage:users' } }
                        ]
                    }
                }
            ]
        });

        await authenticateJWT(req, res, next);

        expect(next).toHaveBeenCalledWith();
        const user = (req as any).user;
        expect(user).toBeTruthy();
        expect(user.id).toBe('admin-1');
        expect(user.system_role).toBe('ADMIN');
        expect(user.roles).toContain('SUPER_ADMIN');
        expect(user.permissions).toContain('*');
        expect(user.permissions).toContain('manage:users');
    });

    it('attaches empty RBAC arrays for passenger with no roles', async () => {
        const req = makeReq('Bearer goodtoken');
        const next = jest.fn() as NextFunction;

        verifyJWTMock.mockResolvedValueOnce({ sub: 'p-1', email: 'p@example.com' });

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 'p-1',
            system_role: 'PASSENGER',
            roles: []
        });

        await authenticateJWT(req, res, next);

        expect(next).toHaveBeenCalledWith();
        const user = (req as any).user;
        expect(user.system_role).toBe('PASSENGER');
        expect(user.roles).toEqual([]);
        expect(user.permissions).toEqual([]);
    });
});
