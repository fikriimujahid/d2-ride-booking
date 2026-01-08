type JwtPayload = Record<string, unknown>

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
  return JSON.parse(json) as JwtPayload
}

export function getJwtExpSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const exp = payload["exp"]
  return typeof exp === "number" ? exp : null
}

export function getJwtUserType(token: string): string | null {
  const payload = decodeJwtPayload(token)
  const ut = payload["ut"]
  return typeof ut === "string" ? ut : null
}
