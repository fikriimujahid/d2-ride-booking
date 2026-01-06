import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminMfaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
        return false;
    }

    const groups = user.roles || [];
    const isAdmin = groups.includes('Admin');

    if (isAdmin) {
        // Check if MFA was used in this session?
        // Cognito Access Token has "amr" (Authentication Methods References) claim.
        // It should contain "mfa" or "software_token_mfa" if MFA was performed.
        
        // However, the standard passport-jwt strategy payload might imply simple decoding.
        // We need to inspect the 'amr' claim.
        // In JwtStrategy, we just return the payload props.
        // Let's assume user object needs 'amr' attached in JwtStrategy.
        
        // But wait, the prompt says "Block /admin/* unless MFA enabled".
        // It implies enforcing MFA setup or checking if it was used?
        // "Enforce MFA for Admin users" usually means they MUST have logged in with it.
        
        // Let's check the request.user for 'amr'.
        // We need to update JwtStrategy to include 'amr' in the returned user object.
        
        const amr = user.amr || []; // We need to add this to JwtStrategy return
        if (!amr.includes('mfa') && !amr.includes('software_token_mfa')) {
             throw new ForbiddenException('Admin access requires MFA authentication');
        }
    }

    return true; // Pass if not admin, or if admin + mfa
  }
}
