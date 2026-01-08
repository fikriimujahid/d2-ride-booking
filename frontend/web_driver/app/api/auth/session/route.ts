import { NextResponse } from 'next/server';
import { readAccessTokenCookie, readRefreshTokenCookie } from '@/lib/auth/server';

export async function GET() {
  const [at, rt] = await Promise.all([readAccessTokenCookie(), readRefreshTokenCookie()]);
  const hasSession = Boolean(at || rt);
  return NextResponse.json({ authenticated: hasSession });
}
