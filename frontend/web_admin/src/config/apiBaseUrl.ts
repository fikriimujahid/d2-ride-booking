export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) return String(base).replace(/\/$/, '');

  // Default to same-origin API prefix.
  // In dev, Vite proxies /api/* to the backend to avoid CORS.
  return '/api/v1';
}
