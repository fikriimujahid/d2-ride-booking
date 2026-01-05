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
import { MfaSetupScreen } from "./components/auth/MfaSetupScreen";
import { MfaVerifyScreen } from "./components/auth/MfaVerifyScreen";
import { ForbiddenPage } from "./components/auth/ForbiddenPage";
import { AdminShell } from "./components/layout/AdminShell";

import { onAuthErrorEvent } from "./routing/authEvents";
import { authStore } from "./auth/authStore";
import { AuthProvider, useAuth } from "./auth/AuthContext";

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
      // 401 => logout + login
      if (code === "AUTH_UNAUTHENTICATED" || code === "AUTH_TOKEN_EXPIRED") {
        logout();
        navigate("/login", { replace: true });
        return;
      }

      // 403 => either MFA flow or forbidden or login (fail closed)
      if (code === "MFA_NOT_ENROLLED" || code === "MFA_REQUIRED") {
        authStore.setMfaEnrollmentRequired(true);
        navigate("/mfa/setup", { replace: true });
        return;
      }

      if (code === "RBAC_INSUFFICIENT_ROLE") {
        navigate("/forbidden", { replace: true });
        return;
      }

      if (code === "AUTH_FORBIDDEN") {
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
  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  if (status === "MFA_SETUP_REQUIRED") return <Navigate to="/mfa/setup" replace />;
  if (status === "MFA_VERIFICATION_REQUIRED") return <Navigate to="/mfa/verify" replace />;
  return <LoginScreen />;
}

function MfaSetupRoute() {
  const { status, isBootstrapping, logout } = useAuth();

  if (isBootstrapping) return <FullPageLoading />;

  // Login-time setup (no tokens)
  if (status === "MFA_SETUP_REQUIRED") return <MfaSetupScreen />;

  // Authenticated enrollment flow (tokens exist but backend requires enrolling)
  if (status === "AUTHENTICATED" && authStore.isMfaEnrollmentRequired()) {
    return (
      <MfaEnrollmentFlow
        onDone={() => {
          logout();
        }}
      />
    );
  }

  if (status === "MFA_VERIFICATION_REQUIRED") return <Navigate to="/mfa/verify" replace />;
  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  return <Navigate to="/login" replace />;
}

function MfaVerifyRoute() {
  const { status, isBootstrapping } = useAuth();
  if (isBootstrapping) return <FullPageLoading />;
  if (status === "MFA_VERIFICATION_REQUIRED") return <MfaVerifyScreen />;
  if (status === "MFA_SETUP_REQUIRED") return <Navigate to="/mfa/setup" replace />;
  if (status === "AUTHENTICATED") return <Navigate to="/app" replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuthenticated(props: { children: React.ReactElement }) {
  const { status, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullPageLoading />;
  if (status === "AUTHENTICATED") return props.children;
  if (status === "MFA_SETUP_REQUIRED") return <Navigate to="/mfa/setup" replace />;
  if (status === "MFA_VERIFICATION_REQUIRED") return <Navigate to="/mfa/verify" replace />;
  return <Navigate to="/login" replace />;
}

function AdminShellRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuth();

  const module = searchParams.get("module") || "dashboard";
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
        <Route path="/mfa/verify" element={<MfaVerifyRoute />} />
        <Route path="/forbidden" element={<ForbiddenRoute />} />
        <Route
          path="/app"
          element={
            <RequireAuthenticated>
              <AdminShellRoute />
            </RequireAuthenticated>
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