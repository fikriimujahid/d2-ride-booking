import { cookies } from "next/headers"
import { AUTH_COOKIES } from "./cookies"
import { getJwtExpSeconds, getJwtUserType } from "./jwt"

type TokenPair = {
  accessToken: string
  refreshToken: string
}

function isProd() {
  return process.env.NODE_ENV === "production"
}

export async function setAuthCookies(tokens: TokenPair) {
  const store = await cookies()

  const userType = getJwtUserType(tokens.accessToken)
  if (userType !== "PASSENGER") {
    await clearAuthCookies()
    throw new Error("Only PASSENGER users are allowed")
  }

  const expSeconds = getJwtExpSeconds(tokens.accessToken)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const accessMaxAge = expSeconds ? Math.max(0, expSeconds - nowSeconds) : 15 * 60

  store.set(AUTH_COOKIES.accessToken, tokens.accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  })

  store.set(AUTH_COOKIES.refreshToken, tokens.refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  })
}

export async function clearAuthCookies() {
  const store = await cookies()
  store.set(AUTH_COOKIES.accessToken, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  store.set(AUTH_COOKIES.refreshToken, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
