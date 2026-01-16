BEGIN;

-- Add a flow-level correlation id (one user action can span multiple requests).
-- Keep it text to allow UUIDs and other safe id formats.
ALTER TABLE IF EXISTS api_request_logs
  ADD COLUMN IF NOT EXISTS correlation_id text;

-- Helpful index for "show me all requests for this user action" queries.
CREATE INDEX IF NOT EXISTS api_request_logs_correlation_id_idx
  ON api_request_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;

COMMIT;
