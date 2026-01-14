export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  timestamp?: string;
};

// Matches backend error contract: api/src/models/error.model.ts
export type ErrorCode =
  | "AUTH_UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "MFA_NOT_ENROLLED"
  | "RBAC_INSUFFICIENT_ROLE"
  | "AUTH_FORBIDDEN"
  | "AUTH_TOKEN_EXPIRED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | string;

export type ApiErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    action?: string;
    details?: Record<string, unknown>;
  };
};

export type SystemRole = "PASSENGER" | "DRIVER" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
  system_role: SystemRole;
  two_factor_enabled?: boolean;
  roles: string[];
  permissions: string[];
};

/**
 * AdminContext - response from GET /admin/me
 *
 * This is the frontend's RBAC source of truth (UX-only checks).
 * Backend still enforces permissions on every request.
 */
export type AdminContext = {
  identity: {
    id: string;
    email: string;
    name?: string;
  };
  roles: string[];
  permissions: string[];
  featureFlags?: Record<string, boolean>;
  metadata?: {
    environment?: string;
    organization?: string;
  };
};

export type AdminLoginResult =
  | {
      // Backend: admin needs to enroll TOTP (no access/refresh token yet)
      twoFactorRequired: true;
      setupToken: string;
      expiresAt: string;
    }
  | {
      // Backend: admin has TOTP enrolled and must respond to SOFTWARE_TOKEN_MFA
      challengeName: "SOFTWARE_TOKEN_MFA";
      session: string;
      expiresAt: string;
    }
  | {
      // Defensive: token response shape (some older code paths used this)
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    };

export class ApiError extends Error {
  status: number;
  code?: ErrorCode;
  action?: string;
  details?: Record<string, unknown>;

  constructor(params: {
    message: string;
    status: number;
    code?: ErrorCode;
    action?: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.action = params.action;
    this.details = params.details;
  }
}
