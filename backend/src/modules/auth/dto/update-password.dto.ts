import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: 'Session token returned by Cognito for NEW_PASSWORD_REQUIRED' })
  @IsString()
  @IsNotEmpty()
  session!: string;

  @ApiProperty({ example: 'N3wP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  newPassword!: string;

  @ApiPropertyOptional({
    description:
      'Optional user attributes required by your user pool/app client. Keys are attribute names (e.g. given_name, family_name).',
    type: Object,
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  requiredAttributes?: Record<string, string>;
}
