import type { AuthUser } from "../api/types";

const STORAGE_KEY = "rideadmin.auth";
const MFA_ENROLLMENT_REQUIRED_KEY = "rideadmin.mfa_enrollment_required";

type AuthState = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  user: AuthUser;
};

function safeParse(json: string | null): AuthState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AuthState;
  } catch {
    return null;
  }
}

export const authStore = {
  get(): AuthState | null {
    // SECURITY: use sessionStorage to reduce the blast radius of token persistence.
    // We still do NOT treat mere presence of tokens as "authenticated"; the backend remains the source of truth.
    return safeParse(sessionStorage.getItem(STORAGE_KEY));
  },

  set(state: AuthState) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(MFA_ENROLLMENT_REQUIRED_KEY);
  },

  setMfaEnrollmentRequired(required: boolean) {
    // SECURITY: this flag is a UI hint only. MFA enforcement is still done by the backend.
    if (required) {
      sessionStorage.setItem(MFA_ENROLLMENT_REQUIRED_KEY, "true");
    } else {
      sessionStorage.removeItem(MFA_ENROLLMENT_REQUIRED_KEY);
    }
  },

  isMfaEnrollmentRequired(): boolean {
    return sessionStorage.getItem(MFA_ENROLLMENT_REQUIRED_KEY) === "true";
  },

  getAccessToken(): string | null {
    return this.get()?.access_token ?? null;
  },

  getRefreshToken(): string | null {
    return this.get()?.refresh_token ?? null;
  },

  getUser(): AuthUser | null {
    return this.get()?.user ?? null;
  },

  isAuthorizedForAdmin(): boolean {
    const user = this.getUser();
    return !!user && user.system_role === "ADMIN";
  },

  hasRole(roleName: string): boolean {
    const user = this.getUser();
    return !!user && user.roles.includes(roleName);
  },

  hasPermission(permissionKey: string): boolean {
    const user = this.getUser();
    return !!user && user.permissions.includes(permissionKey);
  },
};
