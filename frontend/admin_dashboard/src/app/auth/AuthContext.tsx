import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AdminLoginResult, ApiError, AuthUser } from "../api/types";
import { adminLogin, adminVerifyMfa } from "../api/auth";
import { adminMe } from "../api/admin";
import { authStore } from "./authStore";

export type AuthStatus =
  | "UNAUTHENTICATED"
  | "MFA_SETUP_REQUIRED"
  | "MFA_VERIFICATION_REQUIRED"
  | "AUTHENTICATED";

type PendingMfaSetup = {
  email: string;
  session: string; // opaque sealed token from backend
  qrCodeUri: string;
  secret: string;
};

type PendingMfaVerify = {
  email: string;
  session: string; // opaque sealed token from backend
};

type AuthContextValue = {
  status: AuthStatus;
  isBootstrapping: boolean;

  // UX-only (never a proof signal)
  user: AuthUser | null;

  // In-memory MFA continuation state (intentionally not persisted)
  pendingMfaSetup: PendingMfaSetup | null;
  pendingMfaVerify: PendingMfaVerify | null;

  loginWithPassword: (email: string, password: string) => Promise<AuthStatus>;
  submitTotpCode: (code: string) => Promise<AuthStatus>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthenticatedResult(
  r: AdminLoginResult
): r is Extract<AdminLoginResult, { access_token: string }> {
  return typeof r === "object" && r !== null && "access_token" in r;
}

function isMfaSetupRequired(
  r: AdminLoginResult
): r is Extract<AdminLoginResult, { status: "MFA_SETUP_REQUIRED" }> {
  return (
    typeof r === "object" &&
    r !== null &&
    "mfa_required" in r &&
    Boolean((r as any).mfa_required) &&
    (r as any).status === "MFA_SETUP_REQUIRED"
  );
}

function isMfaVerificationRequired(
  r: AdminLoginResult
): r is Extract<AdminLoginResult, { status: "MFA_VERIFICATION_REQUIRED" }> {
  return (
    typeof r === "object" &&
    r !== null &&
    "mfa_required" in r &&
    Boolean((r as any).mfa_required) &&
    (r as any).status === "MFA_VERIFICATION_REQUIRED"
  );
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("UNAUTHENTICATED");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [pendingMfaSetup, setPendingMfaSetup] = useState<PendingMfaSetup | null>(
    null
  );
  const [pendingMfaVerify, setPendingMfaVerify] = useState<PendingMfaVerify | null>(
    null
  );

  const user = authStore.getUser();

  const clearPending = useCallback(() => {
    setPendingMfaSetup(null);
    setPendingMfaVerify(null);
  }, []);

  const logout = useCallback(() => {
    clearPending();
    authStore.clear();
    setStatus("UNAUTHENTICATED");
  }, [clearPending]);

  const acceptAuthenticatedResult = useCallback(
    async (result: Extract<AdminLoginResult, { access_token: string }>) => {
      // SECURITY: Do not trust token presence; validate it against a backend-protected endpoint.
      // We temporarily store tokens so the auth header can be attached, but we fail closed and clear
      // everything immediately if validation fails.
      try {
        authStore.set({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          id_token: result.id_token,
          token_type: result.token_type,
          user: result.user,
        });

        await adminMe();

        authStore.setMfaEnrollmentRequired(result.mfa_hint === "MFA_NOT_PRESENT");
        clearPending();
        setStatus("AUTHENTICATED");
        return "AUTHENTICATED" as const;
      } catch {
        authStore.clear();
        throw new Error("Sign-in failed. Please try again.");
      }
    },
    [clearPending]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthStatus> => {
      clearPending();

      const result = await adminLogin(email, password);

      if (isMfaSetupRequired(result)) {
        setPendingMfaSetup({
          email: result.email,
          session: result.session,
          qrCodeUri: result.qr_code_uri,
          secret: result.secret,
        });
        setStatus("MFA_SETUP_REQUIRED");
        return "MFA_SETUP_REQUIRED";
      }

      if (isMfaVerificationRequired(result)) {
        // Some backend responses intentionally omit session (forces re-login). Fail closed.
        if (!result.session) {
          logout();
          throw new Error("Please sign in again.");
        }

        setPendingMfaVerify({ email: result.email, session: result.session });
        setStatus("MFA_VERIFICATION_REQUIRED");
        return "MFA_VERIFICATION_REQUIRED";
      }

      if (isAuthenticatedResult(result)) {
        // SECURITY: We do not decode JWTs; authorization is enforced by backend.
        // We only use backend-provided user payload for UX.
        return await acceptAuthenticatedResult(result);
      }

      // Defensive fallback
      logout();
      return "UNAUTHENTICATED";
    },
    [acceptAuthenticatedResult, clearPending, logout]
  );

  const submitTotpCode = useCallback(
    async (code: string): Promise<AuthStatus> => {
      const pending = pendingMfaVerify ?? pendingMfaSetup;
      if (!pending) {
        // Secure default: no partial state means restart login.
        logout();
        return "UNAUTHENTICATED";
      }

      const result = await adminVerifyMfa(pending.email, pending.session, code);

      if (isMfaSetupRequired(result)) {
        setPendingMfaVerify(null);
        setPendingMfaSetup({
          email: result.email,
          session: result.session,
          qrCodeUri: result.qr_code_uri,
          secret: result.secret,
        });
        setStatus("MFA_SETUP_REQUIRED");
        return "MFA_SETUP_REQUIRED";
      }

      if (isMfaVerificationRequired(result)) {
        if (!result.session) {
          logout();
          throw new Error("Please sign in again.");
        }
        setPendingMfaSetup(null);
        setPendingMfaVerify({ email: result.email, session: result.session });
        setStatus("MFA_VERIFICATION_REQUIRED");
        return "MFA_VERIFICATION_REQUIRED";
      }

      if (isAuthenticatedResult(result)) {
        return await acceptAuthenticatedResult(result);
      }

      logout();
      return "UNAUTHENTICATED";
    },
    [acceptAuthenticatedResult, logout, pendingMfaSetup, pendingMfaVerify]
  );

  useEffect(() => {
    // Bootstrap: if tokens exist in storage, validate with backend before treating as authenticated.
    let cancelled = false;

    const run = async () => {
      setIsBootstrapping(true);
      try {
        const token = authStore.getAccessToken();
        if (!token) {
          if (!cancelled) setStatus("UNAUTHENTICATED");
          return;
        }

        await adminMe();
        if (!cancelled) setStatus("AUTHENTICATED");
      } catch {
        // Fail closed on any error.
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isBootstrapping,
      user,
      pendingMfaSetup,
      pendingMfaVerify,
      loginWithPassword,
      submitTotpCode,
      logout,
    }),
    [
      status,
      isBootstrapping,
      user,
      pendingMfaSetup,
      pendingMfaVerify,
      loginWithPassword,
      submitTotpCode,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getGenericAuthErrorMessage(e: unknown): string {
  const err = e as ApiError;
  // SECURITY: generic messaging; avoid exposing backend/cognito details.
  return err?.message || "Sign-in failed. Please try again.";
}
