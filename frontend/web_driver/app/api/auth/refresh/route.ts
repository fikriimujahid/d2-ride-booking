import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  applyClearAuthCookies,
  backendDriverRefresh,
  readRefreshTokenCookie,
} from '@/lib/auth/server';

export async function POST() {
  const refreshToken = await readRefreshTokenCookie();
  if (!refreshToken) {
    const res = NextResponse.json({ error: 'NO_SESSION' }, { status: 401 });
    applyClearAuthCookies(res);
    return res;
  }

  const result = await backendDriverRefresh(refreshToken);
  if (!result.ok) {
    const res = NextResponse.json(
      { error: 'REFRESH_FAILED', message: result.message },
      { status: result.status }
    );
    applyClearAuthCookies(res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applyAuthCookies(res, result.tokens);
  return res;
}
