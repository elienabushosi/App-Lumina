-- Per-user AgencyZoom credentials.
-- Each Lumina user connects their own AZ account.
-- The org-level agencyzoom_connections table is left in place (unused by new code paths).
create table if not exists public.agencyzoom_user_credentials (
  id_user         text primary key,
  id_organization text not null,
  az_email        text not null,
  az_password     text not null,
  jwt_token       text,
  jwt_expires_at  timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists az_user_creds_org_idx
  on public.agencyzoom_user_credentials (id_organization);
alter table public.agencyzoom_user_credentials enable row level security;
create policy "Service role only"
  on public.agencyzoom_user_credentials for all using (false) with check (false);
