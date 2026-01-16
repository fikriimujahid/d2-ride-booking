BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS api_request_logs (
  occurred_at timestamptz NOT NULL,
  id bigserial,

  request_id text NOT NULL,

  http_method text NOT NULL,
  http_path text NOT NULL,

  query_params jsonb,
  request_headers jsonb,

  ip inet,
  user_agent text,

  authenticated_user_id uuid,
  authenticated_system_role user_role,

  status_code integer NOT NULL,
  duration_ms integer NOT NULL,
  error_code text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_request_logs_pk PRIMARY KEY (occurred_at, id),

  CONSTRAINT fk_api_request_logs_authenticated_user_id_users
    FOREIGN KEY (authenticated_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT api_request_logs_status_chk
    CHECK (status_code >= 100 AND status_code <= 599),

  CONSTRAINT api_request_logs_duration_chk
    CHECK (duration_ms >= 0)
)
PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS api_request_logs_default
  PARTITION OF api_request_logs DEFAULT;

CREATE INDEX IF NOT EXISTS api_request_logs_request_id_idx
  ON api_request_logs (request_id);

CREATE INDEX IF NOT EXISTS api_request_logs_user_time_idx
  ON api_request_logs (authenticated_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_path_time_idx
  ON api_request_logs (http_path, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_status_time_idx
  ON api_request_logs (status_code, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_error_time_idx
  ON api_request_logs (error_code, occurred_at DESC)
  WHERE error_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS api_request_logs_occurred_at_brin
  ON api_request_logs USING brin (occurred_at);

COMMIT;
