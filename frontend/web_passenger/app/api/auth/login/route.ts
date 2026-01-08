import { NextResponse, type NextRequest } from "next/server"
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/tokenStore"
import { passengerLogin } from "@/lib/auth/upstream"

export async function POST(req: NextRequest) {
  let body: { identifier?: string; password?: string }
  try {
    body = (await req.json()) as { identifier?: string; password?: string }
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  if (!body.identifier || !body.password) {
    return NextResponse.json({ message: "Missing identifier or password" }, { status: 400 })
  }

  const { res: upstream, payload } = await passengerLogin({
    identifier: body.identifier,
    password: body.password,
  })

  if (!upstream.ok) {
    await clearAuthCookies()
    return NextResponse.json(payload ?? { message: "Login failed" }, { status: upstream.status })
  }

  const accessToken = (payload as any)?.accessToken
  const refreshToken = (payload as any)?.refreshToken

  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    await clearAuthCookies()
    return NextResponse.json({ message: "Invalid auth response" }, { status: 502 })
  }

  try {
    await setAuthCookies({ accessToken, refreshToken })
  } catch (e) {
    await clearAuthCookies()
    return NextResponse.json({ message: (e as Error).message }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
