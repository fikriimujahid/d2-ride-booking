import 'client-only';

import { getPublicApiBaseUrl } from '../config/apiBaseUrl';
import type { z } from 'zod';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class AuthError extends ApiError {}
export class ForbiddenError extends ApiError {}

type ApiFetchInit = RequestInit & {
  auth?: boolean;
};

async function parseResponseBody(res: Response) {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json().catch(() => null);
  return res.text().catch(() => null);
}

function buildApiUrl(path: string) {
  const base = getPublicApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

function getStoredTokens(): { accessToken: string; refreshToken: string; expiresAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('d2_driver_tokens');
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.accessToken !== 'string' || typeof p.refreshToken !== 'string' || typeof p.expiresAt !== 'string') {
      return null;
    }
    return { accessToken: p.accessToken, refreshToken: p.refreshToken, expiresAt: p.expiresAt };
  } catch {
    return null;
  }
}

async function refreshOnce(): Promise<boolean> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return false;

  const res = await fetch(`${getPublicApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.accessToken || !data?.refreshToken) {
    try {
      window.sessionStorage.removeItem('d2_driver_tokens');
    } catch {
      // ignore
    }
    return false;
  }

  try {
    window.sessionStorage.setItem('d2_driver_tokens', JSON.stringify(data));
  } catch {
    // ignore
  }
  return true;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  try {
    const next = window.location.pathname || '/app';
    window.location.assign(`/login/?next=${encodeURIComponent(next)}`);
  } catch {
    // ignore
  }
}

async function doFetch(url: string, init: ApiFetchInit) {
  const tokens = getStoredTokens();
  const headers = new Headers(init.headers ?? {});

  // Ensure we default to JSON when sending bodies.
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (tokens?.accessToken && init.auth !== false) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  return fetch(url, { ...init, headers });
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const url = buildApiUrl(path);

  let res = await doFetch(url, init);

  // Try refresh once on 401 and retry.
  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await refreshOnce();
    if (refreshed) res = await doFetch(url, init);
  }

  if (res.ok) return (await parseResponseBody(res)) as T;

  const body = await parseResponseBody(res);
  const message =
    ((): string => {
      const b: unknown = body;
      if (typeof b === 'string' && b.trim()) return b;
      if (b && typeof b === 'object') {
        const obj = b as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message) return obj.message;
        if (Array.isArray(obj.message)) {
          const joined = obj.message.filter((x): x is string => typeof x === 'string').join('\n');
          if (joined) return joined;
        }
        const err = obj.error;
        if (err && typeof err === 'object') {
          const e = err as Record<string, unknown>;
          if (typeof e.message === 'string' && e.message) return e.message;
        }
        if (typeof err === 'string' && err) return err;
      }
      return `Request failed (${res.status})`;
    })();

  if (res.status === 401) {
    // Centralized/global 401 handling for static site.
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem('d2_driver_tokens');
      } catch {
        // ignore
      }
      redirectToLogin();
    }
    throw new AuthError(message, 401, body);
  }

  if (res.status === 403) throw new ForbiddenError(message, 403, body);
  throw new ApiError(message, res.status, body);
}

export async function apiFetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init: ApiFetchInit = {},
): Promise<T> {
  const body: unknown = await apiFetch<unknown>(path, init);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('Invalid API response shape', 500, {
      issues: parsed.error.issues,
      body,
    });
  }
  return parsed.data;
}
