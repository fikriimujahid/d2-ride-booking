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
  | "AUTHENTICATED";

type AuthContextValue = {
  status: AuthStatus;
  isBootstrapping: boolean;
  user: AuthUser | null;

  loginWithPassword: (email: string, password: string) => Promise<AuthStatus>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("UNAUTHENTICATED");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [user, setUser] = useState<AuthUser | null>(authStore.getUser());

  const hasPermission = useCallback((permission: string) => {
    return authStore.hasPermission(permission);
  }, []);

  const logout = useCallback(() => {
    // Best-effort server-side logout; always clear local state.
    void authClient.logout();
    setUser(null);
    setStatus("UNAUTHENTICATED");
  }, []);

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
    await authClient.login(email, password);
    setUser(authStore.getUser());
    setStatus("AUTHENTICATED");
    return "AUTHENTICATED";
  }, []);

  const value = useMemo(() => ({
    status,
    isBootstrapping,
    user,
    hasPermission,
    loginWithPassword,
    logout
  }), [
    status,
    isBootstrapping,
    user,
    hasPermission,
    loginWithPassword,
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
