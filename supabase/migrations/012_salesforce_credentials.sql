-- Per-user Farmers/Salesforce credentials for the APEX browser agent.
create table if not exists public.salesforce_credentials (
  id_user         text primary key,
  id_organization text not null,
  sf_username     text not null,
  sf_password     text not null,
  updated_at      timestamptz not null default now()
);
create index if not exists sf_credentials_org_idx on public.salesforce_credentials (id_organization);
alter table public.salesforce_credentials enable row level security;
create policy "Service role only" on public.salesforce_credentials for all using (false) with check (false);
