/**
 * Admin Auth API
 * 
 * DEPRECATED: These functions are kept for backward compatibility only.
 * New code should use authClient from services/authClient.ts
 * 
 * This module will be removed once all components migrate to authClient.
 */

import { apiRequest } from "./http";
import { authStore } from "../auth/authStore";

/**
 * @deprecated Use authClient.logout() instead
 */
export async function adminLogout() {
  const refreshToken = authStore.getRefreshToken();
  if (!refreshToken) {
    authStore.clear();
    return { message: "Logged out" };
  }

  try {
    return await apiRequest<{ ok: boolean }>("/admin/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    authStore.clear();
  }
}

/**
 * @deprecated This is for old MFA flow - use AuthContext instead
 */
export async function adminMfaSetup() {
  // This is called from MfaEnrollmentFlow which uses a different flow
  // than the new authClient. Keeping this stub for now.
  throw new Error("MFA setup should be done through AuthContext.loginWithPassword flow");
}

/**
 * @deprecated This is for old MFA flow - use AuthContext instead
 */
export async function adminMfaVerify(code: string) {
  throw new Error("MFA verify should be done through AuthContext.submitTotpCode flow");
}

