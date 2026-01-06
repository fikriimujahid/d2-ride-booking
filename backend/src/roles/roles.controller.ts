import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoleDto, CreatePermissionDto, AssignRoleDto, AssignPermissionDto } from './dto/rbac.dto';

// In a real app, these endpoints should be protected by a SUPER_ADMIN check or specific permission.
// For now, gating with JwtAuthGuard.

@ApiTags('rbac')
@Controller('rbac')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private prisma: PrismaService) {}

  @Post('roles')
  @ApiOperation({ summary: 'Create a new Role' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: dto,
    });
  }

  @Get('roles')
  @ApiOperation({ summary: 'List all Roles' })
  async getRoles() {
    return this.prisma.role.findMany();
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create a new Permission' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.prisma.permission.create({
      data: dto,
    });
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all Permissions' })
  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  @Post('users/assign')
  @ApiOperation({ summary: 'Assign Role to User' })
  async assignRoleToUser(@Body() dto: AssignRoleDto) {
    return this.prisma.userRole.create({
      data: {
        userId: dto.userId,
        roleId: dto.roleId,
      },
    });
  }
  
  @Post('roles/assign-permission')
  @ApiOperation({ summary: 'Assign Permission to Role' })
  async assignPermissionToRole(@Body() dto: AssignPermissionDto) {
      return this.prisma.rolePermission.create({
          data: {
              roleId: dto.roleId,
              permissionId: dto.permissionId
          }
      });
  }
}
