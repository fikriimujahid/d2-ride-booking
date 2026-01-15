"use client";

import type { z } from "zod";
import { ApiError, AuthRequiredError, ForbiddenError, NetworkError } from "./errors";

async function parseJsonSafe(res: Response): Promise<unknown | undefined> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function messageFromPayload(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (!payload || typeof payload !== "object") return null;

  const rec = payload as Record<string, unknown>;
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;

  const err = rec.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
  }

  return null;
}

export async function apiRequest<T>(opts: {
  path: string;
  schema: z.ZodType<T>;
  init?: RequestInit;
}): Promise<T> {
  const url = `/api/backend${opts.path.startsWith("/") ? "" : "/"}${opts.path}`;

  const headers = new Headers(opts.init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  let res: Response;
  try {
    res = await fetch(url, {
      ...opts.init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 401) throw new AuthRequiredError(await parseJsonSafe(res));
  if (res.status === 403) throw new ForbiddenError(await parseJsonSafe(res));

  if (!res.ok) {
    const details = await parseJsonSafe(res);
    const msg = messageFromPayload(details) ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, details);
  }

  const raw: unknown = await res.json().catch(() => undefined);
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid JSON response", 502, parsed.error.flatten());
  }

  return parsed.data;
}
