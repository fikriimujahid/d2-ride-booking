import { NextResponse, type NextRequest } from "next/server"

const REFRESH_COOKIE = "rg_rt"

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/app")
}

function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register"
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const hasRefresh = Boolean(req.cookies.get(REFRESH_COOKIE)?.value)

  if (isProtectedPath(pathname) && !hasRefresh) {
    const next = encodeURIComponent(pathname + search)
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${next}`
    return NextResponse.redirect(url)
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
