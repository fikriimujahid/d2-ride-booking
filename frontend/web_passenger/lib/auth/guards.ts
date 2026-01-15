import type { NextRequest } from "next/server";
import { AUTH_COOKIES } from "./cookies";
import { getJwtUserType } from "./jwt";

/**
 * Route-guard utilities.
 *
 * IMPORTANT:
 * - These guards are UX-only.
 * - Backend authorization is still mandatory for every request.
 */

export function isProtectedPath(pathname: string) {
  return pathname.startsWith("/app");
}

export function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function buildLoginRedirect(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const next = encodeURIComponent(pathname + search);
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${next}`;
  return url;
}

/**
 * Passenger-only enforcement.
 *
 * We only *reject* if an access token exists and clearly belongs to a different role.
 * If the access token is missing/expired but refresh token exists, we allow the request
 * and let the API proxy rotate tokens on demand.
 */
export function isNonPassengerAccessToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const role = getJwtUserType(token);
    return role !== null && role !== "PASSENGER";
  } catch {
    // If token can't be decoded, don't block here (fail-closed happens at API calls).
    return false;
  }
}

export function getAuthCookiesFromRequest(req: NextRequest): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: req.cookies.get(AUTH_COOKIES.accessToken)?.value,
    refreshToken: req.cookies.get(AUTH_COOKIES.refreshToken)?.value,
  };
}

export function getLoginNextFromWindow(): string {
  if (typeof window === "undefined") return "";
  return encodeURIComponent(window.location.pathname + window.location.search);
}

export function redirectToLoginClient(): void {
  if (typeof window === "undefined") return;
  const next = getLoginNextFromWindow();
  window.location.href = `/login${next ? `?next=${next}` : ""}`;
}
