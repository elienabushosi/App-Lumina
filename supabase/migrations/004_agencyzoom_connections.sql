-- AgencyZoom API credentials and cached JWT per organization.
-- Run in Supabase Dashboard → SQL Editor, or via: supabase db push

create table if not exists public.agencyzoom_connections (
  id uuid primary key default gen_random_uuid(),
  id_organization text not null unique,
  api_key text not null,
  api_secret text not null,
  jwt_token text,
  jwt_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: RLS so only service role (backend) can read/write; no anon access.
alter table public.agencyzoom_connections enable row level security;

create policy "Service role only"
  on public.agencyzoom_connections
  for all
  using (false)
  with check (false);

comment on table public.agencyzoom_connections is 'AgencyZoom API key/secret and cached JWT token per organization.';

