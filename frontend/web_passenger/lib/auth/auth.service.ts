"use client";

import { passengerAuthLogin, passengerAuthLogout, extractMessage } from "./auth.api";
import { getErrorMessage } from "./schemas";

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Auth service is UI-agnostic orchestration.
 *
 * Notes:
 * - Tokens are stored as httpOnly cookies by our Next route handlers.
 * - Frontend does NOT make authorization decisions; backend is the source of truth.
 */
export const authService = {
  async loginWithPassword(input: { email: string; password: string }): Promise<LoginResult> {
    const res = await passengerAuthLogin(input);
    if (res.ok) return { ok: true };

    // status === 0 => network / fetch failure
    if (res.status === 0) return { ok: false, message: "Network error. Please try again." };

    const msg = getErrorMessage(res.payload) ?? extractMessage(res.payload) ?? "Invalid credentials";
    return { ok: false, message: msg };
  },

  async logoutBestEffort(): Promise<void> {
    // Always try to logout; UI will redirect regardless.
    await passengerAuthLogout();
  },
};
