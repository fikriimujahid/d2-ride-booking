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

  @Get('whoami')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return JWT claims from the validated access token' })
  @ApiOkResponse({ description: 'JWT claims from access token' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  whoami(@Req() req: any) {
    return { user: req.user };
  }
}
