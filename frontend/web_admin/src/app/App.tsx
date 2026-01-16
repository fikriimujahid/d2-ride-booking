import React, { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { LoginScreen } from "./components/auth/LoginScreen";
import { MfaEnrollmentFlow } from "./components/auth/MfaEnrollmentFlow";
import { MfaChallengeScreen } from "./components/auth/MfaChallengeScreen";
import { ForbiddenPage } from "./components/auth/ForbiddenPage";
import { AdminShell } from "./components/layout/AdminShell";

import { onAuthErrorEvent } from "./routing/authEvents";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./routing/ProtectedRoute";
import { getSafeModule } from "./routing/guards";

function FullPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-600">Loading…</p>
    </div>
  );
}

function AuthErrorListener() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    return onAuthErrorEvent(({ code }) => {
      // SECURITY: backend is the source of truth.
      // We listen for auth-related API failures and make the UI respond consistently.
      // This prevents scattered "if 401 then ..." logic across screens.
      // 401 => logout + login
      if (code === "AUTH_UNAUTHENTICATED" || code === "AUTH_TOKEN_EXPIRED") {
        logout();
        navigate("/login", { replace: true });
        return;
      }

      // 403 => either MFA flow or forbidden or login (fail closed)
      if (code === "RBAC_INSUFFICIENT_ROLE") {
        // Example: user has a valid token but is not allowed to use this admin surface.
        navigate("/forbidden", { replace: true });
        return;
      }

      if (code === "AUTH_FORBIDDEN") {
        // Fail closed: if the backend says we are forbidden and we can't reconcile it locally,
        // drop the session and require a fresh login.
        logout();
        navigate("/login", { replace: true });
        return;
      }
    });
  }, [logout, navigate]);

  return null;
}

function LoginRoute() {
  const { status, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullPageLoading />;
  // Post-login routing is entirely driven by AuthContext status.
  // This keeps edge cases (MFA required, expired session) consistent.
  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  if (status === "MFA_SETUP_REQUIRED") return <Navigate to="/mfa/setup" replace />;
  if (status === "MFA_CHALLENGE") return <Navigate to="/mfa/challenge" replace />;
  return <LoginScreen />;
}

function MfaSetupRoute() {
  const navigate = useNavigate();
  const { status, isBootstrapping } = useAuth();
  if (isBootstrapping) return <FullPageLoading />;

  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  if (status !== "MFA_SETUP_REQUIRED") return <Navigate to="/login" replace />;

  return <MfaEnrollmentFlow onDone={() => navigate("/login", { replace: true })} />;
}

function MfaChallengeRoute() {
  const navigate = useNavigate();
  const { status, isBootstrapping, logout } = useAuth();
  if (isBootstrapping) return <FullPageLoading />;

  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  if (status !== "MFA_CHALLENGE") return <Navigate to="/login" replace />;

  return (
    <MfaChallengeScreen
      onCancel={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    />
  );
}

function AdminShellRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuth();

  const requestedModule = searchParams.get("module") || "dashboard";
  const safeModule = getSafeModule(requestedModule);

  useEffect(() => {
    // This enforces a safe landing module based on current RBAC permissions.
    // If the URL asks for a module the user doesn't have access to, we redirect to the
    // first authorized module (or /forbidden if none).
    if (!safeModule) {
      navigate("/forbidden", { replace: true });
      return;
    }
    if (safeModule !== requestedModule) {
      navigate(`/app?module=${encodeURIComponent(safeModule)}`, { replace: true });
    }
  }, [navigate, requestedModule, safeModule]);

  const module = safeModule || "dashboard";
  return (
    <AdminShell
      module={module}
      onModuleChange={(nextModule: string) =>
        navigate(`/app?module=${encodeURIComponent(nextModule)}`)
      }
      onLogout={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    />
  );
}

function ForbiddenRoute() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <ForbiddenPage
      onLogout={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    />
  );
}

function AppRoutes() {
  return (
    <>
      <AuthErrorListener />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/mfa/setup" element={<MfaSetupRoute />} />
        <Route path="/mfa/challenge" element={<MfaChallengeRoute />} />
        <Route path="/forbidden" element={<ForbiddenRoute />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AdminShellRoute />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}