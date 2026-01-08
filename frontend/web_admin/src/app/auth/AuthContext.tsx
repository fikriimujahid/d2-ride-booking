import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authStore } from "./authStore";
import type { AuthUser } from "../api/types";
import { authClient } from "../../services/authClient";

export type AuthStatus =
  | "UNAUTHENTICATED"
  | "MFA_SETUP_REQUIRED"
  | "MFA_VERIFICATION_REQUIRED"
  | "AUTHENTICATED";

type PendingMfaSetup = {
  email: string;
  enrollToken: string;
  qrCodeUri: string;
  secret: string;
};

type PendingMfaVerify = {
  email: string;
  mfaToken: string;
};

type AuthContextValue = {
  status: AuthStatus;
  isBootstrapping: boolean;
  user: AuthUser | null;

  pendingMfaSetup: PendingMfaSetup | null;
  pendingMfaVerify: PendingMfaVerify | null;

  loginWithPassword: (email: string, password: string) => Promise<AuthStatus>;
  submitTotpCode: (code: string) => Promise<AuthStatus>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("UNAUTHENTICATED");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [pendingMfaSetup, setPendingMfaSetup] = useState<PendingMfaSetup | null>(null);
  const [pendingMfaVerify, setPendingMfaVerify] = useState<PendingMfaVerify | null>(null);

  const [user, setUser] = useState<AuthUser | null>(authStore.getUser());

  const hasPermission = useCallback((permission: string) => {
    return authStore.hasPermission(permission);
  }, []);

  const clearPending = useCallback(() => {
    setPendingMfaSetup(null);
    setPendingMfaVerify(null);
  }, []);

  const logout = useCallback(() => {
    clearPending();
    // Best-effort server-side logout; always clear local state.
    void authClient.logout();
    setUser(null);
    setStatus("UNAUTHENTICATED");
  }, [clearPending]);

  // Init from store
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const stored = authStore.get();
        if (stored?.access_token) {
          try {
            await authClient.bootstrap();
            if (cancelled) return;
            setStatus("AUTHENTICATED");
            setUser(authStore.getUser());
          } catch {
            authClient.clear();
            if (cancelled) return;
            setStatus("UNAUTHENTICATED");
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string): Promise<AuthStatus> => {
    clearPending();
    const result = await authClient.login(email, password);

    if (result.next === "MFA_VERIFY") {
      setPendingMfaVerify({ email, mfaToken: result.mfaToken });
      setStatus("MFA_VERIFICATION_REQUIRED");
      return "MFA_VERIFICATION_REQUIRED";
    }

    const setup = await authClient.getEnrollmentSetup(result.enrollToken);
    setPendingMfaSetup({
      email,
      enrollToken: result.enrollToken,
      qrCodeUri: setup.qrCodeDataUrl,
      secret: setup.secret,
    });
    setStatus("MFA_SETUP_REQUIRED");
    return "MFA_SETUP_REQUIRED";
  }, [clearPending]);

  const submitTotpCode = useCallback(async (code: string): Promise<AuthStatus> => {
    if (pendingMfaSetup) {
      await authClient.confirmEnrollment({
        email: pendingMfaSetup.email,
        enrollToken: pendingMfaSetup.enrollToken,
        code,
      });

      setUser(authStore.getUser());
      clearPending();
      setStatus("AUTHENTICATED");
      return "AUTHENTICATED";
    }

    if (pendingMfaVerify) {
      await authClient.verifyMfa({
        email: pendingMfaVerify.email,
        mfaToken: pendingMfaVerify.mfaToken,
        code,
      });

      setUser(authStore.getUser());
      clearPending();
      setStatus("AUTHENTICATED");
      return "AUTHENTICATED";
    }

    throw new Error("No pending 2FA step");
  }, [clearPending, pendingMfaSetup, pendingMfaVerify]);

  const value = useMemo(() => ({
    status,
    isBootstrapping,
    user,
    pendingMfaSetup,
    pendingMfaVerify,
    hasPermission,
    loginWithPassword,
    submitTotpCode,
    logout
  }), [
    status,
    isBootstrapping,
    user,
    pendingMfaSetup,
    pendingMfaVerify,
    hasPermission,
    loginWithPassword,
    submitTotpCode,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getGenericAuthErrorMessage(e: unknown): string {
  const err = e as { message?: unknown };
  return typeof err?.message === "string" && err.message ? err.message : "Sign-in failed. Please try again.";
}
