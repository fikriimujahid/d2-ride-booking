import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { AUTH_COOKIES } from "@/lib/auth/cookies"
import { clearAuthCookies } from "@/lib/auth/tokenStore"
import { passengerLogout } from "@/lib/auth/upstream"

export async function POST() {
  const store = await cookies()
  const refreshToken = store.get(AUTH_COOKIES.refreshToken)?.value

  if (refreshToken) {
    await passengerLogout({ refreshToken })
  }

  await clearAuthCookies()
  return NextResponse.json({ ok: true })
}
