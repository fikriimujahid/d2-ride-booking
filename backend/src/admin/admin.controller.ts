import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminMfaGuard } from '../auth/guards/admin-mfa.guard';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminMfaGuard)
@ApiBearerAuth()
export class AdminController {
    @Get('dashboard')
    getDashboard() {
        return { message: 'Welcome to the protected Admin Dashboard (MFA Verified)' };
    }
}
