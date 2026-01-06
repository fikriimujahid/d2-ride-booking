import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/users.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.userId) {
       return false;
    }

    const userPermissions = await this.usersService.getUserPermissions(user.userId);
    
    // Check if user has ALL required permissions? Or ANY?
    // Typical RBAC is ANY or ALL depending on implementation.
    // Let's implement ALL for strictness, or iterate.
    // Requirement usually implies "Has permission X".
    
    // Let's assume passed Array means "Needs ALL of these".
    const hasAll = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAll) {
        throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
