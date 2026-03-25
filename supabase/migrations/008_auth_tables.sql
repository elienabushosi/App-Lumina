-- Core auth tables: organizations, users, joincodes.
-- Column names are PascalCase to match existing auth.js / auth-utils.js code.
-- Run in Supabase Dashboard → SQL Editor.

-- ── Organizations ────────────────────────────────────────────────────────────

create table if not exists public.organizations (
  "IdOrganization" uuid primary key default gen_random_uuid(),
  "Name"               text not null,
  "Type"               text,
  "SubscriptionStatus" text not null default 'none',
  "CreatedAt"          timestamptz not null default now(),
  "UpdatedAt"          timestamptz not null default now()
);

alter table public.organizations enable row level security;

create policy "Service role only"
  on public.organizations for all
  using (false) with check (false);

-- ── Users ────────────────────────────────────────────────────────────────────

create table if not exists public.users (
  "IdUser"         uuid primary key default gen_random_uuid(),
  "IdOrganization" uuid references public.organizations("IdOrganization") on delete cascade,
  "Name"           text not null,
  "Email"          text not null,
  "Password"       text not null,  -- plain text for now; hash before production
  "Role"           text not null default 'Member',  -- Owner | Member
  "Enabled"        boolean not null default true,
  "CreatedAt"      timestamptz not null default now(),
  "UpdatedAt"      timestamptz not null default now()
);

create unique index if not exists users_email_unique on public.users (lower("Email"));

alter table public.users enable row level security;

create policy "Service role only"
  on public.users for all
  using (false) with check (false);

-- ── Join Codes ───────────────────────────────────────────────────────────────

create table if not exists public.joincodes (
  "IdJoinCode"     uuid primary key default gen_random_uuid(),
  "Code"           text not null,
  "IdOrganization" uuid not null references public.organizations("IdOrganization") on delete cascade,
  "ExpiresAt"      timestamptz not null,
  "UsedAt"         timestamptz,
  "UsedBy"         uuid references public.users("IdUser") on delete set null,
  "CreatedAt"      timestamptz not null default now()
);

create unique index if not exists joincodes_code_unique on public.joincodes (upper("Code"));

alter table public.joincodes enable row level security;

create policy "Service role only"
  on public.joincodes for all
  using (false) with check (false);
