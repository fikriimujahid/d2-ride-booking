import type { RequestHandler } from 'express';
import { ApiError, UnauthorizedError } from '../models/error.model.js';
import { prisma } from '../config/database.js';

export function requireAdminPermission(requiredPermissions: string[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.auth) return next(new UnauthorizedError('UNAUTHORIZED'));

      const isAdmin = req.auth.groups.includes('Admin');
      if (!isAdmin) {
        return next(
          new ApiError({
            status: 403,
            code: 'AUTH_FORBIDDEN',
            message: 'You do not have access to this resource.',
            details: { required_group: 'Admin' }
          })
        );
      }

      const adminSub = req.auth.sub;
      const admin = await prisma.adminUser.findUnique({
        where: { cognitoSub: adminSub },
        select: {
          id: true,
          deletedAt: true,
          roleAssignments: {
            where: { deletedAt: null, revokedAt: null },
            select: {
              role: {
                select: {
                  deletedAt: true,
                  permissions: {
                    where: { deletedAt: null, revokedAt: null },
                    select: {
                      permission: { select: { key: true, deletedAt: true } }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!admin || admin.deletedAt) {
        return next(
          new ApiError({
            status: 403,
            code: 'RBAC_INSUFFICIENT_ROLE',
            message: 'You do not have the required role to perform this action.',
            details: {
              required_permissions: requiredPermissions
            }
          })
        );
      }

      const permissionKeys = new Set<string>();
      for (const assignment of admin.roleAssignments) {
        const role = assignment.role;
        if (role.deletedAt) continue;
        for (const rp of role.permissions) {
          if (!rp.permission.deletedAt) permissionKeys.add(rp.permission.key);
        }
      }

      const ok = requiredPermissions.every((p) => permissionKeys.has(p));
      if (!ok) {
        const missing = requiredPermissions.filter((p) => !permissionKeys.has(p));
        return next(
          new ApiError({
            status: 403,
            code: 'RBAC_INSUFFICIENT_ROLE',
            message: 'You do not have the required role to perform this action.',
            details: {
              required_permissions: requiredPermissions,
              missing_permissions: missing
            }
          })
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
