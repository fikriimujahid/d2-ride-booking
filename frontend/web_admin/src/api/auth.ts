import client from './client';
import { 
  LoginDto, 
  AuthResponse, 
  RespondChallengeDto, 
  SetupMfaDto, 
  SetupMfaResponse, 
  VerifyMfaDto,
  AuthUser,
  AdminContext
} from './types';

export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await client.post<AuthResponse>('/auth/admin/login', data);
    return response.data;
  },

  respondToChallenge: async (data: RespondChallengeDto): Promise<AuthResponse> => {
    const response = await client.post<AuthResponse>('/auth/admin/respond-challenge', data);
    return response.data;
  },

  setupMfa: async (data: SetupMfaDto): Promise<SetupMfaResponse> => {
    const response = await client.post<SetupMfaResponse>('/auth/mfa/setup', data);
    return response.data;
  },

  verifyMfa: async (data: VerifyMfaDto): Promise<void> => {
    await client.post('/auth/mfa/verify', data);
  },

  /**
   * Get current admin context (identity, roles, permissions)
   * 
   * This is the single source of truth for admin permissions and should be called
   * ONCE after successful login/2FA to populate the auth store.
   * 
   * @returns AdminContext with identity, roles, and flattened permissions
   */
  getAdminContext: async (): Promise<AdminContext> => {
    const response = await client.get<AdminContext>('/admin/me');
    return response.data;
  },

  /**
   * @deprecated Use getAdminContext() instead
   */
  getMe: async (): Promise<AuthUser> => {
    const response = await client.get<AuthUser>('/auth/whoami');
    return response.data;
  },

  // Helper to decode user from token (basic decoding)
  // In a real app we might verify signature or use a library like valid-token
  getUserFromToken: (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }
};
