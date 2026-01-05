import { Request, Response } from 'express';
import { cognitoService } from '../utils/cognito';
import { AuditAction } from '@prisma/client';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const response = await cognitoService.login(username, password);

    // Log attempt (simplified, ideally async queue)
    // await prisma.auditLog.create({ ... })

    if (response.ChallengeName === 'MFA_SETUP') {
      return res.json({
        status: 'MFA_SETUP_REQUIRED',
        session: response.Session,
      });
    }

    if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      return res.json({
        status: 'MFA_CHALLENGE_REQUIRED',
        session: response.Session,
      });
    }

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.json({
        status: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      });
    }

    if (response.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

      if (!IdToken || !AccessToken) {
        throw new Error('Tokens not returned from Cognito');
      }

      // Decode IdToken to check groups
      const decodedIdToken: any = jwt.decode(IdToken);
      if (!decodedIdToken) {
        throw new Error('Failed to decode IdToken');
      }
      
      const groups = decodedIdToken['cognito:groups'] || [];
      
      // Check DB for Admin Role (Fallback if Cognito Group is missing)
      const dbUser = await prisma.user.findUnique({
        where: { cognitoId: decodedIdToken.sub },
        include: { adminRoles: { include: { role: true } } }
      });
      
      const isDbAdmin = dbUser?.adminRoles.some(ar => ar.role.name.includes('ADMIN'));

      console.log('User Groups:', groups);
      console.log('Is DB Admin:', isDbAdmin);

      // Enforce MFA for Admin
      if (groups.includes('admin') || isDbAdmin) {
        // Check if MFA was performed (amr claim in AccessToken)
        // Note: AccessToken is also a JWT
        const decodedAccessToken: any = jwt.decode(AccessToken);
        const amr = decodedAccessToken?.amr || [];
        
        console.log('AMR Claims:', amr);

        if (!amr.includes('mfa') && !amr.includes('software_token_mfa')) {
          // Admin logged in but MFA was not challenged -> Force Setup
          return res.json({
            status: 'MFA_SETUP_REQUIRED',
            session: AccessToken, // Use AccessToken as session for setup
          });
        }
      }

      return res.json({
        status: 'AUTHENTICATED',
        tokens: {
          accessToken: AccessToken,
          idToken: IdToken,
          refreshToken: RefreshToken,
        },
      });
    }

    res.status(400).json({ error: 'Unknown auth state', details: response });
  } catch (error: any) {
    console.error('Login Error:', error);
    res.status(401).json({ 
      error: 'Authentication failed', 
      message: error.message,
      code: error.name 
    });
  }
};

export const setupMfa = async (req: Request, res: Response) => {
  const { session } = req.body; // This is the AccessToken from login step

  try {
    const response = await cognitoService.associateSoftwareToken(session);
    const secretCode = response.SecretCode;

    if (!secretCode) {
      return res.status(400).json({ error: 'Failed to generate secret code' });
    }

    // Generate QR Code
    const decodedToken: any = jwt.decode(session);
    const username = decodedToken?.username || 'User';
    const issuer = 'RideBooking';
    const otpauthUrl = `otpauth://totp/${issuer}:${username}?secret=${secretCode}&issuer=${issuer}`;
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secretCode: response.SecretCode,
      session: response.Session, // New session for verification
      qrCode,
      accessToken: session, // Return the access token so it can be used in confirmMfa
    });
  } catch (error: any) {
    console.error('MFA Setup Error:', error);
    res.status(400).json({ error: 'Failed to initiate MFA setup' });
  }
};

export const confirmMfa = async (req: Request, res: Response) => {
  const { session, code, accessToken } = req.body; 
  // session: from setupMfa response (if needed by Cognito, but VerifySoftwareToken uses AccessToken + UserCode)
  // Actually, VerifySoftwareToken takes AccessToken.
  // But wait, AssociateSoftwareToken returns a Session? No, it returns SecretCode and Session.
  // VerifySoftwareToken takes AccessToken and UserCode.
  // Wait, if we are in "MFA_SETUP" challenge (from Cognito), we use RespondToAuthChallenge.
  // But here we are in "Authenticated but forcing MFA" flow.
  // So we use VerifySoftwareToken with the AccessToken we have.

  try {
    const verifyResponse = await cognitoService.verifySoftwareToken(accessToken, code);
    
    if (verifyResponse.Status === 'SUCCESS') {
      // Enable MFA for user
      await cognitoService.setMfaPreference(accessToken);
      
      return res.json({ status: 'MFA_SETUP_COMPLETED' });
    }
    
    res.status(400).json({ error: 'Invalid MFA code' });
  } catch (error: any) {
    console.error('MFA Confirm Error:', error);
    res.status(400).json({ error: 'Failed to verify MFA' });
  }
};

export const verifyMfa = async (req: Request, res: Response) => {
  const { username, session, code } = req.body;

  try {
    const response = await cognitoService.respondToMfaChallenge(username, session, code);

    if (response.AuthenticationResult) {
      // Log success
      // await prisma.auditLog.create({ ... })

      return res.json({
        status: 'AUTHENTICATED',
        tokens: {
          accessToken: response.AuthenticationResult.AccessToken,
          idToken: response.AuthenticationResult.IdToken,
          refreshToken: response.AuthenticationResult.RefreshToken,
        },
      });
    }

    res.status(400).json({ error: 'MFA verification failed' });
  } catch (error: any) {
    console.error('MFA Error:', error);
    res.status(401).json({ error: 'Invalid MFA code' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = req.user; // From auth middleware
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({
      where: { cognitoId: user.sub },
      include: {
        adminRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    // Flatten permissions for easier consumption
    const permissions = dbUser.adminRoles.flatMap(ar => 
      ar.role.permissions.map(rp => `${rp.permission.resource}:${rp.permission.action}`)
    );

    const roles = dbUser.adminRoles.map(ar => ar.role.name);

    res.json({
      id: dbUser.id,
      email: dbUser.email,
      userType: dbUser.userType,
      roles,
      permissions: [...new Set(permissions)], // Unique permissions
      cognitoId: dbUser.cognitoId
    });
  } catch (error) {
    console.error('GetMe Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
