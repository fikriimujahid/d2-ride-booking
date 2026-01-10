import { ApiError, type ApiErrorResponse, type ApiSuccessResponse } from "./types";
import { authStore } from "../auth/authStore";
import { emitAuthErrorEvent } from "../routing/authEvents";
import { authClient } from "../../services/authClient";

function getBaseUrl() {
  const env = (import.meta as any).env as any;
  const baseUrl = env?.VITE_API_BASE_URL;
  if (baseUrl) return String(baseUrl).replace(/\/$/, "");
  if (env?.DEV) return "http://localhost:3000";
  // In deployed builds, never fall back to localhost.
  // An empty base makes requests relative to the current origin.
  return "";
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

  const doFetch = () =>
    fetch(url, {
      ...init,
      headers,
    });

  let res = await doFetch();

  // Auto-refresh interceptor for authenticated requests
  if (init.auth && res.status === 401 && authStore.getRefreshToken()) {
    try {
      await authClient.refresh();

      const nextToken = authStore.getAccessToken();
      if (nextToken) headers.set("Authorization", `Bearer ${nextToken}`);

      res = await doFetch();
    } catch {
      // Refresh failed - clear auth and emit event
      authClient.clear();
      emitAuthErrorEvent({ code: 'AUTH_TOKEN_EXPIRED', message: 'Session expired' });
      throw new ApiError({
        message: 'Session expired. Please login again.',
        status: 401,
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (!res.ok) {
    const err = body as ApiErrorResponse | undefined;
    let code =
      (err && typeof err === "object" && "error" in err && (err as any).error?.code) ||
      (body && typeof body === "object" && (body as any).message?.error?.code) ||
      undefined;

    // Support auth-api error shape: { error: string, message: string }
    if (!code && body && typeof body === "object" && typeof (body as any).error === "string") {
      code = (body as any).error;
    }

    const nestedMessage = (() => {
      if (!body || typeof body !== "object") return undefined;
      const b: any = body;
      if (typeof b.message === "string") return b.message;
      if (Array.isArray(b.message)) return b.message.filter((x: any) => typeof x === "string").join("\n") || undefined;
      if (b.message && typeof b.message === "object" && typeof b.message.message === "string") return b.message.message;
      return undefined;
    })();

    const message =
      (err && typeof err === "object" && "error" in err && typeof (err as any).error?.message === "string" && (err as any).error.message) ||
      (body && typeof body === "object" && typeof (body as any).message === "string" && (body as any).message) ||
      nestedMessage ||
      `Request failed (${res.status})`;

    // Infer auth error codes for known cases
    if (!code && res.status === 401) code = "AUTH_UNAUTHENTICATED";
    if (!code && res.status === 403) code = "AUTH_FORBIDDEN";

    // Emit auth error events for auth-protected requests
    if (init.auth && typeof code === "string") {
      if (
        code === "AUTH_UNAUTHENTICATED" ||
        code === "AUTH_TOKEN_EXPIRED" ||
        code === "AUTH_FORBIDDEN" ||
        code === "TWO_FACTOR_ENROLLMENT_REQUIRED" ||
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

  // Fallback if endpoint returns raw data
  return body as T;
}
