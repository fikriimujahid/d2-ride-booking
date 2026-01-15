import 'client-only';

import { TokenResponseSchema, type TokenResponse } from './token';

const STORAGE_KEY = 'd2_driver_tokens' as const;

function parseTokenResponse(value: unknown): TokenResponse | null {
  const parsed = TokenResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readTokens(): TokenResponse | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return parseTokenResponse(parsed);
  } catch {
    return null;
  }
}

export function writeTokens(tokens: TokenResponse): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readTokens()?.refreshToken ?? null;
}

export function hasValidRefreshSession(): boolean {
  const tokens = readTokens();
  if (!tokens) return false;

  const refreshExpiresAt = new Date(tokens.expiresAt).getTime();
  if (!Number.isFinite(refreshExpiresAt)) return false;

  return refreshExpiresAt > Date.now();
}
