import 'client-only';

import { getPublicApiBaseUrl } from '../config/apiBaseUrl';
import { TokenResponseSchema, type TokenResponse } from './token';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

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

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function parseTokenResponse(value: unknown): TokenResponse | null {
  const parsed = TokenResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loginWithPassword(opts: {
  email: string;
  password: string;
}): Promise<ApiResult<TokenResponse>> {
  const res = await fetch(`${getPublicApiBaseUrl()}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });

  const data = await parseJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: extractErrorMessage(data, 'Login failed') };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) return { ok: false, status: 500, message: 'Invalid token response' };
  return { ok: true, data: tokens };
}

export async function refreshWithToken(refreshToken: string): Promise<ApiResult<TokenResponse>> {
  const res = await fetch(`${getPublicApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await parseJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, message: extractErrorMessage(data, 'Refresh failed') };
  }

  const tokens = parseTokenResponse(data);
  if (!tokens) return { ok: false, status: 500, message: 'Invalid token response' };
  return { ok: true, data: tokens };
}

export async function logoutWithToken(refreshToken: string): Promise<void> {
  // Best-effort logout. We already clear local session before calling this.
  await fetch(`${getPublicApiBaseUrl()}/driver/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);
}
