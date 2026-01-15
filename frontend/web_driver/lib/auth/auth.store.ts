import 'client-only';

import * as authApi from './auth.api';
import * as tokenStore from './tokenStore';
import { getJwtUserType } from './jwt';

export type LoginResult = { ok: true } | { ok: false; status: number; message: string };

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  try {
    const result = await authApi.loginWithPassword({ email, password });
    if (!result.ok) {
      tokenStore.clearTokens();
      return result;
    }

    // Defensive UX check: backend is still the source of truth for authz.
    const userType = getJwtUserType(result.data.accessToken);
    if (userType && userType !== 'DRIVER') {
      tokenStore.clearTokens();
      return { ok: false, status: 403, message: 'This account is not a driver.' };
    }

    tokenStore.writeTokens(result.data);
    return { ok: true };
  } catch {
    tokenStore.clearTokens();
    return { ok: false, status: 0, message: 'Network error. Please try again.' };
  }
}

export async function refreshSession(): Promise<{ ok: true } | { ok: false; status: number; message: string }>
{
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return { ok: false, status: 401, message: 'No session' };

  try {
    const result = await authApi.refreshWithToken(refreshToken);
    if (!result.ok) {
      tokenStore.clearTokens();
      return result;
    }

    const userType = getJwtUserType(result.data.accessToken);
    if (userType && userType !== 'DRIVER') {
      tokenStore.clearTokens();
      return { ok: false, status: 403, message: 'This account is not a driver.' };
    }

    tokenStore.writeTokens(result.data);
    return { ok: true };
  } catch {
    tokenStore.clearTokens();
    return { ok: false, status: 0, message: 'Network error. Please try again.' };
  }
}

export async function logoutBestEffort(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  tokenStore.clearTokens();
  if (!refreshToken) return;
  await authApi.logoutWithToken(refreshToken);
}

export function getSession(): { authenticated: boolean } {
  if (!tokenStore.hasValidRefreshSession()) {
    tokenStore.clearTokens();
    return { authenticated: false };
  }

  return { authenticated: true };
}
