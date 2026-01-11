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

function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
  if (!raw) {
    throw new Error(
      'Missing NEXT_PUBLIC_AUTH_API_BASE_URL (e.g. https://api.example.com). This must be set at build time.'
    );
  }
  return raw.replace(/\/$/, '');
}

function buildApiUrl(path: string) {
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

function getStoredTokens(): { accessToken: string; refreshToken: string; expiresAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('d2_driver_tokens');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function refreshOnce(): Promise<boolean> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return false;

  const res = await fetch(`${getApiBaseUrl()}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.accessToken || !data?.refreshToken) {
    try {
      window.localStorage.removeItem('d2_driver_tokens');
    } catch {
      // ignore
    }
    return false;
  }

  try {
    window.localStorage.setItem('d2_driver_tokens', JSON.stringify(data));
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
    (body as any)?.message ??
    (body as any)?.error ??
    (typeof body === 'string' ? body : `Request failed (${res.status})`);

  if (res.status === 401) {
    // Centralized/global 401 handling for static site.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('d2_driver_tokens');
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
