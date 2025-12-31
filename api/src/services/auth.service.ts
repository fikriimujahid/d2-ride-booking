import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    InitiateAuthCommand,
    ConfirmSignUpCommand,
    GlobalSignOutCommand,
    AdminDeleteUserCommand,
    AdminUpdateUserAttributesCommand
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError, UnauthorizedError, ConflictError } from '../utils/error.util';

// Initialize Cognito Client
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1"
});

export class AuthService {
    private clientId = process.env.COGNITO_CLIENT_ID!;
    private clientSecret = process.env.COGNITO_CLIENT_SECRET!;
    private userPoolId = process.env.COGNITO_USER_POOL_ID!;

    // Helper: Calculate Secret Hash (Required for Confidential Clients)
    private calculateSecretHash(username: string): string {
        return crypto
            .createHmac('SHA256', this.clientSecret)
            .update(username + this.clientId)
            .digest('base64');
    }

    // 1. Sign Up (Create User in Cognito + DB)
    async signup(data: { email: string; password: string; full_name: string; phone_number: string; role: 'PASSENGER' | 'DRIVER' }) {
        // 0. Pre-check: Verify if user already exists in DB
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { phone_number: data.phone_number }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === data.email) {
                throw new ConflictError('User with this email already exists');
            }
            if (existingUser.phone_number === data.phone_number) {
                throw new ConflictError('User with this phone number already exists');
            }
        }

        let userId: string;

        try {
            // A. Create in Cognito
            const command = new SignUpCommand({
                ClientId: this.clientId,
                SecretHash: this.calculateSecretHash(data.email),
                Username: data.email,
                Password: data.password,
                UserAttributes: [
                    { Name: "email", Value: data.email },
                    { Name: "name", Value: data.full_name },
                    { Name: "phone_number", Value: data.phone_number },
                    { Name: "custom:role", Value: data.role }
                ]
            });

            const cognitoResponse = await cognitoClient.send(command);
            userId = cognitoResponse.UserSub!;

            if (!userId) {
                throw new AppError('Failed to retrieve User ID from Cognito', 500, 'COGNITO_ERROR');
            }

        } catch (error) {
            const err = error as { name?: string };
            if (err.name === 'UsernameExistsException') {
                throw new ConflictError('User with this email already exists in auth system');
            }
            logger.error('Cognito Signup failed', error);
            throw error;
        }

        try {
            // B. Create in Database (Linked by UserSub)
            await prisma.user.create({
                data: {
                    id: userId,
                    email: data.email,
                    full_name: data.full_name,
                    phone_number: data.phone_number,
                    role: data.role === 'PASSENGER' ? 'PASSENGER' : data.role === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
                    is_online: false
                }
            });

            logger.info(`User created: ${userId} (${data.role})`);

            return {
                user_id: userId,
                email: data.email,
                message: 'Signup successful. Please verify your email.'
            };

        } catch (dbError) {
            logger.error('Database creation failed. Rolling back Cognito user.', dbError);

            // C. Rollback: Delete user from Cognito if DB creation fails
            try {
                if (this.userPoolId) {
                    const deleteCommand = new AdminDeleteUserCommand({
                        UserPoolId: this.userPoolId,
                        Username: data.email
                    });
                    await cognitoClient.send(deleteCommand);
                    logger.info(`Rollback successful: Deleted user ${data.email} from Cognito.`);
                } else {
                    logger.warn('Skipping Cognito rollback: COGNITO_USER_POOL_ID not configured.');
                }
            } catch (rollbackError) {
                logger.error('Rollback failed: Could not delete user from Cognito', rollbackError);
            }

            // If it was a unique constraint violation that slipped through (race condition), handle it
            const dbErr = dbError as { code?: string };
            if (dbErr.code === 'P2002') {
                throw new ConflictError('User details already exist');
            }

            throw new AppError('Failed to create user account', 500, 'DB_ERROR');
        }
    }

    // 2. Verify Email
    async verifyEmail(email: string, code: string) {
        try {
            const command = new ConfirmSignUpCommand({
                ClientId: this.clientId,
                SecretHash: this.calculateSecretHash(email),
                Username: email,
                ConfirmationCode: code
            });

            await cognitoClient.send(command);
            return { message: 'Email verified successfully' };
        } catch (error) {
            const err = error as { name?: string };
            if (err.name === 'CodeMismatchException') {
                throw new AppError('Invalid verification code', 400, 'INVALID_CODE');
            }
            if (err.name === 'ExpiredCodeException') {
                throw new AppError('Verification code expired', 400, 'EXPIRED_CODE');
            }
            throw error;
        }
    }

    // 3. Login
    async login(email: string, password: string) {
        try {
            const command = new InitiateAuthCommand({
                ClientId: this.clientId,
                AuthFlow: "USER_PASSWORD_AUTH",
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password,
                    SECRET_HASH: this.calculateSecretHash(email)
                }
            });

            const response = await cognitoClient.send(command);
            const result = response.AuthenticationResult;

            if (!result) {
                throw new UnauthorizedError('Login failed');
            }

            return {
                access_token: result.AccessToken,
                id_token: result.IdToken,
                refresh_token: result.RefreshToken,
                expires_in: result.ExpiresIn,
                token_type: result.TokenType
            };

        } catch (error) {
            const err = error as { name?: string };
            if (err.name === 'NotAuthorizedException') {
                throw new UnauthorizedError('Invalid email or password');
            }
            if (err.name === 'UserNotConfirmedException') {
                throw new AppError('Email not verified', 403, 'USER_NOT_CONFIRMED');
            }
            logger.error('Login failed', error);
            throw error;
        }
    }

    // 4. Refresh Token
    async refreshToken(refreshToken: string, email: string) {
        try {
            // Note: REFRESH_TOKEN_AUTH might maintain the same refresh token or issue a new one
            const command = new InitiateAuthCommand({
                ClientId: this.clientId,
                AuthFlow: "REFRESH_TOKEN_AUTH",
                AuthParameters: {
                    REFRESH_TOKEN: refreshToken,
                    SECRET_HASH: this.calculateSecretHash(email) // Some flows require this
                }
            });

            const response = await cognitoClient.send(command);
            const result = response.AuthenticationResult;

            if (!result) {
                throw new UnauthorizedError('Token refresh failed');
            }

            return {
                access_token: result.AccessToken,
                id_token: result.IdToken,
                expires_in: result.ExpiresIn,
            };

        } catch (error) {
            logger.error('Refresh token failed', error);
            throw new UnauthorizedError('Invalid or expired refresh token');
        }
    }
    // 5. Logout (Global Sign Out)
    async logout(accessToken: string) {
        try {
            const command = new GlobalSignOutCommand({
                AccessToken: accessToken
            });

            await cognitoClient.send(command);
            return { message: 'Logged out successfully' };

        } catch (error) {
            logger.error('Logout failed', error);
            throw new UnauthorizedError('Logout failed');
        }
    }

    // 6. Update User Attributes
    async updateUserAttributes(username: string, attributes: { full_name?: string; phone_number?: string }) {
        try {
            const userAttributes = [];

            if (attributes.full_name) {
                userAttributes.push({ Name: "name", Value: attributes.full_name });
            }
            if (attributes.phone_number) {
                userAttributes.push({ Name: "phone_number", Value: attributes.phone_number });
            }

            if (userAttributes.length === 0) {
                return;
            }

            const command = new AdminUpdateUserAttributesCommand({
                UserPoolId: this.userPoolId,
                Username: username,
                UserAttributes: userAttributes
            });

            await cognitoClient.send(command);
            logger.info(`Updated Cognito attributes for user ${username}`);

        } catch (error) {
            logger.error(`Failed to update Cognito attributes for user ${username}`, error);
            throw new AppError('Failed to update user profile in authentication system', 500, 'COGNITO_UPDATE_ERROR');
        }
    }
}


export const authService = new AuthService();
