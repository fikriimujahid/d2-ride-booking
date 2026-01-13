import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/tokenStore"
import { TokenResponseSchema } from "@/lib/auth/schemas"
import { passengerLogin } from "@/lib/auth/upstream"

export async function POST(req: NextRequest) {
  const BodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  const bodyParsed = BodySchema.safeParse(bodyRaw)
  if (!bodyParsed.success) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }

  const body = bodyParsed.data

  const { res: upstream, payload } = await passengerLogin({
    email: body.email,
    password: body.password,
  })

  if (!upstream.ok) {
    await clearAuthCookies()
    return NextResponse.json(payload ?? { message: "Login failed" }, { status: upstream.status })
  }

  const tokenParsed = TokenResponseSchema.safeParse(payload)
  if (!tokenParsed.success) {
    await clearAuthCookies()
    return NextResponse.json({ message: "Invalid auth response" }, { status: 502 })
  }

  const { accessToken, refreshToken } = tokenParsed.data

  try {
    await setAuthCookies({ accessToken, refreshToken })
  } catch (e) {
    await clearAuthCookies()
    return NextResponse.json({ message: (e as Error).message }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
