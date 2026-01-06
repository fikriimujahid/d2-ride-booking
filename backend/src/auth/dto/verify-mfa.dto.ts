import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaDto {
  @ApiProperty({ description: 'The access token from login (or current session)', example: 'eyJ...' })
  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @ApiProperty({ description: 'The 6-digit TOTP code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  code: string;
}
