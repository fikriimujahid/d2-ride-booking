export type SanitizedAuditPrimitive = string | number | boolean;

export type SanitizedAuditJson =
  | SanitizedAuditPrimitive
  | readonly SanitizedAuditPrimitive[]
  | { readonly [key: string]: SanitizedAuditPrimitive | readonly SanitizedAuditPrimitive[] };

export interface SanitizedAuditHttpLogRecord {
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly queryParams: Record<string, SanitizedAuditPrimitive | readonly SanitizedAuditPrimitive[]> | null;
  readonly requestHeaders: Record<string, string> | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly userId: string | null;
  readonly systemRole: string | null;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly errorCode: string | null;
}
