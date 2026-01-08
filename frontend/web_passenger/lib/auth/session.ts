import { cookies } from "next/headers"
import { AUTH_COOKIES } from "./cookies"
import { getJwtUserType, decodeJwtPayload } from "./jwt"

export type PassengerSession = {
  accessToken: string
  refreshToken?: string
  userId?: string
  userType: "PASSENGER"
}

export async function getPassengerSession(): Promise<PassengerSession | null> {
  const store = await cookies()
  const accessToken = store.get(AUTH_COOKIES.accessToken)?.value
  if (!accessToken) return null

  const userType = getJwtUserType(accessToken)
  if (userType !== "PASSENGER") return null

  let userId: string | undefined
  try {
    const payload = decodeJwtPayload(accessToken)
    const sub = payload["sub"]
    if (typeof sub === "string") userId = sub
  } catch {
    // ignore
  }

  return {
    accessToken,
    refreshToken: store.get(AUTH_COOKIES.refreshToken)?.value,
    userId,
    userType: "PASSENGER",
  }
}
