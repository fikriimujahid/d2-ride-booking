-- Core domain schema for Passenger / Driver / Ride

create extension if not exists pgcrypto;

create type ride_status as enum (
  'requested',
  'accepted',
  'arrived',
  'in_progress',
  'completed',
  'cancelled'
);

create table if not exists passengers (
  id uuid primary key default gen_random_uuid(),
  auth_subject_id uuid not null unique,
  full_name text null,
  phone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passengers_phone_len check (phone is null or length(phone) >= 7)
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  auth_subject_id uuid not null unique,
  full_name text null,
  phone text null,
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drivers_phone_len check (phone is null or length(phone) >= 7)
);

create table if not exists rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references passengers(id) on delete restrict,
  driver_id uuid null references drivers(id) on delete restrict,

  status ride_status not null default 'requested',

  pickup jsonb not null,
  dropoff jsonb not null,

  assigned_at timestamptz null,
  arrived_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  cancelled_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rides_driver_assigned_consistency check (
    (driver_id is null and assigned_at is null)
    or (driver_id is not null and assigned_at is not null)
  ),

  constraint rides_requested_requires_no_driver check (
    not (status = 'requested' and driver_id is not null)
  ),

  constraint rides_non_requested_requires_driver check (
    (status in ('accepted','arrived','in_progress','completed') and driver_id is not null)
    or (status in ('requested','cancelled'))
  )
);

-- Invariant: a passenger can only have one active ride
create unique index if not exists ux_rides_passenger_active
  on rides(passenger_id)
  where status in ('requested','accepted','arrived','in_progress');

-- Invariant: a driver can only have one active ride
create unique index if not exists ux_rides_driver_active
  on rides(driver_id)
  where driver_id is not null and status in ('accepted','arrived','in_progress');

create index if not exists ix_rides_status_created_at on rides(status, created_at desc);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_passengers_updated_at on passengers;
create trigger trg_passengers_updated_at before update on passengers
for each row execute function set_updated_at();

drop trigger if exists trg_drivers_updated_at on drivers;
create trigger trg_drivers_updated_at before update on drivers
for each row execute function set_updated_at();

drop trigger if exists trg_rides_updated_at on rides;
create trigger trg_rides_updated_at before update on rides
for each row execute function set_updated_at();

-- Enforce ride state transitions in DB
create or replace function enforce_ride_status_transition() returns trigger language plpgsql as $$
declare
  ok boolean := false;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  -- Allowed transitions
  if old.status = 'requested' and new.status in ('accepted','cancelled') then ok := true; end if;
  if old.status = 'accepted' and new.status in ('arrived','cancelled') then ok := true; end if;
  if old.status = 'arrived' and new.status in ('in_progress','cancelled') then ok := true; end if;
  if old.status = 'in_progress' and new.status = 'completed' then ok := true; end if;

  if not ok then
    raise exception 'invalid ride status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  -- Timestamp coupling (best-effort invariants)
  if new.status = 'accepted' and new.assigned_at is null then
    new.assigned_at := now();
  end if;
  if new.status = 'arrived' and new.arrived_at is null then
    new.arrived_at := now();
  end if;
  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rides_status_transition on rides;
create trigger trg_rides_status_transition
before update of status on rides
for each row execute function enforce_ride_status_transition();
