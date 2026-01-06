import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'MANAGER' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Operations Manager', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreatePermissionDto {
  @ApiProperty({ example: 'rides.manage' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AssignRoleDto {
  @ApiProperty({ example: 'role-uuid' })
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AssignPermissionDto {
  @ApiProperty({ example: 'role-uuid' })
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({ example: 'permission-uuid' })
  @IsString()
  @IsNotEmpty()
  permissionId: string;
}
