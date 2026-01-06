import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RespondChallengeDto } from './dto/respond-challenge.dto';
import { SetupMfaDto } from './dto/setup-mfa.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Initiate authentication flow' })
  @ApiResponse({ status: 200, description: 'Login successful or challenge required' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('respond-challenge')
  @ApiOperation({ summary: 'Respond to authentication challenge (MFA, New Password)' })
  @ApiResponse({ status: 200, description: 'Challenge accepted, returns tokens or next challenge' })
  @HttpCode(HttpStatus.OK)
  async respondToChallenge(@Body() dto: RespondChallengeDto) {
    return this.authService.respondToChallenge(dto);
  }

  @Get('whoami')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  @ApiResponse({ status: 200, description: 'User info' })
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate MFA Setup (get secret code and QR code)' })
  @ApiResponse({ status: 200, description: 'Returns shared secret and QR code for authenticator app' })
  async setupMfa(@Body() dto: SetupMfaDto, @Request() req) {
      // Use email from the token (req.user) to generate a friendly label in the QR code.
      // We still use dto.accessToken as AssociateSoftwareToken requires the raw token which isn't always fully in req.user depending on strategy.
      // Wait, AssociateSoftwareToken requires the Access Token.
      // req.user comes from decoding the token in the header.
      // Ideally we'd use the header token, but dto.accessToken works if passed.
      const email = req.user.email || 'user';
      return this.authService.setupMfa(dto.accessToken, email);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify MFA code and enable it' })
  async verifyMfa(@Body() dto: VerifyMfaDto, @Request() req) {
      await this.authService.verifyMfa(dto.accessToken, dto.code);
      // After verification, enforce it for the user
      return this.authService.enableMfaPreference(req.user.username);
  }
}
