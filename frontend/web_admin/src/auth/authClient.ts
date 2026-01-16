import { authStore, type AuthState } from "./authStore";
import type { AuthUser } from "../app/api/types";
import { getApiBaseUrl } from "../config/apiBaseUrl";
import { extractErrorMessageFromBody } from "./errors";
import { authFetch } from "./http";
import { decodeJwtPayload } from "./jwt";
import { getRecord, getString } from "../shared/typeGuards";

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

  return parseTokenResponse(value);
}

export const authClient = {
  async login(email: string, password: string): Promise<AdminLoginResult> {
    // Step 1: POST credentials to the role-scoped admin login endpoint.
    // Backend is responsible for:
    // - password verification
    // - deciding whether MFA is required
    // - issuing tokens (only after MFA completes)
    const response = await authFetch<unknown>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const step1 = parseAdminLoginStep1Response(response);

    if ("twoFactorRequired" in step1 && step1.twoFactorRequired) {
      // MFA enrollment is required before admin can get tokens.
      // Frontend only stores the temporary setup token (in memory via AuthContext),
      // then calls setup/verify endpoints to complete enrollment.
      return { kind: "MFA_SETUP_REQUIRED", setupToken: step1.setupToken, expiresAt: step1.expiresAt };
    }

    if ("challengeName" in step1 && step1.challengeName === "SOFTWARE_TOKEN_MFA") {
      // MFA is already enrolled; backend challenges for OTP.
      // At this point we still have NO access/refresh tokens.
      return { kind: "MFA_CHALLENGE", session: step1.session, expiresAt: step1.expiresAt };
    }

    if ("accessToken" in step1 && "refreshToken" in step1 && "expiresAt" in step1) {
      // Tokens are only stored after the backend has fully authenticated the admin.
      await this.storeTokens({ tokens: step1, email });

      // Permissions are hydrated separately from the token.
      // This keeps tokens smaller and avoids baking mutable RBAC state into JWTs.
      await this.hydratePermissionsBestEffort();
      return { kind: "AUTHENTICATED" };
    }

    throw new Error("Unexpected auth response from server");
  },

  async respondToMfaChallenge(params: { session: string; otp: string; email?: string | null }): Promise<void> {
    // Step 2: submit the one-time password for an MFA challenge.
    // Backend validates OTP and (on success) returns access+refresh tokens.
    const response = await authFetch<unknown>("/admin/auth/login/mfa", {
      method: "POST",
      body: JSON.stringify({ session: params.session, otp: params.otp }),
    });

    const tokens = parseTokenResponse(response);
    await this.storeTokens({ tokens, email: params.email });
    await this.hydratePermissionsBestEffort();
  },

  async startTotpSetup(setupToken: string): Promise<AdminTotpSetup> {
    // Enrollment is protected by a temporary setup token (NOT the normal access token).
    // Backend decides whether a setup token is valid and what secrets/QR to return.
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

  async verifyTotpSetup(params: { setupToken: string; otp: string; email?: string | null }): Promise<void> {
    // Enrollment completion. Backend validates the OTP and issues the real token pair.
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

  async refresh(): Promise<void> {
    // Token refresh is used when access token expires (401 from API).
    // Backend validates refresh token, rotates it, and issues a new access token.
    const currentRefreshToken = authStore.getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await authFetch<unknown>("/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    const tokens = parseTokenResponse(response);

    const prior = authStore.get();
    const email = prior?.user?.email;
    await this.storeTokens({ tokens, email });
    await this.hydratePermissionsBestEffort();
  },

  async logout(): Promise<void> {
    const refreshToken = authStore.getRefreshToken();

    // Clear local state first so the UI immediately becomes UNAUTHENTICATED.
    // This is safe because the backend remains the enforcement point.
    authStore.clear();

    if (refreshToken) {
      try {
        await authFetch("/admin/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Best-effort: don't block logout UX on network failures.
        // Backend refresh rotation still limits how long a stolen token remains useful.
      }
    }
  },

  async bootstrap(): Promise<void> {
    // Bootstrap runs on app start if we have stored tokens.
    // It validates freshness and refreshes if needed.
    const state = authStore.get();
    if (!state) {
      throw new Error("No stored auth state");
    }

    const expiresAt = new Date(state.expires_at || 0);
    const now = new Date();
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      await this.refresh();
    } else {
      await this.hydratePermissionsBestEffort();
    }
  },

  clear(): void {
    authStore.clear();
  },

  async storeTokens(params: { tokens: TokenResponse; email?: string | null }): Promise<void> {
    const { tokens, email } = params;

    // We decode the access token payload client-side to extract identity info.
    // This is a UX convenience only; backend verifies and enforces.
    const decoded = decodeJwtPayload(tokens.accessToken);
    const userId = typeof decoded.sub === "string" ? decoded.sub : "";
    const role = typeof decoded.role === "string" ? decoded.role : "ADMIN";
    if (role !== "ADMIN") {
      // Defensive client-side check.
      // Prevents accidentally using a non-admin token in Web Admin if a client bug occurs.
      // Backend also enforces role-scoped login endpoints.
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
        // Permissions are hydrated separately via /admin/auth/permissions.
        // Until then, we treat permissions as empty (fail closed in UI).
        permissions: user.permissions,
      },
    };

    authStore.set(authState);
  },

  async hydratePermissionsBestEffort(): Promise<void> {
    const accessToken = authStore.getAccessToken();
    if (!accessToken) return;

    try {
      // Permissions are fetched from the backend (source of truth).
      // This lets the backend change RBAC without forcing token re-issue for every permission update.
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
        // 403 here means "your token is valid, but you don't have permission to query permissions".
        // Web Admin treats this as "no permissions available" and fails closed at the UI layer.
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
      // best-effort only
    }
  },
};
