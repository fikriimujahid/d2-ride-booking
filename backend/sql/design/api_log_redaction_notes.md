# API Logging (DB) – Redaction & Retention Notes

This is DESIGN-ONLY guidance for database-backed API request/response logging.

## Redaction rules (mandatory)

Do **not** persist any of:
- `Authorization` headers (Bearer tokens)
- `Cookie` / `Set-Cookie`
- Any request/response bodies containing credentials, OTPs, PII
- Raw refresh tokens or token hashes (outside the dedicated refresh token table)

Recommended approach:
- **Header allowlist** (safer than denylist): persist only a small set, e.g.
  - `accept`, `content-type`, `x-request-id`, `x-forwarded-for`, `x-real-ip`, `user-agent`
- **Query param sanitization**:
  - drop keys matching case-insensitive: `token|authorization|password|secret|otp|code|session|refresh|access`
  - drop keys known to contain PII: `email|phone` (or hash them if needed)

Suggested stored JSON shapes:
- `request_headers`: `{ "content-type": "application/json", "x-request-id": "..." }`
- `query_params`: `{ "page": 1, "limit": 20 }`

## Retention policy

For high-volume logs, do not rely on row-level TTL deletes.

Preferred strategy:
- Partition `api_request_logs` by `occurred_at` (daily or monthly)
- Retain N days (e.g. 30/60/90) in the primary DB
- Drop old partitions (fast, minimal bloat)

Optional archival:
- Export partitions older than N days to object storage (S3) as parquet/csv
- Drop partition after successful export

## Indexing strategy (write-heavy)

Per partition:
- `request_id` btree (incident correlation)
- `(authenticated_user_id, occurred_at DESC)` btree (per-user investigations)
- `(http_path, occurred_at DESC)` btree (endpoint hot spots)
- `(status_code, occurred_at DESC)` btree (error rate)
- `(error_code, occurred_at DESC) WHERE error_code IS NOT NULL` btree (app errors)

If partitions are large (multi-GB), consider also:
- `BRIN(occurred_at)` (cheap time-range scans)

## Security events vs API logs

- `security_events` is for *authz/authn and admin actions* (human/security relevant)
- `api_request_logs` is for *all requests* (operational visibility)

Avoid duplicating the same data in both tables.
