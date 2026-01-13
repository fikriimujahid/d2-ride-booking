import { ApiError, type ApiErrorResponse, type ApiSuccessResponse } from "./types";
import { authStore } from "../auth/authStore";
import { emitAuthErrorEvent } from "../routing/authEvents";
import { authClient } from "../../services/authClient";
import { getApiBaseUrl } from "../../config/apiBaseUrl";
import { getRecord, getString, isRecord } from "../../shared/typeGuards";

function getBaseUrl() {
  return getApiBaseUrl();
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
  const body: unknown = isJson
    ? await res.json().catch(() => undefined)
    : await res.text().catch(() => undefined);

  if (!res.ok) {
    const errorEnvelope = isRecord(body) ? (body as ApiErrorResponse) : undefined;
    const errorObj = errorEnvelope ? getRecord(errorEnvelope.error) : undefined;

    const codeFromEnvelope = errorObj ? getString(errorObj.code) : undefined;
    const messageFromEnvelope = errorObj ? getString(errorObj.message) : undefined;

    const messageField = isRecord(body) ? body.message : undefined;
    const messageFromBody = (() => {
      if (typeof messageField === "string") return messageField;
      if (Array.isArray(messageField)) {
        const joined = messageField
          .filter((x): x is string => typeof x === "string")
          .join("\n");
        return joined || undefined;
      }

      const nested = getRecord(messageField);
      return nested ? getString(nested.message) : undefined;
    })();

    const codeFromBody = isRecord(body) ? getString(body.error) : undefined;

    let code = codeFromEnvelope || codeFromBody;
    const message =
      messageFromEnvelope ||
      messageFromBody ||
      (typeof body === "string" && body.trim() ? body : undefined) ||
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
      action: errorObj ? getString(errorObj.action) : undefined,
      details: errorObj && isRecord(errorObj.details) ? (errorObj.details as Record<string, unknown>) : undefined,
    });
  }

  // Backend uses { success:true, data, message }
  if (isRecord(body) && body.success === true && "data" in body) {
    const wrapped = body as ApiSuccessResponse<T>;
    return wrapped.data;
  }

  // Fallback if endpoint returns raw data
  return body as T;
}
