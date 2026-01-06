import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RespondChallengeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'NEW_PASSWORD_REQUIRED' })
  @IsString()
  @IsNotEmpty()
  challengeName!: string;

  @ApiProperty({ description: 'Session token returned by Cognito during a challenge' })
  @IsString()
  @IsNotEmpty()
  session!: string;

  @ApiProperty({
    description:
      'Challenge responses for Cognito RespondToAuthChallenge. Example for NEW_PASSWORD_REQUIRED: { "USERNAME": "...", "NEW_PASSWORD": "..." }',
    type: Object,
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  @IsNotEmpty()
  challengeResponses!: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'Optional helper for MFA_SETUP flow. Use action=ASSOCIATE to get a TOTP secret, then action=VERIFY with the code from authenticator app.',
    type: Object,
  })
  @IsOptional()
  mfaSetup?: {
    action: 'ASSOCIATE' | 'VERIFY';
    code?: string;
    deviceName?: string;
  };
}
