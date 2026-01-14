/**
 * Auth Client - Centralized Authentication Service
 *
 * This module handles authentication operations for Web Admin:
 * - Admin login with email/password
 * - Token refresh with rotation
 * - Secure token storage (sessionStorage to reduce XSS blast radius)
 * - Logout
 *
 * Backend contract (admin):
 * - POST /api/v1/admin/auth/login   { email, password } -> { accessToken, refreshToken, expiresAt }
 * - POST /api/v1/admin/auth/refresh { refreshToken }    -> { accessToken, refreshToken, expiresAt }
 * - POST /api/v1/admin/auth/logout  { refreshToken }    -> { ok: true }
 */

import { authStore, type AuthState } from "../app/auth/authStore";
import type { AuthUser } from "../app/api/types";
import { getApiBaseUrl } from "../config/apiBaseUrl";
import { safeJsonParse } from "../shared/json";
import { getNumber, getRecord, getString, isRecord } from "../shared/typeGuards";

// Backend auth API base
const getAuthApiBase = () => getApiBaseUrl();

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
};

type Admin2faSetupRequiredResponse = {
  twoFactorRequired: true;
  setupToken: string;
  expiresAt: string;
};

type AdminMfaChallengeResponse = {
  challengeName: "SOFTWARE_TOKEN_MFA";
  session: string;
  expiresAt: string;
};

type AdminLoginStep1Response = Admin2faSetupRequiredResponse | AdminMfaChallengeResponse | TokenResponse;

export type AdminLoginResult =
  | { kind: "AUTHENTICATED" }
  | { kind: "MFA_CHALLENGE"; session: string; expiresAt: string }
  | { kind: "MFA_SETUP_REQUIRED"; setupToken: string; expiresAt: string };

export type AdminTotpSetup = {
  secretBase32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
};

type DecodedJwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
  typ?: string;
};

function parseTokenResponse(value: unknown): TokenResponse {
  const rec = getRecord(value);
  const accessToken = rec ? getString(rec.accessToken) : undefined;
  const refreshToken = rec ? getString(rec.refreshToken) : undefined;
  const expiresAt = rec ? getString(rec.expiresAt) : undefined;

  if (!accessToken || !refreshToken || !expiresAt) {
    throw new Error("Unexpected auth response from server");
  }

  return { accessToken, refreshToken, expiresAt };
}

function parseAdminLoginStep1Response(value: unknown): AdminLoginStep1Response {
  const rec = getRecord(value);
  if (!rec) throw new Error("Unexpected auth response from server");

  const twoFactorRequired = rec.twoFactorRequired === true;
  if (twoFactorRequired) {
    const setupToken = getString(rec.setupToken);
    const expiresAt = getString(rec.expiresAt);
    if (!setupToken || !expiresAt) throw new Error("Unexpected auth response from server");
    return { twoFactorRequired: true, setupToken, expiresAt };
  }

  const challengeName = getString(rec.challengeName);
  if (challengeName === "SOFTWARE_TOKEN_MFA") {
    const session = getString(rec.session);
    const expiresAt = getString(rec.expiresAt);
    if (!session || !expiresAt) throw new Error("Unexpected auth response from server");
    return { challengeName: "SOFTWARE_TOKEN_MFA", session, expiresAt };
  }

  // Defensive: if backend ever returns tokens directly.
  return parseTokenResponse(value);
}

function extractErrorMessageFromBody(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) return body;

  if (isRecord(body)) {
    const msg = getString(body.message);
    if (msg) return msg;

    if (Array.isArray(body.message)) {
      const joined = body.message
        .filter((x): x is string => typeof x === "string")
        .join("\n");
      if (joined) return joined;
    }

    const err = getRecord(body.error);
    const errMessage = err ? getString(err.message) : undefined;
    if (errMessage) return errMessage;

    const errCode = getString(body.error);
    if (errCode) return errCode;
  }

  return `Request failed with status ${status}`;
}

// ===== Helper: API request with error handling =====

async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getAuthApiBase()}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // OK even if backend is token-only
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  const data: unknown = isJson
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    const message = extractErrorMessageFromBody(data, response.status);
    throw new Error(message);
  }

  return data as T;
}

function base64UrlDecodeToString(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  // atob is available in browsers; vitest/jsdom provides it too.
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(token: string): DecodedJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    const json = base64UrlDecodeToString(parts[1]);
    const parsed = safeJsonParse(json);
    const rec = getRecord(parsed);
    if (!rec) return {};

    return {
      sub: getString(rec.sub),
      role: getString(rec.role),
      exp: getNumber(rec.exp),
      typ: getString(rec.typ),
    };
  } catch {
    return {};
  }
}

// ===== Auth Client Interface =====

export const authClient = {
  /**
   * Admin login - Step 1: Email + Password
   *
   * For Admin, the backend is Cognito-style:
   * - If TOTP not enrolled: returns a short-lived setup token (no access/refresh tokens yet)
   * - If TOTP enrolled: returns an MFA challenge session (no access/refresh tokens yet)
   *
   * Returns a discriminated result so the UI can route to the right next step.
   */
  async login(email: string, password: string): Promise<AdminLoginResult> {
    const response = await authFetch<unknown>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const step1 = parseAdminLoginStep1Response(response);

    if ("twoFactorRequired" in step1 && step1.twoFactorRequired) {
      return { kind: "MFA_SETUP_REQUIRED", setupToken: step1.setupToken, expiresAt: step1.expiresAt };
    }

    if ("challengeName" in step1 && step1.challengeName === "SOFTWARE_TOKEN_MFA") {
      return { kind: "MFA_CHALLENGE", session: step1.session, expiresAt: step1.expiresAt };
    }

    // Defensive: tokens returned directly.
    if ("accessToken" in step1 && "refreshToken" in step1 && "expiresAt" in step1) {
      await this.storeTokens({ tokens: step1, email });
      await this.hydratePermissionsBestEffort();
      return { kind: "AUTHENTICATED" };
    }

    throw new Error("Unexpected auth response from server");
  },

  /**
   * Admin login - Step 2: Respond to SOFTWARE_TOKEN_MFA challenge.
   *
   * On success, stores tokens in authStore.
   */
  async respondToMfaChallenge(params: { session: string; otp: string; email?: string | null }): Promise<void> {
    const response = await authFetch<unknown>("/admin/auth/login/mfa", {
      method: "POST",
      body: JSON.stringify({ session: params.session, otp: params.otp }),
    });

    const tokens = parseTokenResponse(response);
    await this.storeTokens({ tokens, email: params.email });
    await this.hydratePermissionsBestEffort();
  },

  /**
   * Admin 2FA enrollment - Step 1: create TOTP secret + QR code.
   *
   * Requires a short-lived setup token (returned from admin login).
   */
  async startTotpSetup(setupToken: string): Promise<AdminTotpSetup> {
    const url = `${getAuthApiBase()}/admin/auth/2fa/setup`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${setupToken}`,
      },
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data: unknown = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

    if (!res.ok) {
      const message = extractErrorMessageFromBody(data, res.status);
      throw new Error(message);
    }

    const rec = getRecord(data);
    const secretBase32 = rec ? getString(rec.secretBase32) : undefined;
    const otpauthUrl = rec ? getString(rec.otpauthUrl) : undefined;
    const qrCodeDataUrl = rec ? getString(rec.qrCodeDataUrl) : undefined;
    if (!secretBase32 || !otpauthUrl || !qrCodeDataUrl) {
      throw new Error("Unexpected auth response from server");
    }
    return { secretBase32, otpauthUrl, qrCodeDataUrl };
  },

  /**
   * Admin 2FA enrollment - Step 2: verify TOTP and receive tokens.
   */
  async verifyTotpSetup(params: { setupToken: string; otp: string; email?: string | null }): Promise<void> {
    const url = `${getAuthApiBase()}/admin/auth/2fa/verify`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.setupToken}`,
      },
      body: JSON.stringify({ otp: params.otp }),
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data: unknown = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

    if (!res.ok) {
      const message = extractErrorMessageFromBody(data, res.status);
      throw new Error(message);
    }

    const tokens = parseTokenResponse(data);
    await this.storeTokens({ tokens, email: params.email });
    await this.hydratePermissionsBestEffort();
  },

  /**
   * Refresh access token using refresh token
   * 
   * Backend rotates refresh tokens on each use
   * Returns new access + refresh tokens
   */
  async refresh(): Promise<void> {
    const currentRefreshToken = authStore.getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await authFetch<unknown>('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: currentRefreshToken })
    });

    const tokens = parseTokenResponse(response);

    const prior = authStore.get();
    const email = prior?.user?.email;
    await this.storeTokens({ tokens, email });
    await this.hydratePermissionsBestEffort();
  },

  /**
   * Logout - revoke refresh token on backend and clear local state
   */
  async logout(): Promise<void> {
    const refreshToken = authStore.getRefreshToken();

    // Always clear local state (fail-closed)
    authStore.clear();

    // Best-effort revoke on backend
    if (refreshToken) {
      try {
        await authFetch('/admin/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        // Ignore errors - local state already cleared
      }
    }
  },

  /**
   * Bootstrap - verify existing tokens are still valid
   * 
   * Called on app init to check if user is already authenticated
   * Attempts to refresh if access token is expired but refresh token exists
   */
  async bootstrap(): Promise<void> {
    const state = authStore.get();
    if (!state) {
      throw new Error('No stored auth state');
    }

    // Check if access token is expired based on stored expires_at.
    // If missing, treat as expired and attempt refresh.
    const expiresAt = new Date(state.expires_at || 0);
    const now = new Date();
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      await this.refresh();
    } else {
      // Access token still valid; best-effort ensure permissions are hydrated.
      await this.hydratePermissionsBestEffort();
    }
  },

  /**
   * Clear all auth state
   */
  clear(): void {
    authStore.clear();
  },

  /**
   * Internal: Store tokens and create minimal AuthUser.
   *
   * Note: backend currently returns only tokens (no /admin/me context).
   * For UX gating, we grant a wildcard permission "*" and rely on backend
   * authorization for real enforcement.
   */
  async storeTokens(params: { tokens: TokenResponse; email?: string | null }): Promise<void> {
    const { tokens, email } = params;

    const decoded = decodeJwtPayload(tokens.accessToken);
    const userId = typeof decoded.sub === "string" ? decoded.sub : "";
    const role = typeof decoded.role === "string" ? decoded.role : "ADMIN";
    if (role !== "ADMIN") {
      authStore.clear();
      throw new Error("Only ADMIN users can sign in to Web Admin");
    }

    const accessExpMs = typeof decoded.exp === "number" ? decoded.exp * 1000 : Date.now();
    const expiresAt = new Date(accessExpMs).toISOString();

    const safeEmail = (email || authStore.getUser()?.email || "").toString();

    const user: AuthUser = {
      id: userId,
      email: safeEmail,
      system_role: "ADMIN",
      roles: ["admin"],
      permissions: [],
    };

    const authState: AuthState = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt,
      user,
      adminContext: {
        identity: { id: userId, email: safeEmail },
        roles: user.roles,
        permissions: user.permissions,
      },
    };

    authStore.set(authState);
  },

  async hydratePermissionsBestEffort(): Promise<void> {
    const accessToken = authStore.getAccessToken();
    if (!accessToken) return;

    try {
      const url = `${getAuthApiBase()}/admin/auth/permissions`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data: unknown = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

      if (!res.ok) {
        // If user can't read RBAC permissions, keep UX permissive (backend still enforces).
        if (res.status === 403) return;
        const message = extractErrorMessageFromBody(data, res.status);
        throw new Error(message);
      }

      const rec = getRecord(data);
      const raw = rec ? rec.permissions : undefined;
      if (!Array.isArray(raw) || !raw.every((p): p is string => typeof p === "string")) {
        return;
      }

      const prior = authStore.get();
      if (!prior) return;

      const next: AuthState = {
        ...prior,
        user: {
          ...prior.user,
          permissions: raw,
        },
        adminContext: prior.adminContext
          ? {
              ...prior.adminContext,
              permissions: raw,
            }
          : prior.adminContext,
      };

      authStore.set(next);
    } catch {
      // Best-effort only.
    }
  },
};
