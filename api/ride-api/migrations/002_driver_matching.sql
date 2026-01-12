-- Driver matching V1: step 1/2
-- Postgres requires new enum values to be committed before they can be referenced.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ride_status' AND e.enumlabel = 'offered'
  ) THEN
    ALTER TYPE ride_status ADD VALUE 'offered';
  END IF;
END $$;
