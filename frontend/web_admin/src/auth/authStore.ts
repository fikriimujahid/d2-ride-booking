import type { AuthUser, AdminContext } from "../app/api/types";
import { safeJsonParse } from "../shared/json";
import { getArray, getRecord, getString, isRecord } from "../shared/typeGuards";

const STORAGE_KEY = "rideadmin.auth";

/**
 * Auth State - Tokens + Admin Context
 *
 * Stores both authentication tokens and the admin's authorization context.
 *
 * Storage choice:
 * - We use `sessionStorage` (tab-scoped) so tokens do not persist across browser restarts.
 * - This reduces the "long-lived token on shared machine" risk compared to `localStorage`.
 *
 * Important: anything accessible to JS is still vulnerable to XSS.
 * We treat this as a pragmatic tradeoff for a SPA and rely on:
 * - short-lived access tokens
 * - refresh rotation on the backend
 * - backend-enforced authz for every request
 */
export type AuthState = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
  user: AuthUser;
  adminContext?: AdminContext;
};

function safeParse(json: string | null): AuthState | null {
  if (!json) return null;

  const parsed = safeJsonParse(json);
  return parseAuthState(parsed);
}

function parseAuthUser(value: unknown): AuthUser | null {
  const rec = getRecord(value);
  if (!rec) return null;

  const id = getString(rec.id);
  const email = getString(rec.email);
  const systemRole = getString(rec.system_role);
  const roles = getArray(rec.roles);
  const permissions = getArray(rec.permissions);

  if (!id || !email) return null;
  if (systemRole !== "PASSENGER" && systemRole !== "DRIVER" && systemRole !== "ADMIN") return null;
  if (!roles?.every((v): v is string => typeof v === "string")) return null;
  if (!permissions?.every((v): v is string => typeof v === "string")) return null;

  const fullName = getString(rec.full_name);
  const twoFactorEnabled = typeof rec.two_factor_enabled === "boolean" ? rec.two_factor_enabled : undefined;

  return {
    id,
    email,
    system_role: systemRole,
    full_name: fullName,
    two_factor_enabled: twoFactorEnabled,
    roles: roles as string[],
    permissions: permissions as string[],
  };
}

function parseAdminContext(value: unknown): AdminContext | null {
  const rec = getRecord(value);
  if (!rec) return null;

  const identity = getRecord(rec.identity);
  const roles = getArray(rec.roles);
  const permissions = getArray(rec.permissions);
  if (!identity) return null;

  const id = getString(identity.id);
  const email = getString(identity.email);
  const name = getString(identity.name);
  if (!id || !email) return null;
  if (!roles?.every((v): v is string => typeof v === "string")) return null;
  if (!permissions?.every((v): v is string => typeof v === "string")) return null;

  const featureFlags = (() => {
    if (!isRecord(rec.featureFlags)) return undefined;
    const entries = Object.entries(rec.featureFlags);
    if (!entries.every(([, v]) => typeof v === "boolean")) return undefined;
    return rec.featureFlags as Record<string, boolean>;
  })();

  const metadata = (() => {
    if (!isRecord(rec.metadata)) return undefined;
    const environment = getString(rec.metadata.environment);
    const organization = getString(rec.metadata.organization);
    return {
      environment,
      organization,
    } satisfies AdminContext["metadata"];
  })();

  return {
    identity: { id, email, name },
    roles: roles as string[],
    permissions: permissions as string[],
    featureFlags,
    metadata,
  };
}

function parseAuthState(value: unknown): AuthState | null {
  const rec = getRecord(value);
  if (!rec) return null;

  const accessToken = getString(rec.access_token);
  const refreshToken = getString(rec.refresh_token);
  const expiresAt = getString(rec.expires_at);
  const user = parseAuthUser(rec.user);
  if (!accessToken || !refreshToken || !expiresAt || !user) return null;

  const adminContext = rec.adminContext !== undefined ? parseAdminContext(rec.adminContext) : undefined;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user,
    adminContext: adminContext ?? undefined,
  };
}

export const authStore = {
  get(): AuthState | null {
    // Single read location for auth state.
    // Keeping this centralized prevents "half logged-in" UI states.
    return safeParse(sessionStorage.getItem(STORAGE_KEY));
  },

  set(state: AuthState) {
    // Persist the *minimum* we need for UX:
    // - tokens for API requests
    // - user identity for display
    // - permissions for UI gating
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  },

  getAccessToken(): string | null {
    return this.get()?.access_token ?? null;
  },

  getRefreshToken(): string | null {
    return this.get()?.refresh_token ?? null;
  },

  getExpiresAt(): string | null {
    return this.get()?.expires_at ?? null;
  },

  getUser(): AuthUser | null {
    return this.get()?.user ?? null;
  },

  getAdminContext(): AdminContext | null {
    return this.get()?.adminContext ?? null;
  },

  isAuthorizedForAdmin(): boolean {
    const user = this.getUser();
    return !!user && user.system_role === "ADMIN";
  },

  hasRole(roleName: string): boolean {
    const ctx = this.getAdminContext();
    if (ctx?.roles) {
      return ctx.roles.includes(roleName);
    }
    const user = this.getUser();
    return !!user && !!user.roles?.includes(roleName);
  },

  hasPermission(permissionKey: string): boolean {
    // UX-only guard.
    // This prevents rendering controls the user can't use, but it is NOT a security boundary.
    // Backend permission checks are still required (and authoritative).
    const ctx = this.getAdminContext();
    if (ctx?.permissions) {
      if (ctx.permissions.includes("*")) return true;
      return ctx.permissions.includes(permissionKey);
    }
    const user = this.getUser();
    if (user?.permissions?.includes("*")) return true;
    return !!user && !!user.permissions?.includes(permissionKey);
  },

  hasAnyPermission(permissionKeys: string[]): boolean {
    return permissionKeys.some((p) => this.hasPermission(p));
  },

  hasAllPermissions(permissionKeys: string[]): boolean {
    return permissionKeys.every((p) => this.hasPermission(p));
  },

  getDisplayName(): string {
    const ctx = this.getAdminContext();
    if (ctx?.identity.name) return ctx.identity.name;

    const user = this.getUser();
    return user?.email?.split("@")[0] || "Admin";
  },

  getEmail(): string {
    const ctx = this.getAdminContext();
    if (ctx?.identity.email) return ctx.identity.email;

    const user = this.getUser();
    return user?.email || "";
  },
};
