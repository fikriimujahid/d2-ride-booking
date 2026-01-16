import { safeJsonParse } from "../shared/json";
import { getNumber, getRecord, getString } from "../shared/typeGuards";

export type DecodedJwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
  typ?: string;
};

function base64UrlDecodeToString(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string): DecodedJwtPayload {
  // NOTE: This does NOT verify the JWT signature.
  // In a browser-only client we can safely *read* claims to drive UX (e.g., show admin-only UI
  // or compute expiry), but we must never treat this as a security boundary.
  // The backend verifies JWTs and enforces authorization on every request.
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    const json = base64UrlDecodeToString(parts[1]);
    const parsed = safeJsonParse(json);
    const rec = getRecord(parsed);
    if (!rec) return {};

    return {
      sub: getString(rec.sub),
      role: getString(rec.role),
      exp: getNumber(rec.exp),
      typ: getString(rec.typ),
    };
  } catch {
    return {};
  }
}
