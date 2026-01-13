import {
  UpstreamAuthPayloadSchema,
  type UpstreamAuthPayload,
} from "./schemas"

function authApiBaseUrlV1() {
  const baseA = process.env.BACKEND_API_BASE_URL
  const baseB = process.env.AUTH_API_BASE_URL

  if (baseA && baseB && baseA !== baseB) {
    throw new Error(
      "BACKEND_API_BASE_URL and AUTH_API_BASE_URL must match (single API base URL invariant)"
    )
  }

  const rawBase = baseA ?? baseB ?? "http://localhost:3000"
  const trimmed = rawBase.replace(/\/$/, "")
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`
}

async function parseJsonSafe(res: Response): Promise<unknown | undefined> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function passengerLogin(input: { email: string; password: string }) {
  const res = await fetch(`${authApiBaseUrlV1()}/passenger/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })

  const raw = await parseJsonSafe(res)
  const parsed = UpstreamAuthPayloadSchema.safeParse(raw)
  const payload: UpstreamAuthPayload | undefined = parsed.success ? parsed.data : undefined
  return { res, payload }
}

export async function passengerRefresh(input: { refreshToken: string }) {
  const res = await fetch(`${authApiBaseUrlV1()}/passenger/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })

  const raw = await parseJsonSafe(res)
  const parsed = UpstreamAuthPayloadSchema.safeParse(raw)
  const payload: UpstreamAuthPayload | undefined = parsed.success ? parsed.data : undefined
  return { res, payload }
}

export async function passengerLogout(input: { refreshToken: string }) {
  const res = await fetch(`${authApiBaseUrlV1()}/passenger/auth/logout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null)

  return res
}
