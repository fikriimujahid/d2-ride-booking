import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type ProtectedRouteProps = {
  requiredPermission?: string;
  children?: React.ReactNode;
};

export function ProtectedRoute({ requiredPermission, children }: ProtectedRouteProps) {
  const { status, isBootstrapping, hasPermission, user } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    );
  }

  if (status === "UNAUTHENTICATED") {
    // If not authenticated, we redirect to /login and preserve where the user was trying to go.
    // Note: this is a UX improvement; backend is still the real enforcement point.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === "MFA_SETUP_REQUIRED") {
    return <Navigate to="/mfa/setup" replace />;
  }

  if (status === "MFA_CHALLENGE") {
    return <Navigate to="/mfa/challenge" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Authenticated but not authorized.
    // We fail closed in the UI (navigate to a forbidden page) even though API calls would be denied anyway.
    return <Navigate to="/forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
