type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
};

export type LoginResult = { ok: true } | { ok: false; status: number; message: string };

const storageKeys = {
  tokens: 'd2_driver_tokens',
} as const;

function getAuthApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
  if (!raw) {
    throw new Error(
      'Missing NEXT_PUBLIC_AUTH_API_BASE_URL (e.g. https://api.example.com). This must be set at build time.'
    );
  }
  return raw.replace(/\/$/, '');
}

function readTokens(): TokenResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKeys.tokens);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenResponse;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTokens(tokens: TokenResponse) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKeys.tokens, JSON.stringify(tokens));
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKeys.tokens);
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

  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/refresh`, {
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
      message: data?.message ?? data?.error ?? 'Refresh failed',
    };
  }

  writeTokens(data as TokenResponse);
  return { ok: true };
}

export async function driverLogin(identifier: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${getAuthApiBaseUrl()}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    clearAuthTokens();
    return {
      ok: false,
      status: res.status,
      message: data?.message ?? data?.error ?? 'Login failed',
    };
  }

  writeTokens(data as TokenResponse);
  return { ok: true };
}

export async function driverLogout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearAuthTokens();

  if (!refreshToken) return;

  // Best-effort logout; the token is already cleared client-side.
  await fetch(`${getAuthApiBaseUrl()}/driver/auth/logout`, {
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
