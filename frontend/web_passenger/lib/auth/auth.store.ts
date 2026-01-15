"use client";

import { authService, type LoginResult } from "./auth.service";

/**
 * Minimal client-side auth store.
 *
 * Because tokens are httpOnly cookies, the browser cannot read auth state directly.
 * This store intentionally exposes only *actions* (login/logout) and keeps
 * authorization decisions on the backend.
 */
export const authStore = {
  loginWithPassword(email: string, password: string): Promise<LoginResult> {
    return authService.loginWithPassword({ email, password });
  },

  logoutBestEffort(): Promise<void> {
    return authService.logoutBestEffort();
  },
};
