"use client"

import type { z } from "zod"
import { apiRequest } from "./client"
import { AuthRequiredError } from "./errors"
import { redirectToLoginClient } from "../auth/guards"

export async function passengerApiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  try {
    return await apiRequest({ path, schema, init })
  } catch (err) {
    // Preserve prior behavior: redirect to login on 401 in client code.
    if (err instanceof AuthRequiredError) {
      redirectToLoginClient()
    }
    throw err
  }
}
