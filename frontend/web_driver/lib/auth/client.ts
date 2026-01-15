import 'client-only';

// Compatibility layer: older code imports from `lib/auth/client`.
// New code should prefer `auth.store.ts` + `auth.guard.ts` + `tokenStore.ts`.

import type { LoginResult } from './auth.store';
import * as authStore from './auth.store';
import * as tokenStore from './tokenStore';

export type { LoginResult };

export function clearAuthTokens() {
  tokenStore.clearTokens();
}

export function getAccessToken(): string | null {
  return tokenStore.getAccessToken();
}

export function getRefreshToken(): string | null {
  return tokenStore.getRefreshToken();
}

export async function refreshDriverSession(): Promise<{ ok: true } | { ok: false; status: number; message: string }>
{
  return authStore.refreshSession();
}

export async function driverLogin(email: string, password: string): Promise<LoginResult> {
  return authStore.loginWithPassword(email, password);
}

export async function driverLogout(): Promise<void> {
  await authStore.logoutBestEffort();
}

export async function getSession(): Promise<{ authenticated: boolean }> {
  return authStore.getSession();
}
