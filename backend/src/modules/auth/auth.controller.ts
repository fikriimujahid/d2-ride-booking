import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RespondChallengeDto } from './dto/respond-challenge.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Username/password login (Cognito, no Hosted UI)' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description:
      'On success returns tokens. On challenge returns challengeName + session + any parameters.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('respond-challenge')
  @ApiOperation({ summary: 'Respond to Cognito auth challenge' })
  @ApiBody({ type: RespondChallengeDto })
  @ApiOkResponse({
    description:
      'Returns tokens on success, or next challengeName + session when additional steps are required.',
  })
  async respondChallenge(@Body() dto: RespondChallengeDto) {
    return this.authService.respondChallenge(dto);
  }

  @Post('update-password')
  @ApiOperation({ summary: 'Complete NEW_PASSWORD_REQUIRED (set new password)' })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiOkResponse({
    description:
      'On success returns a relogin-required response (no tokens). If another challenge is required, returns next challengeName + session.',
  })
  async updatePassword(@Body() dto: UpdatePasswordDto) {
    return this.authService.updatePasswordForNewPasswordRequired(dto);
  }

  @Get('whoami')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return JWT claims from the validated access token' })
  @ApiOkResponse({ description: 'JWT claims from access token' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  whoami(@Req() req: any) {
    return { dbUserId: req.dbUserId, user: req.user };
  }
}
