import { NextResponse, type NextRequest } from "next/server"
import { getAuthCookiesFromRequest, isAuthPage, isNonPassengerAccessToken, isProtectedPath, buildLoginRedirect } from "@/lib/auth/guards"

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const { accessToken, refreshToken } = getAuthCookiesFromRequest(req)
  const hasRefresh = Boolean(refreshToken)

  // Passenger-only enforcement (defensive).
  if (isNonPassengerAccessToken(accessToken)) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    const res = NextResponse.redirect(url)
    // Clear potentially invalid cookies.
    res.cookies.set("rg_at", "", { path: "/", maxAge: 0 })
    res.cookies.set("rg_rt", "", { path: "/", maxAge: 0 })
    return res
  }

  if (isProtectedPath(pathname) && !hasRefresh) {
    return NextResponse.redirect(buildLoginRedirect(req))
  }

  if (isAuthPage(pathname) && hasRefresh) {
    const url = req.nextUrl.clone()
    url.pathname = "/app/book"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
}
