import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AdminInitiateAuthCommand,
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  VerifySoftwareTokenCommand,
  type ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'node:crypto';

import type { RespondChallengeDto } from './dto/respond-challenge.dto';
import type { UpdatePasswordDto } from './dto/update-password.dto';

type LoginResult =
  | {
      status: 'SUCCESS';
      accessToken: string;
      idToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      tokenType?: string;
    }
  | {
      status: 'CHALLENGE';
      challengeName: string;
      session: string;
      challengeParameters?: Record<string, string>;
    };

@Injectable()
export class AuthService {
  private readonly client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });

  private get userPoolId() {
    return process.env.COGNITO_USER_POOL_ID!;
  }

  private get clientId() {
    return process.env.COGNITO_CLIENT_ID!;
  }

  private get clientSecret() {
    return process.env.COGNITO_CLIENT_SECRET;
  }

  private get useAdminAuth() {
    return String(process.env.COGNITO_USE_ADMIN_AUTH ?? 'false').toLowerCase() === 'true';
  }

  private secretHash(username: string): string | undefined {
    if (!this.clientSecret) return undefined;
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const secretHash = this.secretHash(username);

    if (this.useAdminAuth) {
      const res = await this.client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: this.clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            ...(secretHash ? { SECRET_HASH: secretHash } : {}),
          },
        }),
      );

      if (res.AuthenticationResult?.AccessToken) {
        return {
          status: 'SUCCESS',
          accessToken: res.AuthenticationResult.AccessToken,
          idToken: res.AuthenticationResult.IdToken,
          refreshToken: res.AuthenticationResult.RefreshToken,
          expiresIn: res.AuthenticationResult.ExpiresIn,
          tokenType: res.AuthenticationResult.TokenType,
        };
      }

      if (res.ChallengeName && res.Session) {
        return {
          status: 'CHALLENGE',
          challengeName: res.ChallengeName,
          session: res.Session,
          challengeParameters: res.ChallengeParameters,
        };
      }

      throw new BadRequestException('Unexpected Cognito response');
    }

    const res = await this.client.send(
      new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      }),
    );

    if (res.AuthenticationResult?.AccessToken) {
      return {
        status: 'SUCCESS',
        accessToken: res.AuthenticationResult.AccessToken,
        idToken: res.AuthenticationResult.IdToken,
        refreshToken: res.AuthenticationResult.RefreshToken,
        expiresIn: res.AuthenticationResult.ExpiresIn,
        tokenType: res.AuthenticationResult.TokenType,
      };
    }

    if (res.ChallengeName && res.Session) {
      return {
        status: 'CHALLENGE',
        challengeName: res.ChallengeName,
        session: res.Session,
        challengeParameters: res.ChallengeParameters,
      };
    }

    throw new BadRequestException('Unexpected Cognito response');
  }

  async respondChallenge(dto: RespondChallengeDto) {
    const username = dto.username;
    const secretHash = this.secretHash(username);

    // Helper support for MFA_SETUP without adding extra endpoints.
    if (dto.challengeName === 'MFA_SETUP' && dto.mfaSetup?.action === 'ASSOCIATE') {
      const out = await this.client.send(
        new AssociateSoftwareTokenCommand({
          Session: dto.session,
        }),
      );

      if (!out.SecretCode || !out.Session) {
        throw new BadRequestException('Failed to associate software token');
      }

      return {
        status: 'CHALLENGE' as const,
        challengeName: 'MFA_SETUP',
        session: out.Session,
        mfaSetup: {
          secretCode: out.SecretCode,
        },
      };
    }

    if (dto.challengeName === 'MFA_SETUP' && dto.mfaSetup?.action === 'VERIFY') {
      if (!dto.mfaSetup.code) {
        throw new BadRequestException('Missing mfaSetup.code');
      }

      const verified = await this.client.send(
        new VerifySoftwareTokenCommand({
          Session: dto.session,
          UserCode: dto.mfaSetup.code,
          FriendlyDeviceName: dto.mfaSetup.deviceName,
        }),
      );

      const nextSession = verified.Session ?? dto.session;

      const res = await this.client.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.clientId,
          ChallengeName: 'MFA_SETUP',
          Session: nextSession,
          ChallengeResponses: {
            USERNAME: username,
            ...(secretHash ? { SECRET_HASH: secretHash } : {}),
          },
        }),
      );

      if (res.AuthenticationResult?.AccessToken) {
        return {
          status: 'SUCCESS' as const,
          accessToken: res.AuthenticationResult.AccessToken,
          idToken: res.AuthenticationResult.IdToken,
          refreshToken: res.AuthenticationResult.RefreshToken,
          expiresIn: res.AuthenticationResult.ExpiresIn,
          tokenType: res.AuthenticationResult.TokenType,
        };
      }

      if (res.ChallengeName && res.Session) {
        return {
          status: 'CHALLENGE' as const,
          challengeName: res.ChallengeName,
          session: res.Session,
          challengeParameters: res.ChallengeParameters,
        };
      }

      throw new BadRequestException('Unexpected Cognito response');
    }

    const res = await this.client.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: dto.challengeName as ChallengeNameType,
        Session: dto.session,
        ChallengeResponses: {
          ...dto.challengeResponses,
          USERNAME: username,
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      }),
    );

    if (res.AuthenticationResult?.AccessToken) {
      return {
        status: 'SUCCESS' as const,
        requireRelogin: true as const,
        message: 'Password updated. Please login again.',
      };
    }

    if (res.ChallengeName && res.Session) {
      return {
        status: 'CHALLENGE' as const,
        challengeName: res.ChallengeName,
        session: res.Session,
        challengeParameters: res.ChallengeParameters,
      };
    }

    throw new BadRequestException('Unexpected Cognito response');
  }

  async updatePasswordForNewPasswordRequired(dto: UpdatePasswordDto) {
    const username = dto.username;
    const secretHash = this.secretHash(username);

    const attributeResponses: Record<string, string> = {};
    if (dto.requiredAttributes) {
      for (const [key, value] of Object.entries(dto.requiredAttributes)) {
        attributeResponses[`userAttributes.${key}`] = value;
      }
    }

    const res = await this.client.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: dto.session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: dto.newPassword,
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
          ...attributeResponses,
        },
      }),
    );

    if (res.AuthenticationResult?.AccessToken) {
      return {
        status: 'SUCCESS' as const,
        accessToken: res.AuthenticationResult.AccessToken,
        idToken: res.AuthenticationResult.IdToken,
        refreshToken: res.AuthenticationResult.RefreshToken,
        expiresIn: res.AuthenticationResult.ExpiresIn,
        tokenType: res.AuthenticationResult.TokenType,
      };
    }

    if (res.ChallengeName && res.Session) {
      return {
        status: 'CHALLENGE' as const,
        challengeName: res.ChallengeName,
        session: res.Session,
        challengeParameters: res.ChallengeParameters,
      };
    }

    throw new BadRequestException('Unexpected Cognito response');
  }
}
