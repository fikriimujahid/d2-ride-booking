import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { authCookies, authCookieOptions, ACCESS_TOKEN_MAX_AGE_SECONDS } from './cookies';
import { getServerApiBaseUrl } from '../config/apiBaseUrl';
import { TokenResponseSchema, type TokenResponse } from './token';

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

function getAuthApiBaseUrl() {
  return getServerApiBaseUrl();
}

export function readAccessTokenCookie() {
  return cookies().then((jar) => jar.get(authCookies.accessToken)?.value ?? null);
}

export function readRefreshTokenCookie() {
  return cookies().then((jar) => jar.get(authCookies.refreshToken)?.value ?? null);
}

export function applyClearAuthCookies(res: NextResponse) {
  res.cookies.set(authCookies.accessToken, '', {
    ...authCookieOptions,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  res.cookies.set(authCookies.refreshToken, '', {
    ...authCookieOptions,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}

export function applyAuthCookies(res: NextResponse, tokens: TokenResponse) {
  res.cookies.set(authCookies.accessToken, tokens.accessToken, {
    ...authCookieOptions,
    secure: process.env.NODE_ENV === 'production',
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  const refreshMaxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(tokens.expiresAt).getTime() - Date.now()) / 1000)
  );

  res.cookies.set(authCookies.refreshToken, tokens.refreshToken, {
    ...authCookieOptions,
    secure: process.env.NODE_ENV === 'production',
    maxAge: refreshMaxAgeSeconds,
  });
}

export async function backendDriverLogin(opts: { email: string; password: string }) {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = extractErrorMessage(data, 'Login failed');
    return { ok: false as const, status: res.status, message };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) return { ok: false as const, status: 500, message: 'Invalid token response' };
  return { ok: true as const, tokens };
}

export async function backendDriverRefresh(refreshToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = extractErrorMessage(data, 'Refresh failed');
    return { ok: false as const, status: res.status, message };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) return { ok: false as const, status: 500, message: 'Invalid token response' };
  return { ok: true as const, tokens };
}

export async function backendDriverLogout(refreshToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    // Best-effort logout; we still clear cookies.
    return { ok: false as const, status: res.status };
  }

  return { ok: true as const };
}

export function getAuthApiBaseUrlForProxy() {
  return getAuthApiBaseUrl();
}
