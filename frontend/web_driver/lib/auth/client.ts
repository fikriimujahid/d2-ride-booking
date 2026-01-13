import 'client-only';

import { getPublicApiBaseUrl } from '../config/apiBaseUrl';
import { TokenResponseSchema, type TokenResponse } from './token';

export type LoginResult = { ok: true } | { ok: false; status: number; message: string };

const storageKeys = {
  tokens: 'd2_driver_tokens',
} as const;

function parseTokenResponse(value: unknown): TokenResponse | null {
  const parsed = TokenResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message) return d.message;
    if (Array.isArray(d.message)) {
      const joined = d.message.filter((x): x is string => typeof x === 'string').join('\n');
      if (joined) return joined;
    }

    const err = d.error;
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (typeof e.message === 'string' && e.message) return e.message;
    }

    if (typeof err === 'string' && err) return err;
  }
  return fallback;
}

function readTokens(): TokenResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKeys.tokens);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseTokenResponse(parsed);
  } catch {
    return null;
  }
}

function writeTokens(tokens: TokenResponse) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKeys.tokens, JSON.stringify(tokens));
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(storageKeys.tokens);
}

export function getAccessToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readTokens()?.refreshToken ?? null;
}

export async function refreshDriverSession(): Promise<{ ok: true } | { ok: false; status: number; message: string }>
{
  const refreshToken = getRefreshToken();
  if (!refreshToken) return { ok: false, status: 401, message: 'No session' };

  const res = await fetch(`${getPublicApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    clearAuthTokens();
    return {
      ok: false,
      status: res.status,
      message: extractErrorMessage(data, 'Refresh failed'),
    };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) {
    clearAuthTokens();
    return { ok: false, status: 500, message: 'Invalid token response' };
  }
  writeTokens(tokens);
  return { ok: true };
}

export async function driverLogin(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${getPublicApiBaseUrl()}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    clearAuthTokens();
    return {
      ok: false,
      status: res.status,
      message: extractErrorMessage(data, 'Login failed'),
    };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) {
    clearAuthTokens();
    return { ok: false, status: 500, message: 'Invalid token response' };
  }
  writeTokens(tokens);
  return { ok: true };
}

export async function driverLogout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearAuthTokens();

  if (!refreshToken) return;

  // Best-effort logout; the token is already cleared client-side.
  await fetch(`${getPublicApiBaseUrl()}/driver/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);
}

export async function getSession(): Promise<{ authenticated: boolean }> {
  const tokens = readTokens();
  if (!tokens) return { authenticated: false };

  // If the refresh token is expired, clear locally.
  const refreshExpiresAt = new Date(tokens.expiresAt).getTime();
  if (!Number.isFinite(refreshExpiresAt) || refreshExpiresAt <= Date.now()) {
    clearAuthTokens();
    return { authenticated: false };
  }

  return { authenticated: true };
}
