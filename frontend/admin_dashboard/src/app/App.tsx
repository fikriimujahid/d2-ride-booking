import React, { useEffect } from "react";
import { LoginScreen } from "./components/auth/LoginScreen";
import { useAuthState } from "./auth/useAuthState.tsx";
import { onAuthErrorEvent } from "./routing/authEvents";
import { useNavigation } from "./routing/useNavigation.tsx";
import { routes } from "./routing/routes.tsx";

/**
 * Router Component
 *
 * Handles:
 * 1) URL path matching
 * 2) Auth guard (ADMIN-only)
 * 3) MFA guard (route-level)
 * 4) Centralized API error redirects (MFA_REQUIRED, RBAC, etc.)
 * 5) Browser back/forward navigation
 */
function Router() {
  const { navigate, pathname, searchParams } = useNavigation();
  const { isAuthenticated, mfaEnrollmentRequired, logout, setMfaEnrollmentRequired } =
    useAuthState();

  // Centralized auth decisions based on API error codes.
  // The backend is the source of truth for MFA and RBAC.
  useEffect(() => {
    return onAuthErrorEvent(({ code }) => {
      // Explicit control flow is preferred here on purpose.
      if (code === "AUTH_UNAUTHENTICATED") {
        logout();
        navigate("/login");
        return;
      }

      if (code === "RBAC_INSUFFICIENT_ROLE") {
        // User is signed in, but not allowed to perform an admin action.
        navigate("/forbidden");
        return;
      }

      if (code === "MFA_NOT_ENROLLED") {
        // Enrollment required -> go directly to setup.
        setMfaEnrollmentRequired(true);
        navigate("/mfa/setup");
        return;
      }

      if (code === "MFA_REQUIRED") {
        // Requirement from spec: MFA_REQUIRED -> redirect to MFA setup screen.
        setMfaEnrollmentRequired(true);
        navigate("/mfa/setup");
        return;
      }
    });
  }, [navigate, logout, setMfaEnrollmentRequired]);

  // Route matching by pathname only.
  const matchedRoute = routes.find((r) => r.path === pathname) || null;

  // 404 fallback: keep it simple by sending users to /login.
  if (!matchedRoute) {
    navigate("/login");
    return null;
  }

  /**
   * Public route behavior
   *
   * If a signed-in user hits /login (or /), send them to the correct place:
   * - MFA setup (if enrollment is required)
   * - Admin app (if MFA is already satisfied)
   */
  if (
    !matchedRoute.requiresAuth &&
    isAuthenticated &&
    (pathname === "/" || pathname === "/login")
  ) {
    navigate(mfaEnrollmentRequired ? "/mfa/setup" : "/app");
    return null;
  }

  /**
   * Auth guard
   *
   * If the route requires auth and the user is not authenticated,
   * show the login screen.
   */
  if (matchedRoute.requiresAuth && !isAuthenticated) {
    return (
      <LoginScreen
        onLogin={(opts) => {
          if (opts?.mfaEnrollmentRequired) {
            navigate("/mfa/setup");
          } else {
            navigate("/app");
          }
        }}
      />
    );
  }

  /**
   * MFA guard
   *
   * Keep routing predictable:
   * - Any route marked requiresMfa will redirect to setup if enrollment is needed.
   * - The API can still force /mfa/setup using MFA_REQUIRED.
   */
  if (matchedRoute.requiresMfa && mfaEnrollmentRequired) {
    navigate("/mfa/setup");
    return null;
  }

  const Component = matchedRoute.component;

  // Route props are explicit; no magic contexts.
  // If a case cannot be simplified without changing behavior, we leave it explicit.
  const renderByPath: Record<string, () => React.ReactElement | null> = {
    "/mfa/setup": () => (
      <Component
        onDone={() => {
          // Enrollment flow logs out; user signs in again.
          navigate("/login");
        }}
      />
    ),
    "/forbidden": () => (
      <Component
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />
    ),
    "/app": () => {
      const module = searchParams.get("module") || "dashboard";
      return (
        <Component
          module={module}
          onModuleChange={(nextModule: string) =>
            navigate(`/app?module=${encodeURIComponent(nextModule)}`)
          }
          onLogout={() => {
            logout();
            navigate("/login");
          }}
        />
      );
    },
    "/": () => (
      <Component
        onLogin={(opts?: { mfaEnrollmentRequired?: boolean }) => {
          if (opts?.mfaEnrollmentRequired) {
            navigate("/mfa/setup");
          } else {
            navigate("/app");
          }
        }}
      />
    ),
    "/login": () => (
      <Component
        onLogin={(opts?: { mfaEnrollmentRequired?: boolean }) => {
          if (opts?.mfaEnrollmentRequired) {
            navigate("/mfa/setup");
          } else {
            navigate("/app");
          }
        }}
      />
    ),
  };

  const render = renderByPath[pathname];
  if (render) return render();

  // Default render (should be unreachable because routes are explicit).
  return <Component />;
}

export default function App() {
  return <Router />;
}