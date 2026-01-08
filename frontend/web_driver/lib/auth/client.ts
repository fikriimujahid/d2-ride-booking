export type LoginResult = { ok: true } | { ok: false; status: number; message: string };

export async function driverLogin(identifier: string, password: string): Promise<LoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  if (res.ok) return { ok: true };

  const data = await res.json().catch(() => null);
  return {
    ok: false,
    status: res.status,
    message: data?.message ?? data?.error ?? 'Login failed',
  };
}

export async function driverLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function getSession(): Promise<{ authenticated: boolean }> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!res.ok) return { authenticated: false };
  return res.json();
}
