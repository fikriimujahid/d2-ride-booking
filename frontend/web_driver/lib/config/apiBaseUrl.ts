const DEFAULT_API_BASE_URL = '/api/v1';

function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

/**
 * Base URL used by client-side fetch calls.
 *
 * For S3/CloudFront deployments, this MUST be set at build time if your API is on a different origin.
 */
export function getPublicApiBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    // Back-compat for earlier naming
    process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

  if (!raw) return DEFAULT_API_BASE_URL;
  return normalizeBaseUrl(raw);
}

/**
 * Base URL used by server-only code (Route Handlers / Server Actions).
 *
 * Note: if you keep `output: 'export'`, server-only code must not be required at runtime.
 */
export function getServerApiBaseUrl() {
  const raw =
    process.env.API_BASE_URL ??
    // Back-compat for earlier naming
    process.env.AUTH_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

  if (!raw) {
    throw new Error(
      'Missing API_BASE_URL (or NEXT_PUBLIC_API_BASE_URL). Example: http://localhost:3001/api/v1'
    );
  }

  return normalizeBaseUrl(raw);
}
