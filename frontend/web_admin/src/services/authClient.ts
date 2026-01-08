/**
 * Auth Client - Centralized Authentication Service
 * 
 * This module handles all authentication operations for the Web Admin:
 * - Admin login with email/password
 * - TOTP 2FA enrollment and verification
 * - Token refresh with rotation
 * - Secure token storage (sessionStorage to reduce XSS blast radius)
 * - Logout
 * 
 * SECURITY NOTES:
 * 1. Only Admin users (system_role=ADMIN) can authenticate
 * 2. All Admin logins require TOTP 2FA
 * 3. Tokens stored in sessionStorage (cleared on tab close)
 * 4. Access tokens have short TTL; refresh tokens rotate on use
 * 5. Backend enforces Origin allowlist for Admin endpoints
 */

import { authStore, type AuthState } from "../app/auth/authStore";
import type { AuthUser, AdminContext } from "../app/api/types";

// Backend auth API base
const getAuthApiBase = () => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '');
};

// ===== Type Definitions =====

type LoginResponse =
  | { mfaRequired: true; mfaToken: string }
  | { error: 'TWO_FACTOR_ENROLLMENT_REQUIRED'; enrollToken: string };

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
};

type UserInfoResponse = {
  id: string;
  email: string;
  system_role: string;
  roles: string[];
  permissions: string[];
};

type EnrollmentSetupResponse = {
  secret: string;
  otpauthUri: string;
};

// NOTE: We intentionally do NOT decode JWTs for roles/permissions.
// JWTs are authentication tokens; authorization data comes from GET /admin/me.

// ===== Helper: API request with error handling =====

async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getAuthApiBase()}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include cookies if backend uses them
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  let data: any;
  if (isJson) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Handle error responses
    const message = 
      data?.message || 
      data?.error || 
      (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
    
    throw new Error(message);
  }

  return data as T;
}

// ===== Auth Client Interface =====

export const authClient = {
  /**
   * Admin login - Step 1: Email + Password
   * 
   * Returns either:
   * - { next: 'MFA_VERIFY', mfaToken } if 2FA already enrolled
   * - { next: 'MFA_SETUP', enrollToken } if 2FA enrollment required
   * 
   * SECURITY: Backend validates system_role=ADMIN and Origin
   */
  async login(email: string, password: string): Promise<
    | { next: 'MFA_VERIFY'; mfaToken: string }
    | { next: 'MFA_SETUP'; enrollToken: string }
  > {
    const url = `${getAuthApiBase()}/admin/auth/login`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await response.json();

    // Backend returns 200 with { mfaRequired: true, mfaToken } for enrolled users
    if (response.ok && data.mfaToken) {
      return { next: 'MFA_VERIFY', mfaToken: data.mfaToken };
    }

    // Backend returns 428 with { error: 'TWO_FACTOR_ENROLLMENT_REQUIRED', enrollToken }
    if (response.status === 428 && data.enrollToken) {
      return { next: 'MFA_SETUP', enrollToken: data.enrollToken };
    }

    // Handle errors
    if (!response.ok) {
      const message = data?.message || data?.error || `Login failed with status ${response.status}`;
      throw new Error(message);
    }

    throw new Error('Unexpected login response');
  },

  /**
   * Get TOTP enrollment setup (QR code + secret)
   * 
   * Called when user needs to enroll 2FA for the first time
   */
  async getEnrollmentSetup(enrollToken: string): Promise<{
    secret: string;
    qrCodeDataUrl: string;
  }> {
    const response = await authFetch<EnrollmentSetupResponse>('/admin/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({ enrollToken })
    });

    // Convert otpauthUri to QR code data URL
    // In production, use a QR code library (qrcode package)
    // For now, return the URI - frontend can render it
    const qrCodeDataUrl = await this.generateQrCode(response.otpauthUri);

    return {
      secret: response.secret,
      qrCodeDataUrl
    };
  },

  /**
   * Generate QR code data URL from otpauthUri
   * Uses qrcode library (should be installed: npm install qrcode)
   */
  async generateQrCode(text: string): Promise<string> {
    try {
      // Dynamic import to avoid bundling if not needed
      const QRCode = await import('qrcode');
      return await QRCode.toDataURL(text);
    } catch {
      // Fallback: return text-based representation or empty
      console.warn('QRCode library not available, returning placeholder');
      return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">QR Code: ${encodeURIComponent(text)}</text></svg>`;
    }
  },

  /**
   * Confirm TOTP enrollment with first valid code
   * 
   * On success, stores tokens and user in authStore
   */
  async confirmEnrollment(params: {
    email: string;
    enrollToken: string;
    code: string;
  }): Promise<void> {
    const response = await authFetch<TokenResponse>('/admin/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({
        enrollToken: params.enrollToken,
        code: params.code
      })
    });

    await this.storeTokens(response);
  },

  /**
   * Verify TOTP code during login
   * 
   * On success, stores tokens and user in authStore
   */
  async verifyMfa(params: {
    email: string;
    mfaToken: string;
    code: string;
  }): Promise<void> {
    const response = await authFetch<TokenResponse>('/admin/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        mfaToken: params.mfaToken,
        code: params.code
      })
    });

    await this.storeTokens(response);
  },

  /**
   * Refresh access token using refresh token
   * 
   * Backend rotates refresh tokens on each use
   * Returns new access + refresh tokens
   */
  async refresh(): Promise<void> {
    const currentRefreshToken = authStore.getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await authFetch<TokenResponse>('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: currentRefreshToken })
    });

    await this.storeTokens(response);
  },

  /**
   * Logout - revoke refresh token on backend and clear local state
   */
  async logout(): Promise<void> {
    const refreshToken = authStore.getRefreshToken();
    
    // Always clear local state
    authStore.clear();

    // Best-effort revoke on backend
    if (refreshToken) {
      try {
        await authFetch('/admin/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        // Ignore errors - local state already cleared
      }
    }
  },

  /**
   * Bootstrap - verify existing tokens are still valid
   * 
   * Called on app init to check if user is already authenticated
   * Attempts to refresh if access token is expired but refresh token exists
   */
  async bootstrap(): Promise<void> {
    const state = authStore.get();
    if (!state) {
      throw new Error('No stored auth state');
    }

    // Check if access token is expired
    const expiresAt = new Date(state.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      // Access token expired, try to refresh first.
      await this.refresh();
    }

    // Always refresh admin context on app init.
    // This keeps permissions up-to-date without embedding them in tokens.
    const adminContext = await this.fetchAdminContext();

    const stored = authStore.get();
    if (!stored) throw new Error('Missing stored auth state');

    const user: AuthUser = {
      id: adminContext.identity.id,
      email: adminContext.identity.email,
      groups: [],
      system_role: 'ADMIN',
      roles: adminContext.roles,
      permissions: adminContext.permissions
    };

    const next: AuthState = {
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
      expires_at: stored.expires_at,
      user,
      adminContext
    };
    authStore.set(next);
  },

  /**
   * Clear all auth state
   */
  clear(): void {
    authStore.clear();
  },

  /**
   * Fetch admin context from GET /admin/me
   * 
   * This is the SINGLE SOURCE OF TRUTH for admin permissions.
   * Call ONCE after successful login/2FA to populate authStore.
   * 
   * @returns AdminContext with identity, roles, and permissions
   */
  async fetchAdminContext(): Promise<AdminContext> {
    const accessToken = authStore.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await authFetch<AdminContext>('/admin/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response;
  },

  /**
   * @deprecated Use fetchAdminContext() instead
   * Fetch current user info from /admin/me
   * Requires valid access token in authStore
   */
  async fetchUserInfo(): Promise<AuthUser> {
    const accessToken = authStore.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await authFetch<UserInfoResponse>('/admin/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      id: response.id,
      email: response.email,
      system_role: response.system_role as 'ADMIN' | 'DRIVER' | 'PASSENGER',
      roles: response.roles,
      permissions: response.permissions
    };
  },

  /**
   * Internal: Store tokens and fetch admin context
   * 
   * WORKFLOW:
   * 1. Store tokens in authStore
   * 2. Fetch AdminContext from GET /admin/me
   * 3. Verify user is ADMIN
   * 4. Update authStore with complete AdminContext
   * 
   * SECURITY NOTES:
   * - Tokens stored in sessionStorage (cleared on tab close)
   * - Fetches admin context from /admin/me after storing tokens
   * - Verify user is ADMIN before storing
   * - Never log tokens
   */
  async storeTokens(response: TokenResponse): Promise<void> {
    // First store the tokens temporarily
    const tempState: AuthState = {
      access_token: response.accessToken,
      refresh_token: response.refreshToken,
      expires_at: response.expiresAt,
      user: null as any // Temporary, will be updated
    };
    authStore.set(tempState);

    try {
      // Fetch admin context using the access token
      const adminContext = await this.fetchAdminContext();

      // SECURITY: Verify user is Admin - reject all non-Admin users
      if (adminContext.identity.userType !== 'ADMIN') {
        authStore.clear();
        throw new Error('Access denied. Only Admin users can access this application.');
      }

      // Build legacy AuthUser for backward compatibility
      const user: AuthUser = {
        id: adminContext.identity.id,
        email: adminContext.identity.email,
        groups: [],
        system_role: 'ADMIN',
        roles: adminContext.roles,
        permissions: adminContext.permissions
      };

      // Update with complete admin context
      const authState: AuthState = {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
        expires_at: response.expiresAt,
        user,
        adminContext // NEW: Store the full AdminContext
      };

      authStore.set(authState);
    } catch (error) {
      // If fetching admin context fails, clear tokens
      authStore.clear();
      throw error;
    }
  }
};
