import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private clientId: string;

  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    const userPoolId = configService.get<string>('COGNITO_USER_POOL_ID');
    const region = configService.get<string>('AWS_REGION');
    const authority = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // audience: configService.get<string>('COGNITO_CLIENT_ID'), // REMOVED: Managed in validate() to support both Access and ID tokens
      issuer: authority,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${authority}/.well-known/jwks.json`,
      }),
    });
    this.clientId = configService.get<string>('COGNITO_CLIENT_ID');
  }

  async validate(payload: any) {
    // Validate Audience / Client ID manually
    const tokenAudience = payload.aud || payload.client_id;
    if (tokenAudience !== this.clientId) {
      throw new UnauthorizedException('Invalid audience or client ID');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sub: cognitoSub, email, ...rest } = payload;
    console.log('Token Payload:', JSON.stringify(payload, null, 2)); // Debugging

    // Access Tokens might not have 'email' directly if scopes aren't set right, or standard claims differ.
    // ID Tokens definitely have 'email'.
    // If using Access Token, we might need to fetch user attributes from Cognito (getUser) if email is missing.
    // BUT for simplicity, let's assume ID Token or Access Token with openid email scope.
    
    // Fallback?
    // If email is missing, we can't sync email.
    
    if (!cognitoSub) {
       throw new UnauthorizedException('Token missing subject (sub)');
    }
    
    // Temporary relax email requirement for debugging if it's the missing piece
    // Or check alternative claim names?
    
    if (!email) {
       // If it's an access token, it might not have email.
       // Requirement says: "Store email".
       // If we can't get email from token, we can't fulfill requirement easily without extra call.
       
       console.warn('Email missing in token. Claims:', payload);
       throw new UnauthorizedException('Token missing email claim. Use ID Token or ensure email scope.');
    }

    // Sync user with database
    const user = await this.usersService.syncUser(email, cognitoSub);

    // Return the payload as the user object injected into the request
    return { 
        userId: user.id, // DB User ID
        email: user.email,
        username: payload['cognito:username'] || payload.username, 
        roles: payload['cognito:groups'] || [],
        amr: payload.amr || []
    };
  }
}
