"use client"

import { ApiError, AuthRequiredError, ForbiddenError } from "./errors"
import type { z } from "zod"

async function parseJsonSafe(res: Response): Promise<unknown | undefined> {
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return undefined
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function passengerApiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const url = `/api/backend${path.startsWith("/") ? "" : "/"}${path}`
  const headers = new Headers(init?.headers)
  if (!headers.has("content-type")) headers.set("content-type", "application/json")

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  })

  if (res.status === 401) {
    const next = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname + window.location.search) : ""
    if (typeof window !== "undefined") window.location.href = `/login${next ? `?next=${next}` : ""}`
    throw new AuthRequiredError(await parseJsonSafe(res))
  }

  if (res.status === 403) {
    throw new ForbiddenError(await parseJsonSafe(res))
  }

  if (!res.ok) {
    const details = await parseJsonSafe(res)
    throw new ApiError(`Request failed (${res.status})`, res.status, details)
  }

  const raw: unknown = await res.json()
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError("Invalid JSON response", 502, parsed.error.flatten())
  }

  return parsed.data
}
