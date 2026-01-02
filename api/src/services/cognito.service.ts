import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  GetUserCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const client = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

function maybeSecretHash(username: string): string | undefined {
  if (!env.COGNITO_APP_CLIENT_SECRET) return undefined;
  const hmac = crypto.createHmac('sha256', env.COGNITO_APP_CLIENT_SECRET);
  hmac.update(username + env.COGNITO_APP_CLIENT_ID);
  return hmac.digest('base64');
}

export async function adminLoginWithPassword(email: string, password: string) {
  const secretHash = maybeSecretHash(email);
  const cmd = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: env.COGNITO_APP_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      ...(secretHash ? { SECRET_HASH: secretHash } : {})
    }
  });

  return client.send(cmd);
}

export async function adminRespondToMfaChallenge(params: {
  email: string;
  session: string;
  challengeName: string;
  code: string;
}) {
  const secretHash = maybeSecretHash(params.email);
  const cmd = new RespondToAuthChallengeCommand({
    ClientId: env.COGNITO_APP_CLIENT_ID,
    Session: params.session,
    ChallengeName: params.challengeName as any,
    ChallengeResponses: {
      USERNAME: params.email,
      ...(secretHash ? { SECRET_HASH: secretHash } : {}),
      ...(params.challengeName === 'SOFTWARE_TOKEN_MFA'
        ? { SOFTWARE_TOKEN_MFA_CODE: params.code }
        : { SMS_MFA_CODE: params.code })
    }
  });

  return client.send(cmd);
}

export async function adminRefreshTokens(email: string, refreshToken: string) {
  const secretHash = maybeSecretHash(email);
  const cmd = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: env.COGNITO_APP_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
      ...(secretHash ? { SECRET_HASH: secretHash } : {})
    }
  });

  return client.send(cmd);
}

export async function startTotpSetup(accessToken: string) {
  const cmd = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
  return client.send(cmd);
}

export async function getUserMfaSettings(accessToken: string) {
  const cmd = new GetUserCommand({ AccessToken: accessToken });
  return client.send(cmd);
}

export async function confirmTotpSetup(params: { accessToken: string; userCode: string }) {
  const verifyCmd = new VerifySoftwareTokenCommand({
    AccessToken: params.accessToken,
    UserCode: params.userCode
  });
  const verifyRes = await client.send(verifyCmd);

  // Prefer TOTP.
  const setCmd = new SetUserMFAPreferenceCommand({
    AccessToken: params.accessToken,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true
    }
  });
  await client.send(setCmd);

  return verifyRes;
}

export async function disableTotp(accessToken: string) {
  const cmd = new SetUserMFAPreferenceCommand({
    AccessToken: accessToken,
    SoftwareTokenMfaSettings: {
      Enabled: false,
      PreferredMfa: false
    }
  });
  return client.send(cmd);
}

export async function globalSignOut(accessToken: string) {
  const cmd = new GlobalSignOutCommand({ AccessToken: accessToken });
  return client.send(cmd);
}
