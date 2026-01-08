import { NextResponse } from 'next/server';
import { applyClearAuthCookies, backendDriverLogout, readRefreshTokenCookie } from '@/lib/auth/server';

export async function POST() {
  const refreshToken = await readRefreshTokenCookie();

  if (refreshToken) {
    await backendDriverLogout(refreshToken);
  }

  const res = NextResponse.json({ ok: true });
  applyClearAuthCookies(res);
  return res;
}
