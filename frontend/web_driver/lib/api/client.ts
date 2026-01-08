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

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const url = path.startsWith('/') ? `/api/backend${path}` : `/api/backend/${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      // Ensure we default to JSON when sending bodies.
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (res.ok) return (await parseResponseBody(res)) as T;

  const body = await parseResponseBody(res);
  const message =
    (body as any)?.message ??
    (body as any)?.error ??
    (typeof body === 'string' ? body : `Request failed (${res.status})`);

  if (res.status === 401) {
    // Centralized/global 401 handling for client-side requests.
    // Server-side rendering is protected via middleware + backend auth enforcement.
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore
      }
      // Preserve a minimal return path; avoid leaking query string content.
      const next = window.location.pathname || '/app';
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    throw new AuthError(message, 401, body);
  }

  if (res.status === 403) throw new ForbiddenError(message, 403, body);
  throw new ApiError(message, res.status, body);
}
