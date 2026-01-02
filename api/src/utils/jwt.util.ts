import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const issuer = `https://cognito-idp.${env.AWS_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`;
const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);
const jwks = createRemoteJWKSet(jwksUrl);

export type VerifiedJwt = {
  claims: Record<string, unknown>;
};

export async function verifyCognitoJwt(token: string): Promise<VerifiedJwt> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    algorithms: ['RS256']
  });

  return { claims: payload as unknown as Record<string, unknown> };
}
