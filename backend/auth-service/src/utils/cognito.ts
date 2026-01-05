import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AdminGetUserCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';
import { config } from '../config/env';

const client = new CognitoIdentityProviderClient({ region: config.AWS_REGION });

// Helper to calculate Secret Hash
const calculateSecretHash = (username: string) => {
  return crypto
    .createHmac('SHA256', config.COGNITO_CLIENT_SECRET)
    .update(username + config.COGNITO_CLIENT_ID)
    .digest('base64');
};

export const cognitoService = {
  async login(username: string, password: string) {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: calculateSecretHash(username),
      },
    });
    return client.send(command);
  },

  async respondToMfaChallenge(username: string, session: string, code: string) {
    const command = new RespondToAuthChallengeCommand({
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      ClientId: config.COGNITO_CLIENT_ID,
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        SOFTWARE_TOKEN_MFA_CODE: code,
        SECRET_HASH: calculateSecretHash(username),
      },
    });
    return client.send(command);
  },

  async associateSoftwareToken(accessToken: string) {
    const command = new AssociateSoftwareTokenCommand({
      AccessToken: accessToken,
    });
    return client.send(command);
  },

  async verifySoftwareToken(accessToken: string, code: string) {
    const command = new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: code,
    });
    return client.send(command);
  },

  async setMfaPreference(accessToken: string) {
    const command = new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: {
        Enabled: true,
        PreferredMfa: true,
      },
    });
    return client.send(command);
  },

  async getUserGroups(username: string) {
    const command = new AdminGetUserCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      Username: username,
    });
    // Note: AdminGetUser doesn't return groups directly, usually need AdminListGroupsForUser
    // But for simplicity in this design, we rely on ID Token 'cognito:groups' claim for quick checks
    // and DB for RBAC.
    return client.send(command);
  }
};
