import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { PrismaService } from '../../shared/prisma/prisma.service';

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwks = createRemoteJWKSet(new URL(this.jwksUrl));

  constructor(private readonly prisma: PrismaService) {}

  private get region() {
    return process.env.AWS_REGION;
  }

  private get userPoolId() {
    return process.env.COGNITO_USER_POOL_ID;
  }

  private get clientId() {
    return process.env.COGNITO_CLIENT_ID;
  }

  private get issuer() {
    return `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
  }

  private get jwksUrl() {
    return `${this.issuer}/.well-known/jwks.json`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = getBearerToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      payload = result.payload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    // Cognito access tokens: token_use=access and client_id should match.
    // Cognito id tokens: token_use=id and aud should match.
    const tokenUse = payload['token_use'];
    if (tokenUse !== 'access') {
      throw new UnauthorizedException('Expected an access token');
    }

    const aud = payload['aud'];
    const clientId = payload['client_id'];

    if (aud && String(aud) !== String(this.clientId)) {
      throw new UnauthorizedException('Invalid token audience');
    }

    if (!aud && clientId && String(clientId) !== String(this.clientId)) {
      throw new UnauthorizedException('Invalid token client_id');
    }

    request.user = payload;

    const dbUserId = await this.syncUser(payload);
    request.dbUserId = dbUserId;
    return true;
  }

  private async syncUser(payload: JWTPayload): Promise<string> {
    const cognitoSub = payload.sub;
    if (!cognitoSub) {
      throw new UnauthorizedException('Token missing subject');
    }

    const emailClaim = payload.email;
    const usernameClaim = payload['username'];
    const cognitoUsernameClaim = payload['cognito:username'];

    const email =
      (typeof emailClaim === 'string' && emailClaim) ||
      (typeof usernameClaim === 'string' && usernameClaim) ||
      (typeof cognitoUsernameClaim === 'string' && cognitoUsernameClaim) ||
      cognitoSub;

    const nameClaim = payload['name'];
    const givenName = payload['given_name'];
    const familyName = payload['family_name'];
    const name =
      (typeof nameClaim === 'string' && nameClaim) ||
      (typeof givenName === 'string' && typeof familyName === 'string'
        ? `${givenName} ${familyName}`.trim()
        : undefined) ||
      (typeof givenName === 'string' && givenName) ||
      email;

    try {
      const user = await this.prisma.user.upsert({
        where: { cognitoSub },
        update: {
          email,
          name,
          cognitoSub,
        },
        create: {
          email,
          name,
          cognitoSub,
        },
      });

      return user.id;
    } catch (err: unknown) {
      // Handle the case where the user already exists by email, but doesn't yet have cognitoSub set.
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
          if (existingByEmail) {
            const updated = await this.prisma.user.update({
              where: { email },
              data: {
                cognitoSub,
                name,
              },
            });
            return updated.id;
          }
        }
      }
      throw err;
    }
  }
}
