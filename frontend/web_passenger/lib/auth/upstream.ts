import {
  UpstreamAuthPayloadSchema,
  type UpstreamAuthPayload,
} from "./schemas"
import { getServerApiBaseUrl } from "@/lib/config/apiBaseUrl"

async function parseJsonSafe(res: Response): Promise<unknown | undefined> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function passengerLogin(input: { email: string; password: string }) {
  const res = await fetch(`${getServerApiBaseUrl()}/passenger/auth/login`, {
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
  const res = await fetch(`${getServerApiBaseUrl()}/passenger/auth/refresh`, {
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
  const res = await fetch(`${getServerApiBaseUrl()}/passenger/auth/logout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null)

  return res
}
