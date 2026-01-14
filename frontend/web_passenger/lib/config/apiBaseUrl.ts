const DEFAULT_API_BASE_URL = "/api/v1"

function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return DEFAULT_API_BASE_URL
  return trimmed.replace(/\/+$/, "")
}

/**
 * Base URL used by client-side fetch calls.
 *
 * If your API is on a different origin (S3/CloudFront), this MUST be set at build time.
 */
export function getPublicApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL

  if (!raw) return DEFAULT_API_BASE_URL
  return normalizeBaseUrl(raw)
}

/**
 * Base URL used by server-only code (Route Handlers / Server Actions).
 */
export function getServerApiBaseUrl() {
  const raw = process.env.AUTH_API_BASE_URL ?? process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL

  if (!raw) {
    throw new Error(
      "Missing AUTH_API_BASE_URL (or API_BASE_URL, NEXT_PUBLIC_API_BASE_URL). Example: http://127.0.0.1:3000/api/v1"
    )
  }

  return normalizeBaseUrl(raw)
}
