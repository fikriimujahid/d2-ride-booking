import 'client-only';

import { getJwtUserType } from './jwt';
import { getAccessToken } from './tokenStore';

const DEFAULT_NEXT_PATH = '/app';

export function buildLoginHref(nextPath: string | null | undefined): string {
  const next = nextPath && nextPath.trim() ? nextPath : DEFAULT_NEXT_PATH;
  return `/login/?next=${encodeURIComponent(next)}`;
}

export function redirectToLoginClient(nextPath?: string): void {
  // Why: web_driver is deployed as a static site, so we cannot rely on middleware/server redirects.
  // We fail closed in the browser for protected routes and on API 401.
  if (typeof window === 'undefined') return;

  try {
    const next = nextPath ?? window.location.pathname ?? DEFAULT_NEXT_PATH;
    window.location.assign(buildLoginHref(next));
  } catch {
    // ignore
  }
}

export function isNonDriverAccessToken(token: string): boolean {
  // Defensive UX: backend owns authorization; we only avoid obvious cross-role confusion.
  const userType = getJwtUserType(token);
  return Boolean(userType && userType !== 'DRIVER');
}

export function shouldForceLogout(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  return isNonDriverAccessToken(token);
}
