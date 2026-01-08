import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { AUTH_COOKIES } from "@/lib/auth/cookies"
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/tokenStore"
import { passengerRefresh } from "@/lib/auth/upstream"

export async function POST() {
  const store = await cookies()
  const refreshToken = store.get(AUTH_COOKIES.refreshToken)?.value
  if (!refreshToken) {
    await clearAuthCookies()
    return NextResponse.json({ message: "Missing refresh token" }, { status: 401 })
  }

  const { res: upstream, payload } = await passengerRefresh({ refreshToken })
  if (!upstream.ok) {
    await clearAuthCookies()
    return NextResponse.json(payload ?? { message: "Refresh failed" }, { status: upstream.status })
  }

  const accessToken = (payload as any)?.accessToken
  const newRefreshToken = (payload as any)?.refreshToken
  if (typeof accessToken !== "string" || typeof newRefreshToken !== "string") {
    await clearAuthCookies()
    return NextResponse.json({ message: "Invalid refresh response" }, { status: 502 })
  }

  await setAuthCookies({ accessToken, refreshToken: newRefreshToken })
  return NextResponse.json({ ok: true })
}
