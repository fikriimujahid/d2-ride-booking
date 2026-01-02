import { ApiError, type ApiErrorResponse, type ApiSuccessResponse } from "./types";
import { authStore } from "../auth/authStore";
import { emitAuthErrorEvent } from "../routing/authEvents";

function getBaseUrl() {
  // Avoid TS env typing issues in this repo by keeping it loose.
  const env = (import.meta as any).env as Record<string, string> | undefined;
  const baseUrl = env?.VITE_API_BASE_URL;
  // Default to same-origin API path (works with Vite proxy in dev).
  if (!baseUrl) return "/api/v1";
  return baseUrl.replace(/\/$/, "");
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  if (init.auth) {
    const token = authStore.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (!res.ok) {
    const err = body as ApiErrorResponse | undefined;
    const code =
      (err && typeof err === "object" && "error" in err && (err as any).error?.code) ||
      undefined;
    const message =
      (err && typeof err === "object" && "error" in err && typeof (err as any).error?.message === "string" && (err as any).error.message) ||
      `Request failed (${res.status})`;

    // Centralized auth-related decision trigger.
    // We only emit redirects for requests that explicitly declare `auth: true`.
    // This keeps the login form flow predictable (bad credentials shouldn't "redirect to login" again).
    if (init.auth && typeof code === "string") {
      if (
        code === "AUTH_UNAUTHENTICATED" ||
        code === "MFA_REQUIRED" ||
        code === "MFA_NOT_ENROLLED" ||
        code === "RBAC_INSUFFICIENT_ROLE"
      ) {
        emitAuthErrorEvent({ code, message });
      }
    }

    throw new ApiError({
      message,
      status: res.status,
      code: typeof code === "string" ? code : undefined,
      action: (err as any)?.error?.action,
      details: (err as any)?.error?.details,
    });
  }

  // Backend uses { success:true, data, message }
  const wrapped = body as ApiSuccessResponse<T> | undefined;
  if (wrapped && typeof wrapped === "object" && (wrapped as any).success === true && "data" in wrapped) {
    return wrapped.data;
  }

  // Fallback if endpoint ever returns raw.
  return body as T;
}
