import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { AUTH_COOKIES } from "@/lib/auth/cookies"
import { clearAuthCookies } from "@/lib/auth/tokenStore"
import { passengerRefresh } from "@/lib/auth/upstream"

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

async function rotateTokens() {
  const store = await cookies()
  const refreshToken = store.get(AUTH_COOKIES.refreshToken)?.value
  if (!refreshToken) return false

  const { res: upstream, payload } = await passengerRefresh({ refreshToken })
  if (!upstream.ok) return false

  const accessToken = (payload as any)?.accessToken
  const newRefreshToken = (payload as any)?.refreshToken
  if (typeof accessToken !== "string" || typeof newRefreshToken !== "string") return false

  const { setAuthCookies } = await import("@/lib/auth/tokenStore")
  await setAuthCookies({ accessToken, refreshToken: newRefreshToken })
  return true
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const baseUrl = process.env.BACKEND_API_BASE_URL ?? process.env.AUTH_API_BASE_URL
  if (!baseUrl) {
    return NextResponse.json(
      { message: "Missing BACKEND_API_BASE_URL (or AUTH_API_BASE_URL as fallback)" },
      { status: 500 }
    )
  }

  const method = req.method.toUpperCase()
  if (!SUPPORTED_METHODS.includes(method as any)) {
    return NextResponse.json({ message: "Method not allowed" }, { status: 405 })
  }

  const store = await cookies()
  const accessToken = store.get(AUTH_COOKIES.accessToken)?.value
  if (!accessToken) {
    await clearAuthCookies()
    return NextResponse.json({ message: "Missing access token" }, { status: 401 })
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${params.path.join("/")}`)
  url.search = req.nextUrl.search

  const hasBody = method !== "GET" && method !== "HEAD"
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
    const body = await upstream.json().catch(() => ({}))
    return NextResponse.json(body as any, { status: upstream.status })
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
