import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { authCookies, authCookieOptions, ACCESS_TOKEN_MAX_AGE_SECONDS } from './cookies';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
};

function getAuthApiBaseUrl() {
  const raw = process.env.AUTH_API_BASE_URL;
  if (!raw) {
    throw new Error('Missing AUTH_API_BASE_URL (e.g. http://localhost:3000)');
  }
  return raw.replace(/\/$/, '');
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

export async function backendDriverLogin(opts: { identifier: string; password: string }) {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? 'Login failed';
    return { ok: false as const, status: res.status, message };
  }

  return { ok: true as const, tokens: data as TokenResponse };
}

export async function backendDriverRefresh(refreshToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? 'Refresh failed';
    return { ok: false as const, status: res.status, message };
  }

  return { ok: true as const, tokens: data as TokenResponse };
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
