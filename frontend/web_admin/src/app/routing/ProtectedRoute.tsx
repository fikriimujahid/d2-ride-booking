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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === "MFA_SETUP_REQUIRED") {
    return <Navigate to="/mfa/setup" replace />;
  }

  if (status === "MFA_VERIFICATION_REQUIRED") {
    return <Navigate to="/mfa/verify" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
