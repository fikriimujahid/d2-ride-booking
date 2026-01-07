import { z } from 'zod';

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown) {
  return schema.parse(body) as z.infer<T>;
}
