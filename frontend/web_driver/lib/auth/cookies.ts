export const authCookies = {
  accessToken: 'd2_driver_at',
  refreshToken: 'd2_driver_rt',
} as const;

export const authCookieOptions = {
  // NOTE: httpOnly + sameSite=Lax is a good default for an SSR app.
  // In production behind HTTPS, Secure will be applied.
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // keep in sync with Auth API default (900s)
