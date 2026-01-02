import { useCallback } from "react";
import { authStore } from "./authStore";

/**
 * Auth + MFA state extraction
 *
 * This hook exists so the router stays readable (auth → mfa → route → render)
 * while keeping all authStore interactions in one explicit, beginner-friendly place.
 *
 * Important: this intentionally does NOT try to be reactive/subscribed.
 * The app re-renders primarily due to navigation changes, and we keep that
 * behavior to avoid changing runtime semantics.
 */

export type UseAuthStateResult = {
  isAuthenticated: boolean;
  isAuthorizedAdmin: boolean;
  mfaEnrollmentRequired: boolean;
  logout: () => void;
  setMfaEnrollmentRequired: (required: boolean) => void;
};

export function useAuthState(): UseAuthStateResult {
  // Basic auth state derived from localStorage.
  const authState = authStore.get();
  const isAuthorizedAdmin = !!authState && authStore.isAuthorizedForAdmin();

  if (authState && !isAuthorizedAdmin) {
    // Defensive: if somehow a non-admin token is present, clear it.
    // Note: this is intentionally done during render to preserve existing behavior.
    authStore.clear();
  }

  const isAuthenticated = !!authStore.get() && authStore.isAuthorizedForAdmin();

  // Enrollment gating is driven explicitly by backend outcomes:
  // - login response can set MFA_NOT_PRESENT
  // - API errors can force MFA_REQUIRED / MFA_NOT_ENROLLED
  // We intentionally do NOT infer this from JWT claims because token contents
  // can vary and false negatives would incorrectly force /mfa/setup.
  const mfaEnrollmentRequired = authStore.isMfaEnrollmentRequired();

  const logout = useCallback(() => {
    authStore.clear();
  }, []);

  const setMfaEnrollmentRequired = useCallback((required: boolean) => {
    authStore.setMfaEnrollmentRequired(required);
  }, []);

  return {
    isAuthenticated,
    isAuthorizedAdmin,
    mfaEnrollmentRequired,
    logout,
    setMfaEnrollmentRequired,
  };
}
