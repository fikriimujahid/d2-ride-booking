import { Router } from 'express';
import { z } from 'zod';
import {
  adminLoginWithPassword,
  adminRespondToMfaChallenge,
  adminRefreshTokens,
  globalSignOut,
  startTotpSetup,
  confirmTotpSetup,
  getUserMfaSettings
} from '../services/cognito.service.js';
import { verifyCognitoJwt } from '../utils/jwt.util.js';
import { HttpError, UnauthorizedError } from '../models/error.model.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { requireGroup } from '../middleware/guard.middleware.js';
import { logger } from '../config/logger.js';

export const authRoutes = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRoutes.post('/admin/login', async (req, res, next) => {
  try {
    const body = adminLoginSchema.parse(req.body);
    const cognitoRes = await adminLoginWithPassword(body.email, body.password);

    if (cognitoRes.ChallengeName && cognitoRes.Session) {
      return res.status(200).json({
        mfa_required: true,
        email: body.email,
        session: cognitoRes.Session,
        challenge_name: cognitoRes.ChallengeName
      });
    }

    const tokens = cognitoRes.AuthenticationResult;
    if (!tokens?.AccessToken) throw new UnauthorizedError('INVALID_COGNITO_RESPONSE');

    // Decode (without trusting) to decide whether admin endpoints should be MFA-gated.
    // We do not issue custom JWTs; enforcement happens in middleware.
    let amr: unknown = undefined;
    let sub: unknown = undefined;
    let groups: unknown = undefined;
    try {
      const verified = await verifyCognitoJwt(tokens.AccessToken);
      amr = verified.claims.amr;
      sub = verified.claims.sub;
      groups = verified.claims['cognito:groups'];
    } catch {
      // Ignore; token will be enforced by middleware later.
    }

    const mfaPresent = Array.isArray(amr) && amr.includes('mfa');
    const isAdmin = Array.isArray(groups) && groups.includes('Admin');
    const userId = typeof sub === 'string' ? sub : '';

    return res.status(200).json({
      access_token: tokens.AccessToken,
      id_token: tokens.IdToken,
      refresh_token: tokens.RefreshToken,
      token_type: tokens.TokenType,
      user: {
        id: userId,
        email: body.email,
        system_role: isAdmin ? 'ADMIN' : 'PASSENGER',
        roles: [],
        permissions: []
      },
      // Hint for clients; API still enforces MFA on admin routes.
      ...(mfaPresent ? {} : { mfa_hint: 'MFA_NOT_PRESENT' })
    });
  } catch (err) {
    next(err);
  }
});

const verifyMfaSchema = z.object({
  email: z.string().email(),
  session: z.string().min(1),
  challenge_name: z.string().min(1).default('SOFTWARE_TOKEN_MFA'),
  code: z.string().min(1)
});

authRoutes.post('/admin/mfa/verify', async (req, res, next) => {
  try {
    const body = verifyMfaSchema.parse(req.body);
    const cognitoRes = await adminRespondToMfaChallenge({
      email: body.email,
      session: body.session,
      challengeName: body.challenge_name,
      code: body.code
    });

    const tokens = cognitoRes.AuthenticationResult;
    if (!tokens?.AccessToken) throw new UnauthorizedError('INVALID_COGNITO_RESPONSE');

    let sub: unknown = undefined;
    let groups: unknown = undefined;
    try {
      const verified = await verifyCognitoJwt(tokens.AccessToken);
      sub = verified.claims.sub;
      groups = verified.claims['cognito:groups'];
    } catch {
      // ignore
    }

    const isAdmin = Array.isArray(groups) && groups.includes('Admin');
    const userId = typeof sub === 'string' ? sub : '';

    return res.status(200).json({
      access_token: tokens.AccessToken,
      id_token: tokens.IdToken,
      refresh_token: tokens.RefreshToken,
      token_type: tokens.TokenType,
      user: {
        id: userId,
        email: body.email,
        system_role: isAdmin ? 'ADMIN' : 'PASSENGER',
        roles: [],
        permissions: []
      }
    });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({
  email: z.string().email(),
  refresh_token: z.string().min(1)
});

authRoutes.post('/admin/refresh', async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const cognitoRes = await adminRefreshTokens(body.email, body.refresh_token);
    const tokens = cognitoRes.AuthenticationResult;
    if (!tokens?.AccessToken) throw new UnauthorizedError('INVALID_COGNITO_RESPONSE');

    // IMPORTANT: We do not trust refresh as MFA proof. Admin routes still require `amr` contains "mfa".
    return res.status(200).json({
      access_token: tokens.AccessToken,
      id_token: tokens.IdToken,
      token_type: tokens.TokenType,
      expires_in: tokens.ExpiresIn
    });
  } catch (err) {
    next(err);
  }
});

// Logout expects an Access Token in Authorization header.
authRoutes.post('/admin/logout', async (req, res, next) => {
  try {
    const auth = req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedError('MISSING_BEARER_TOKEN');
    await globalSignOut(token);
    return res.status(200).json({ message: 'OK' });
  } catch (err) {
    next(err);
  }
});

function requireAccessToken(req: any) {
  if (!req.auth) throw new UnauthorizedError('UNAUTHORIZED');
  if (req.auth.tokenUse !== 'access') throw new UnauthorizedError('ACCESS_TOKEN_REQUIRED');
}

function isMfaEnabledFromGetUser(res: { UserMFASettingList?: string[]; PreferredMfaSetting?: string | null }) {
  const list = Array.isArray(res.UserMFASettingList) ? res.UserMFASettingList : [];
  const preferred = typeof res.PreferredMfaSetting === 'string' ? res.PreferredMfaSetting : '';
  if (preferred) return true;
  return list.length > 0;
}

function buildOtpAuthUri(params: { issuer: string; accountName: string; secret: string }) {
  const issuerEnc = encodeURIComponent(params.issuer);
  const label = `${params.issuer}:${params.accountName}`;
  const labelEnc = encodeURIComponent(label);
  const secretEnc = encodeURIComponent(params.secret);
  return `otpauth://totp/${labelEnc}?secret=${secretEnc}&issuer=${issuerEnc}`;
}

// Admin-only MFA enrollment endpoints (TOTP). These do NOT mint new JWTs.
authRoutes.post('/mfa/setup', authenticateJwt, requireGroup('Admin'), async (req, res, next) => {
  try {
    requireAccessToken(req);
    const accessToken = req.header('authorization')!.slice('Bearer '.length);

    const current = await getUserMfaSettings(accessToken);
    if (isMfaEnabledFromGetUser(current)) {
      throw new HttpError(409, 'MFA_ALREADY_ENABLED', { error: 'MFA_ALREADY_ENABLED' });
    }

    logger.info('mfa_setup_started', { sub: req.auth?.sub });

    const assoc = await startTotpSetup(accessToken);
    const secret = assoc.SecretCode;
    if (!secret) {
      throw new HttpError(502, 'COGNITO_INVALID_RESPONSE', { error: 'COGNITO_INVALID_RESPONSE' });
    }

    const rawUsername = req.auth?.rawClaims?.['cognito:username'];
    const accountName =
      (typeof req.auth?.email === 'string' && req.auth.email) ||
      (typeof rawUsername === 'string' && rawUsername) ||
      (typeof req.auth?.sub === 'string' && req.auth.sub) ||
      'admin';

    const qrCodeUri = buildOtpAuthUri({ issuer: 'RideAdmin', accountName, secret });

    return res.status(200).json({
      qr_code_uri: qrCodeUri,
      secret
    });
  } catch (err) {
    next(err);
  }
});

const mfaVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });
authRoutes.post('/mfa/verify', authenticateJwt, requireGroup('Admin'), async (req, res, next) => {
  try {
    requireAccessToken(req);
    const body = mfaVerifySchema.parse(req.body);
    const accessToken = req.header('authorization')!.slice('Bearer '.length);

    const current = await getUserMfaSettings(accessToken);
    if (isMfaEnabledFromGetUser(current)) {
      throw new HttpError(409, 'MFA_ALREADY_ENABLED', { error: 'MFA_ALREADY_ENABLED' });
    }

    try {
      await confirmTotpSetup({ accessToken, userCode: body.code });
      logger.info('mfa_verification_success', { sub: req.auth?.sub });
    } catch (e) {
      logger.warn('mfa_verification_failed', {
        sub: req.auth?.sub,
        name: e instanceof Error ? e.name : undefined
      });
      // Fail closed; map common Cognito errors to 400.
      throw new HttpError(400, 'INVALID_OTP', { error: 'INVALID_OTP' });
    }

    return res.status(200).json({
      status: 'MFA_ENABLED',
      next_action: 'RELOGIN_REQUIRED'
    });
  } catch (err) {
    next(err);
  }
});
