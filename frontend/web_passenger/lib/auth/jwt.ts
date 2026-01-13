import { z } from "zod"

const JwtPayloadSchema = z.record(z.string(), z.unknown())
export type JwtPayload = z.infer<typeof JwtPayloadSchema>

export type UserRole = "ADMIN" | "DRIVER" | "PASSENGER"

function base64UrlDecodeToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4
  const padded = pad === 0 ? normalized : normalized + "=".repeat(4 - pad)
  return Buffer.from(padded, "base64").toString("utf8")
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("Invalid JWT")
  const json = base64UrlDecodeToString(parts[1] ?? "")
  const raw: unknown = JSON.parse(json)
  return JwtPayloadSchema.parse(raw)
}

export function getJwtExpSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const exp = payload["exp"]
  return typeof exp === "number" ? exp : null
}

export function getJwtUserType(token: string): UserRole | null {
  const payload = decodeJwtPayload(token)

  const candidates = [payload["role"], payload["ut"]]
  for (const value of candidates) {
    if (typeof value !== "string") continue
    const normalized = value.trim().toUpperCase()
    if (normalized === "ADMIN" || normalized === "DRIVER" || normalized === "PASSENGER") {
      return normalized
    }
  }

  return null
}
