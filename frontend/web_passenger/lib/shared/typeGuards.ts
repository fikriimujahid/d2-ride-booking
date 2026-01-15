export function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
