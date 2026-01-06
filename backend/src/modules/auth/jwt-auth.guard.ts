import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwks = createRemoteJWKSet(new URL(this.jwksUrl));

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
    return true;
  }
}
