import 'client-only';

type JwtPayload = Record<string, unknown>;

function base64UrlToBase64(input: string): string {
  return input.replace(/-/g, '+').replace(/_/g, '/');
}

function decodeBase64Utf8(base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  const payloadB64 = parts[1];
  const padded = base64UrlToBase64(payloadB64).padEnd(Math.ceil(payloadB64.length / 4) * 4, '=');
  const json = decodeBase64Utf8(padded);
  if (!json) return null;

  const parsed = safeJsonParse(json);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as JwtPayload;
}

export type JwtUserType = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export function getJwtUserType(token: string): JwtUserType | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const userType = payload.userType;
  if (userType === 'ADMIN' || userType === 'DRIVER' || userType === 'PASSENGER') return userType;

  // Back-compat: some JWTs might use role instead of userType.
  const role = payload.role;
  if (role === 'ADMIN' || role === 'DRIVER' || role === 'PASSENGER') return role;

  return null;
}
