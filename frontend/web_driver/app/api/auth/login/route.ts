import { NextResponse } from 'next/server';
import { applyAuthCookies, applyClearAuthCookies, backendDriverLogin } from '@/lib/auth/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const identifier = String(body?.identifier ?? '').trim();
  const password = String(body?.password ?? '');

  if (identifier.length < 3 || password.length < 8) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid identifier or password' },
      { status: 400 }
    );
  }

  const result = await backendDriverLogin({ identifier, password });

  if (!result.ok) {
    const res = NextResponse.json(
      { error: 'LOGIN_FAILED', message: result.message },
      { status: result.status }
    );
    applyClearAuthCookies(res);
    return res;
  }

  // Tokens are stored server-side in httpOnly cookies.
  const res = NextResponse.json({ ok: true });
  applyAuthCookies(res, result.tokens);
  return res;
}
