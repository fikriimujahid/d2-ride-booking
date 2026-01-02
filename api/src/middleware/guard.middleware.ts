import type { RequestHandler } from 'express';
import { ApiError, UnauthorizedError } from '../models/error.model.js';
import type { SystemGroup } from '../models/auth.model.js';
import { getUserMfaSettings } from '../services/cognito.service.js';

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function isMfaEnabledFromGetUser(res: { UserMFASettingList?: string[]; PreferredMfaSetting?: string | null }) {
  const list = Array.isArray(res.UserMFASettingList) ? res.UserMFASettingList : [];
  const preferred = typeof res.PreferredMfaSetting === 'string' ? res.PreferredMfaSetting : '';
  if (preferred) return true;
  return list.length > 0;
}

export function requireGroup(group: SystemGroup): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new UnauthorizedError('UNAUTHORIZED'));
    if (!req.auth.groups.includes(group)) {
      return next(
        new ApiError({
          status: 403,
          code: 'AUTH_FORBIDDEN',
          message: 'You do not have access to this resource.',
          details: {
            required_group: group
          }
        })
      );
    }
    next();
  };
}

export const requireAdminMfa: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new UnauthorizedError('UNAUTHORIZED'));

  const isAdmin = req.auth.groups.includes('Admin');
  if (!isAdmin) return next();

  const hasMfa = req.auth.amr.includes('mfa');
  if (!hasMfa) {
    // Optional enrichment (non-sensitive): infer whether MFA is enrolled.
    // If we can't determine, we still return the deterministic MFA_REQUIRED response.
    const authz = req.header('authorization');
    const token = parseBearerToken(authz);

    const details: Record<string, unknown> = {
      required_amr: 'mfa',
      is_admin: true
    };

    const maybeEnrich = async () => {
      try {
        if (token && req.auth?.tokenUse === 'access') {
          const current = await getUserMfaSettings(token);
          details.mfa_enrolled = isMfaEnabledFromGetUser(current);
        }
      } catch {
        // Ignore enrichment failures.
      }
    };

    void maybeEnrich().finally(() => {
      return next(
        new ApiError({
          status: 403,
          code: 'MFA_REQUIRED',
          message: 'Multi-factor authentication is required for admin access.',
          action: 'SETUP_MFA',
          details
        })
      );
    });
    return;
  }

  next();
};
