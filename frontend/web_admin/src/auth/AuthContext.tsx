import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authStore } from "./authStore";
import type { AuthUser } from "../app/api/types";
import { authClient } from "./authClient";

export type AuthStatus =
  | "UNAUTHENTICATED"
  | "MFA_CHALLENGE"
  | "MFA_SETUP_REQUIRED"
  | "AUTHENTICATED";

type AuthContextValue = {
  status: AuthStatus;
  isBootstrapping: boolean;
  user: AuthUser | null;

  mfaChallenge: { session: string; expiresAt: string; email: string } | null;
  totpSetup: { setupToken: string; expiresAt: string; email: string } | null;

  loginWithPassword: (email: string, password: string) => Promise<AuthStatus>;
  submitMfaOtp: (otp: string) => Promise<void>;
  startTotpEnrollment: () => Promise<{ secretBase32: string; otpauthUrl: string; qrCodeDataUrl: string }>;
  verifyTotpEnrollment: (otp: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("UNAUTHENTICATED");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [user, setUser] = useState<AuthUser | null>(authStore.getUser());
  const [mfaChallenge, setMfaChallenge] = useState<AuthContextValue["mfaChallenge"]>(null);
  const [totpSetup, setTotpSetup] = useState<AuthContextValue["totpSetup"]>(null);

  const hasPermission = useCallback((permission: string) => {
    return authStore.hasPermission(permission);
  }, []);

  const logout = useCallback(() => {
    void authClient.logout();
    setUser(null);
    setMfaChallenge(null);
    setTotpSetup(null);
    setStatus("UNAUTHENTICATED");
  }, []);

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
            setMfaChallenge(null);
            setTotpSetup(null);
          } catch {
            authClient.clear();
            if (cancelled) return;
            setStatus("UNAUTHENTICATED");
            setUser(null);
            setMfaChallenge(null);
            setTotpSetup(null);
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
    const result = await authClient.login(email, password);

    if (result.kind === "AUTHENTICATED") {
      setUser(authStore.getUser());
      setMfaChallenge(null);
      setTotpSetup(null);
      setStatus("AUTHENTICATED");
      return "AUTHENTICATED";
    }

    if (result.kind === "MFA_CHALLENGE") {
      setUser(null);
      setTotpSetup(null);
      setMfaChallenge({ session: result.session, expiresAt: result.expiresAt, email });
      setStatus("MFA_CHALLENGE");
      return "MFA_CHALLENGE";
    }

    setUser(null);
    setMfaChallenge(null);
    setTotpSetup({ setupToken: result.setupToken, expiresAt: result.expiresAt, email });
    setStatus("MFA_SETUP_REQUIRED");
    return "MFA_SETUP_REQUIRED";
  }, []);

  const submitMfaOtp = useCallback(async (otp: string) => {
    if (!mfaChallenge) {
      throw new Error("No MFA challenge in progress");
    }
    await authClient.respondToMfaChallenge({ session: mfaChallenge.session, otp, email: mfaChallenge.email });
    setUser(authStore.getUser());
    setMfaChallenge(null);
    setTotpSetup(null);
    setStatus("AUTHENTICATED");
  }, [mfaChallenge]);

  const startTotpEnrollment = useCallback(async () => {
    if (!totpSetup) {
      throw new Error("No TOTP setup in progress");
    }
    return await authClient.startTotpSetup(totpSetup.setupToken);
  }, [totpSetup]);

  const verifyTotpEnrollment = useCallback(async (otp: string) => {
    if (!totpSetup) {
      throw new Error("No TOTP setup in progress");
    }
    await authClient.verifyTotpSetup({ setupToken: totpSetup.setupToken, otp, email: totpSetup.email });
    setUser(authStore.getUser());
    setMfaChallenge(null);
    setTotpSetup(null);
    setStatus("AUTHENTICATED");
  }, [totpSetup]);

  const value = useMemo(() => ({
    status,
    isBootstrapping,
    user,
    mfaChallenge,
    totpSetup,
    hasPermission,
    loginWithPassword,
    submitMfaOtp,
    startTotpEnrollment,
    verifyTotpEnrollment,
    logout,
  }), [
    status,
    isBootstrapping,
    user,
    mfaChallenge,
    totpSetup,
    hasPermission,
    loginWithPassword,
    submitMfaOtp,
    startTotpEnrollment,
    verifyTotpEnrollment,
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
