"use client"

import { ApiError, AuthRequiredError, ForbiddenError } from "./errors"

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null

async function parseJsonSafe(res: Response): Promise<Json | undefined> {
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return undefined
  try {
    return (await res.json()) as Json
  } catch {
    return undefined
  }
}

export async function passengerApiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/backend${path.startsWith("/") ? "" : "/"}${path}`,
    {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.headers ?? {}),
        "content-type": (init?.headers as Record<string, string> | undefined)?.["content-type"] ?? "application/json",
      },
    }
  )

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

  return (await res.json()) as T
}
