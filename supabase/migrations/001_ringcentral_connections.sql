-- RingCentral OAuth tokens per organization (replaces file-based token store).
-- Run in Supabase Dashboard → SQL Editor, or via: supabase db push

create table if not exists public.ringcentral_connections (
  id uuid primary key default gen_random_uuid(),
  id_organization text not null unique,
  access_token text not null,
  refresh_token text not null,
  expire_time bigint,
  subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: RLS so only service role (backend) can read/write; no anon access.
alter table public.ringcentral_connections enable row level security;

create policy "Service role only"
  on public.ringcentral_connections
  for all
  using (false)
  with check (false);

comment on table public.ringcentral_connections is 'RingCentral OAuth tokens and webhook subscription id, keyed by organization.';
