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
      mfa_required: true;
      email: string;
      session: string;
      challenge_name: string;
    }
  | {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      token_type?: string;
      mfa_hint?: 'MFA_NOT_PRESENT';
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
