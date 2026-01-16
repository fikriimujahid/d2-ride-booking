import type { ErrorCode } from "../api/types";

export const AUTH_ERROR_EVENT = "rideadmin:auth-error" as const;

export type AuthErrorEventDetail = {
  code: ErrorCode;
  message?: string;
};

export function emitAuthErrorEvent(detail: AuthErrorEventDetail) {
  // Simple event bus for auth failures.
  // This avoids sprinkling navigation side effects (logout/redirect) throughout API callers.
  window.dispatchEvent(new CustomEvent<AuthErrorEventDetail>(AUTH_ERROR_EVENT, { detail }));
}

export function onAuthErrorEvent(handler: (detail: AuthErrorEventDetail) => void) {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<AuthErrorEventDetail>;
    if (!ce?.detail?.code) return;
    handler(ce.detail);
  };

  window.addEventListener(AUTH_ERROR_EVENT, listener);
  return () => window.removeEventListener(AUTH_ERROR_EVENT, listener);
}
