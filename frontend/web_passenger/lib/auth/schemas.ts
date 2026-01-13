import { z } from "zod"

export const UpstreamErrorPayloadSchema = z
  .object({
    message: z.string().optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

export type UpstreamErrorPayload = z.infer<typeof UpstreamErrorPayloadSchema>

export const TokenResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string().optional(),
  })
  .passthrough()

export type TokenResponse = z.infer<typeof TokenResponseSchema>

export const UpstreamAuthPayloadSchema = z.union([
  TokenResponseSchema,
  UpstreamErrorPayloadSchema,
])

export type UpstreamAuthPayload = z.infer<typeof UpstreamAuthPayloadSchema>

export function getErrorMessage(payload: unknown): string | null {
  const parsed = UpstreamErrorPayloadSchema.safeParse(payload)
  if (!parsed.success) return null

  const { message, error } = parsed.data
  if (message) return message
  if (error?.message) return error.message
  return null
}
