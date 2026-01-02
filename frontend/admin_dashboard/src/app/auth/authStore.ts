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
    return safeParse(localStorage.getItem(STORAGE_KEY));
  },

  set(state: AuthState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MFA_ENROLLMENT_REQUIRED_KEY);
  },

  setMfaEnrollmentRequired(required: boolean) {
    if (required) {
      localStorage.setItem(MFA_ENROLLMENT_REQUIRED_KEY, "true");
    } else {
      localStorage.removeItem(MFA_ENROLLMENT_REQUIRED_KEY);
    }
  },

  isMfaEnrollmentRequired(): boolean {
    return localStorage.getItem(MFA_ENROLLMENT_REQUIRED_KEY) === "true";
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
