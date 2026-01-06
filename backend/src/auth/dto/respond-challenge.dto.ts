import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondChallengeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'The Session token returned from the previous step', example: 'AyABe...' })
  @IsString()
  @IsNotEmpty()
  session: string;

  @ApiProperty({ description: 'The name of the challenge', example: 'NEW_PASSWORD_REQUIRED' })
  @IsString()
  @IsNotEmpty()
  challengeName: string;

  @ApiProperty({
    description: 'The answer to the challenge. For NEW_PASSWORD_REQUIRED, provide the new password. For SOFTWARE_TOKEN_MFA, provide the 6-digit code.',
    example: 'NewPassword123!',
    required: false,
  })
  @IsString()
  @IsOptional()
  response?: string;
}
