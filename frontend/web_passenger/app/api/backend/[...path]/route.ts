import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { AUTH_COOKIES } from "@/lib/auth/cookies"
import { clearAuthCookies } from "@/lib/auth/tokenStore"
import { TokenResponseSchema } from "@/lib/auth/schemas"
import { passengerRefresh } from "@/lib/auth/upstream"
import { getJwtUserType } from "@/lib/auth/jwt"
import { getServerApiBaseUrl } from "@/lib/config/apiBaseUrl"

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
type SupportedMethod = (typeof SUPPORTED_METHODS)[number]

function isSupportedMethod(method: string): method is SupportedMethod {
  return (SUPPORTED_METHODS as readonly string[]).includes(method)
}

async function rotateTokens() {
  const store = await cookies()
  const refreshToken = store.get(AUTH_COOKIES.refreshToken)?.value
  if (!refreshToken) return false

  const { res: upstream, payload } = await passengerRefresh({ refreshToken })
  if (!upstream.ok) return false

  const tokenParsed = TokenResponseSchema.safeParse(payload)
  if (!tokenParsed.success) return false

  const { accessToken, refreshToken: newRefreshToken } = tokenParsed.data

  const { setAuthCookies } = await import("@/lib/auth/tokenStore")
  await setAuthCookies({ accessToken, refreshToken: newRefreshToken })
  return true
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  let baseUrl: string
  try {
    baseUrl = getServerApiBaseUrl()
  } catch (err) {
    const message = err instanceof Error ? err.message : "Missing API base URL"
    return NextResponse.json({ message }, { status: 500 })
  }

  const method = req.method.toUpperCase()
  if (!isSupportedMethod(method)) {
    return NextResponse.json({ message: "Method not allowed" }, { status: 405 })
  }

  const store = await cookies()
  const accessToken = store.get(AUTH_COOKIES.accessToken)?.value
  if (!accessToken) {
    await clearAuthCookies()
    return NextResponse.json({ message: "Missing access token" }, { status: 401 })
  }

  // Defensive: ensure this proxy is only used with PASSENGER tokens.
  // Backend remains the source of truth for authorization.
  try {
    const role = getJwtUserType(accessToken)
    if (role && role !== "PASSENGER") {
      await clearAuthCookies()
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  } catch {
    // If token can't be decoded, treat as unauthorized and clear cookies.
    await clearAuthCookies()
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${params.path.join("/")}`)
  url.search = req.nextUrl.search

  const hasBody = method !== "GET"
  const bodyText = hasBody ? await req.text() : undefined

  const makeUpstream = async (token: string) => {
    const headers = new Headers(req.headers)
    headers.set("authorization", `Bearer ${token}`)
    headers.delete("cookie")
    headers.delete("host")

    return fetch(url.toString(), {
      method,
      headers,
      body: bodyText,
    })
  }

  let upstream = await makeUpstream(accessToken)

  if (upstream.status === 401) {
    const refreshed = await rotateTokens()
    if (!refreshed) {
      await clearAuthCookies()
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const storeAfterRefresh = await cookies()
    const newAccessToken = storeAfterRefresh.get(AUTH_COOKIES.accessToken)?.value
    if (!newAccessToken) {
      await clearAuthCookies()
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    upstream = await makeUpstream(newAccessToken)
  }

  if (upstream.status === 401) {
    await clearAuthCookies()
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body: unknown = await upstream.json().catch(() => ({}))
    return NextResponse.json(body, { status: upstream.status })
  }

  const body = await upstream.text()
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type": contentType || "text/plain",
    },
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params)
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params)
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params)
}
