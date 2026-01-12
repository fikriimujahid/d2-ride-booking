-- Driver matching V1: step 2/2 (safe to reference 'offered' after 002 commits)

-- Driver location + heartbeat (minimal)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS current_lat double precision NULL,
  ADD COLUMN IF NOT EXISTS current_lng double precision NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_drivers_available_last_seen
  ON drivers(is_available, last_seen_at DESC);

-- Ride offer fields
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS offered_driver_id uuid NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz NULL;

-- Constraints updates

-- rides_non_requested_requires_driver currently does not account for 'offered'
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_non_requested_requires_driver;
ALTER TABLE rides
  ADD CONSTRAINT rides_non_requested_requires_driver CHECK (
    (status in ('accepted','arrived','in_progress','completed') and driver_id is not null)
    or (status in ('requested','offered','cancelled'))
  );

-- Offered consistency: offer points to a driver, but not yet accepted
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_offered_consistency;
ALTER TABLE rides
  ADD CONSTRAINT rides_offered_consistency CHECK (
    (status <> 'offered' and offered_driver_id is null and offer_expires_at is null)
    or (status = 'offered' and offered_driver_id is not null and driver_id is null and offer_expires_at is not null)
  );

-- Active ride uniqueness updates
DROP INDEX IF EXISTS ux_rides_passenger_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rides_passenger_active
  ON rides(passenger_id)
  WHERE status in ('requested','offered','accepted','arrived','in_progress');

-- Keep accepted/arrived/in_progress as the "active driver ride" (offered handled separately)
DROP INDEX IF EXISTS ux_rides_driver_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rides_driver_active
  ON rides(driver_id)
  WHERE driver_id is not null and status in ('accepted','arrived','in_progress');

-- A driver can only be offered one ride at a time
CREATE UNIQUE INDEX IF NOT EXISTS ux_rides_offered_driver_active
  ON rides(offered_driver_id)
  WHERE offered_driver_id is not null and status = 'offered';

-- Update ride transition trigger to allow requested->offered and offered->accepted/cancelled
CREATE OR REPLACE FUNCTION enforce_ride_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN new;
  END IF;

  IF old.status = new.status THEN
    RETURN new;
  END IF;

  -- Allowed transitions
  IF old.status = 'requested' AND new.status IN ('offered','accepted','cancelled') THEN ok := true; END IF;
  IF old.status = 'offered' AND new.status IN ('accepted','cancelled') THEN ok := true; END IF;
  IF old.status = 'accepted' AND new.status IN ('arrived','cancelled') THEN ok := true; END IF;
  IF old.status = 'arrived' AND new.status IN ('in_progress','cancelled') THEN ok := true; END IF;
  IF old.status = 'in_progress' AND new.status = 'completed' THEN ok := true; END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'invalid ride status transition: % -> %', old.status, new.status
      USING errcode = '23514';
  END IF;

  -- Timestamp coupling (best-effort invariants)
  IF new.status = 'accepted' AND new.assigned_at IS NULL THEN
    new.assigned_at := now();
  END IF;
  IF new.status = 'arrived' AND new.arrived_at IS NULL THEN
    new.arrived_at := now();
  END IF;
  IF new.status = 'in_progress' AND new.started_at IS NULL THEN
    new.started_at := now();
  END IF;
  IF new.status = 'completed' AND new.completed_at IS NULL THEN
    new.completed_at := now();
  END IF;
  IF new.status = 'cancelled' AND new.cancelled_at IS NULL THEN
    new.cancelled_at := now();
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_rides_status_transition ON rides;
CREATE TRIGGER trg_rides_status_transition
BEFORE UPDATE OF status ON rides
FOR EACH ROW EXECUTE FUNCTION enforce_ride_status_transition();
