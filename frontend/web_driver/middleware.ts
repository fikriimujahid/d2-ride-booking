import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ACCESS_COOKIE = 'd2_driver_at';
const REFRESH_COOKIE = 'd2_driver_rt';

function hasSession(req: NextRequest) {
  return Boolean(req.cookies.get(ACCESS_COOKIE)?.value || req.cookies.get(REFRESH_COOKIE)?.value);
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Protect the driver dashboard routes
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (!hasSession(req)) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname + (searchParams.toString() ? `?${searchParams}` : ''));
      return NextResponse.redirect(url);
    }
  }

  // If already authenticated, keep users out of /login
  if (pathname === '/login' && hasSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login'],
};
