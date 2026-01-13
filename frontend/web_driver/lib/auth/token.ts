import { z } from 'zod';

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
