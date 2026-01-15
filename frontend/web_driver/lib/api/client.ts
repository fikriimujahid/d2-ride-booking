import 'client-only';

import { getPublicApiBaseUrl } from '../config/apiBaseUrl';
import type { z } from 'zod';
import { redirectToLoginClient } from '../auth/auth.guard';
import * as authStore from '../auth/auth.store';
import { clearTokens, getAccessToken } from '../auth/tokenStore';

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
export class NetworkError extends ApiError {}

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

async function doFetch(url: string, init: ApiFetchInit) {
  const headers = new Headers(init.headers ?? {});

  // Ensure we default to JSON when sending bodies.
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const accessToken = getAccessToken();
  if (accessToken && init.auth !== false) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    return await fetch(url, { ...init, headers });
  } catch {
    throw new NetworkError('Network error', 0, null);
  }
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const url = buildApiUrl(path);

  let res = await doFetch(url, init);

  // Try refresh once on 401 and retry.
  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await authStore.refreshSession();
    if (refreshed.ok) res = await doFetch(url, init);
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
      clearTokens();
      redirectToLoginClient();
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
