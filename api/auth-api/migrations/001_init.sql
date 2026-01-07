-- 001_init.sql

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type user_type as enum ('ADMIN', 'DRIVER', 'PASSENGER');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  user_type user_type not null,
  email citext unique,
  phone text unique,
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_admin_requires_email check (
    (user_type = 'ADMIN' and email is not null) or (user_type <> 'ADMIN')
  ),
  constraint users_non_admin_requires_identifier check (
    (user_type = 'ADMIN') or (email is not null) or (phone is not null)
  )
);

create index if not exists idx_users_type on users(user_type);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

-- Admin TOTP 2FA (encrypted secret)
create table if not exists admin_totp (
  user_id uuid primary key references users(id) on delete cascade,
  secret_enc bytea not null,
  enabled boolean not null default false,
  enrolled_at timestamptz,
  last_used_at timestamptz
);

-- Admin RBAC
create table if not exists admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists admin_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists admin_role_permissions (
  role_id uuid not null references admin_roles(id) on delete cascade,
  permission_id uuid not null references admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Role hierarchy: parent -> child (parent inherits child's permissions)
create table if not exists admin_role_inheritance (
  parent_role_id uuid not null references admin_roles(id) on delete cascade,
  child_role_id uuid not null references admin_roles(id) on delete cascade,
  primary key (parent_role_id, child_role_id),
  constraint no_self_inheritance check (parent_role_id <> child_role_id)
);

create table if not exists admin_user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references admin_roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- Refresh tokens (opaque, hashed storage, rotation)
create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_ip inet,
  created_ua text,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  replaced_by uuid references refresh_tokens(id) on delete set null
);

create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_family on refresh_tokens(family_id);
create index if not exists idx_refresh_tokens_expires on refresh_tokens(expires_at);

-- Migration bookkeeping
create table if not exists schema_migrations (
  id bigserial primary key,
  filename text not null unique,
  applied_at timestamptz not null default now()
);
