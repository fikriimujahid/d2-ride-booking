import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async syncUser(email: string, cognitoSub: string) {
    // ... Upsert user logic (existing) ...
    return this.prisma.user.upsert({
      where: { cognitoSub },
      update: { email }, 
      create: {
        email,
        cognitoSub,
        name: email.split('@')[0], 
      },
    });
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
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

    if (!user) return [];

    const permissions = new Set<string>();
    
    // Iterate through User -> UserRole -> Role -> RolePermission -> Permission
    user.userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rp) => {
        permissions.add(rp.permission.name);
      });
    });

    return Array.from(permissions);
  }
}
