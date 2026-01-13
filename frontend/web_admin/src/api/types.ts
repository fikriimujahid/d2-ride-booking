export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface ApiError {
  status: number;
  message: string;
  data?: unknown;
}

// --- Auth DTOs ---

export interface LoginDto {
  email: string;
  password: string;
}

export interface RespondChallengeDto {
  username: string;
  session: string;
  challengeName: string;
  response?: string;
}

export interface SetupMfaDto {
  accessToken: string;
}

export interface VerifyMfaDto {
  accessToken: string;
  code: string;
}

// --- Auth Responses ---

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthChallenge {
  challengeName: 'NEW_PASSWORD_REQUIRED' | 'SOFTWARE_TOKEN_MFA' | 'MFA_SETUP' | string;
  session: string;
  parameters?: Record<string, string>;
}

export interface AuthResponse {
  status: 'success' | 'challenge';
  tokens?: AuthTokens;
  challengeName?: string;
  session?: string;
  parameters?: Record<string, string>;
}

export interface SetupMfaResponse {
  secretCode: string;
  qrCode: string;
  status?: string;
  message?: string;
}

/**
 * Admin Context - Comprehensive Admin User Information
 * 
 * This is the response from GET /admin/me, representing the single source of truth
 * for admin identity, roles, and permissions after successful authentication.
 * 
 * USAGE:
 * - Fetch ONCE after login/2FA completion
 * - Store in auth context/store
 * - Use permissions array for frontend feature gating
 * - Backend still validates permissions on every protected endpoint
 * 
 * MIGRATION-READY:
 * - This structure is independent of the auth provider (JWT, Cognito, etc.)
 * - Frontend code using AdminContext will not break during Cognito migration
 */
export interface AdminContext {
  identity: {
    id: string;              // User UUID
    email: string;           // Admin email
    userType: 'ADMIN';       // System role (always ADMIN)
    name?: string;           // Optional display name
  };
  roles: string[];           // Assigned role names (e.g., ["super_admin"])
  permissions: string[];     // Flattened permission keys (e.g., ["admin.dashboard.view"])
  metadata?: {
    organization?: string;
    environment?: string;
    featureFlags?: Record<string, boolean>;
  };
}

/**
 * @deprecated Use AdminContext instead
 * Kept for backward compatibility during migration
 */
export interface AuthUser {
  id: string;
  email: string;
  groups: string[];
  system_role?: string;
  roles?: string[];
  permissions?: string[];
}


