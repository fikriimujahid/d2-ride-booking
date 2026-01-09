import type { AuthUser, AdminContext } from "../api/types";

const STORAGE_KEY = "rideadmin.auth";

/**
 * Auth State - Tokens + Admin Context
 * 
 * Stores both authentication tokens and the admin's authorization context.
 * This is persisted in sessionStorage (cleared on tab close for security).
 */
export type AuthState = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
  user: AuthUser;
  adminContext?: AdminContext; // NEW: Comprehensive admin context from /admin/me
};

function safeParse(json: string | null): AuthState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AuthState;
  } catch {
    return null;
  }
}

/**
 * Auth Store - Central Authentication State Management
 * 
 * SECURITY PRINCIPLES:
 * 1. Frontend permission checks are UX-only (backend always enforces)
 * 2. Use sessionStorage (not localStorage) to reduce XSS blast radius
 * 3. Permission checks are simple array lookups (no complex logic)
 * 
 * USAGE PATTERN:
 * 1. After login + 2FA, fetch AdminContext via authClient.fetchAdminContext()
 * 2. Store the result using authStore.set()
 * 3. Use hasPermission() for UI feature gating (menus, buttons, routes)
 * 4. Backend validates permissions on every protected endpoint
 */
export const authStore = {
  get(): AuthState | null {
    return safeParse(sessionStorage.getItem(STORAGE_KEY));
  },

  set(state: AuthState) {
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

  /**
   * Check if user has a specific role
   * 
   * @param roleName - Role name to check (e.g., "super_admin")
   * @returns true if user has the role
   */
  hasRole(roleName: string): boolean {
    const ctx = this.getAdminContext();
    if (ctx?.roles) {
      return ctx.roles.includes(roleName);
    }
    // Fallback to legacy user.roles
    const user = this.getUser();
    return !!user && !!user.roles?.includes(roleName);
  },

  /**
   * Check if user has a specific permission
   * 
   * PRIMARY METHOD for frontend feature gating.
   * Use this for:
   * - Menu item visibility
   * - Route access control
   * - Button/action visibility
   * 
   * @param permissionKey - Permission key to check (e.g., "admin.dashboard.view")
   * @returns true if user has the permission
   */
  hasPermission(permissionKey: string): boolean {
    const ctx = this.getAdminContext();
    if (ctx?.permissions) {
      return ctx.permissions.includes(permissionKey);
    }
    // Fallback to legacy user.permissions
    const user = this.getUser();
    return !!user && !!user.permissions?.includes(permissionKey);
  },

  /**
   * Check if user has ANY of the specified permissions
   * 
   * @param permissionKeys - Array of permission keys
   * @returns true if user has at least one permission
   */
  hasAnyPermission(permissionKeys: string[]): boolean {
    return permissionKeys.some(p => this.hasPermission(p));
  },

  /**
   * Check if user has ALL of the specified permissions
   * 
   * @param permissionKeys - Array of permission keys
   * @returns true if user has all permissions
   */
  hasAllPermissions(permissionKeys: string[]): boolean {
    return permissionKeys.every(p => this.hasPermission(p));
  },

  /**
   * Get user's display name
   */
  getDisplayName(): string {
    const ctx = this.getAdminContext();
    if (ctx?.identity.name) return ctx.identity.name;
    
    const user = this.getUser();
    return user?.email?.split('@')[0] || 'Admin';
  },

  /**
   * Get user's email
   */
  getEmail(): string {
    const ctx = this.getAdminContext();
    if (ctx?.identity.email) return ctx.identity.email;
    
    const user = this.getUser();
    return user?.email || '';
  }
};
