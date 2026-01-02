import { apiRequest } from "./http";
import type { AdminLoginResult } from "./types";

export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  return apiRequest<AdminLoginResult>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function adminVerifyMfa(
  email: string,
  session: string,
  code: string
): Promise<Extract<AdminLoginResult, { access_token: string }>> {
  return apiRequest<Extract<AdminLoginResult, { access_token: string }>>(
    "/auth/admin/mfa/verify",
    {
    method: "POST",
    body: JSON.stringify({ email, session, code }),
    }
  );
}

export async function adminRefresh(refresh_token: string, email: string) {
  return apiRequest<{ access_token: string; id_token?: string; expires_in?: number }>(
    "/auth/admin/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token, email }),
    }
  );
}

export async function adminLogout() {
  return apiRequest<{ message: string }>("/auth/admin/logout", {
    method: "POST",
    auth: true,
  });
}

export async function adminMfaSetup() {
  return apiRequest<{ qr_code_uri: string; secret: string }>("/auth/mfa/setup", {
    method: "POST",
    auth: true,
  });
}

export async function adminMfaVerify(code: string) {
  return apiRequest<{ status: "MFA_ENABLED"; next_action: "RELOGIN_REQUIRED" }>(
    "/auth/mfa/verify",
    {
      method: "POST",
      auth: true,
      body: JSON.stringify({ code }),
    }
  );
}
