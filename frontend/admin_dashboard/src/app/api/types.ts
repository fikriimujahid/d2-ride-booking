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

export type AdminLoginResult =
  | {
      // Backend-supported state: MFA_SETUP_REQUIRED
      // SECURITY: the client receives only an opaque `session` (sealed by backend), never Cognito session details.
      mfa_required: true;
      status: "MFA_SETUP_REQUIRED";
      email: string;
      session: string;
      qr_code_uri: string;
      secret: string;

      // Back-compat fields (do not use for UI decisions)
      challenge_name?: string;
    }
  | {
      // Backend-supported state: MFA_VERIFICATION_REQUIRED
      // SECURITY: `session` is an opaque backend token; UI must never display it.
      mfa_required: true;
      status: "MFA_VERIFICATION_REQUIRED";
      email: string;

      // Some backend responses require re-login and may omit session.
      // Secure default: frontend should fail closed and send user back to password login.
      session?: string;

      // Back-compat field (do not use for UI decisions)
      challenge_name?: string;
    }
  | {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      token_type?: string;
      // Hint only for UX routing; backend remains the source of truth.
      mfa_hint?: "MFA_NOT_PRESENT";
      user: AuthUser;
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
