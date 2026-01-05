import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export const requireRbac = (requiredResource: string, requiredAction: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const cognitoGroups = user['cognito:groups'] || [];
      const cognitoSub = user.sub;

      // 1. Check Cognito Group (Must be admin for admin APIs)
      if (!cognitoGroups.includes('admin')) {
        return res.status(403).json({ error: 'Forbidden: Not an admin' });
      }

      // 1.5 Check MFA (Admin MUST have MFA)
      // 'amr' claim contains authentication methods.
      // If MFA was used, it should contain 'mfa' or 'software_token_mfa'.
      const amr = user.amr || [];
      if (!amr.includes('mfa') && !amr.includes('software_token_mfa')) {
        return res.status(403).json({ error: 'Forbidden: MFA required for admin access' });
      }

      // 2. Check DB Permissions
      // Find user in DB by cognitoId
      const dbUser = await prisma.user.findUnique({
        where: { cognitoId: cognitoSub },
        include: {
          adminRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!dbUser) {
        return res.status(403).json({ error: 'Forbidden: User not found in DB' });
      }

      // Flatten permissions
      const userPermissions = dbUser.adminRoles.flatMap((ar) =>
        ar.role.permissions.map((rp) => rp.permission)
      );

      const hasPermission = userPermissions.some(
        (p) => p.resource === requiredResource && p.action === requiredAction
      );

      // Super Admin Bypass
      const isSuperAdmin = dbUser.adminRoles.some((ar) => ar.role.name === 'SUPER_ADMIN');

      if (!hasPermission && !isSuperAdmin) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};
