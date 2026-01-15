"use client";

import { getRecord, getString } from "../shared/typeGuards";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; payload?: unknown };

async function parseJsonSafe(res: Response): Promise<unknown | undefined> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function postJson(path: string, body: unknown): Promise<ApiResult<unknown>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    if (!res.ok) {
      return { ok: false, status: res.status, payload: await parseJsonSafe(res) };
    }

    return { ok: true, data: (await parseJsonSafe(res)) ?? {} };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function passengerAuthLogin(input: { email: string; password: string }): Promise<ApiResult<{ ok: true }>> {
  const result = await postJson("/api/auth/login", input);
  if (!result.ok) return result;
  return { ok: true, data: { ok: true } };
}

export async function passengerAuthLogout(): Promise<ApiResult<{ ok: true }>> {
  const result = await postJson("/api/auth/logout", {});
  if (!result.ok) return result;
  return { ok: true, data: { ok: true } };
}

export async function passengerAuthRefresh(): Promise<ApiResult<{ ok: true }>> {
  const result = await postJson("/api/auth/refresh", {});
  if (!result.ok) return result;
  return { ok: true, data: { ok: true } };
}

// Minimal internal helpers for error-message extraction (kept local to avoid coupling auth -> api).
// Works with backend's { message } or { error: { message } } envelopes.
export function extractMessage(payload: unknown): string | null {
  const rec = getRecord(payload);
  if (!rec) return null;

  const message = getString(rec.message);
  if (message) return message;

  const err = getRecord(rec.error);
  const errMessage = err ? getString(err.message) : undefined;
  return errMessage ?? null;
}
