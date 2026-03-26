-- Per-org AgencyZoom pipeline + custom field configuration.
create table if not exists public.agencyzoom_config (
  id_organization      text primary key,
  lead_source_id       text,
  pipeline_id          text,
  stage_id             text,
  primary_producer_id  text,
  primary_csr_id       text,
  location_code        text,
  country              text default 'US',
  -- custom field ID mappings (fieldName values from /v1/api/custom-fields)
  cf_roof_year         text,
  cf_roof_type         text,
  cf_flooring_types    text,
  cf_bathrooms         text,
  cf_occupation_degree text,
  updated_at           timestamptz not null default now()
);
alter table public.agencyzoom_config enable row level security;
create policy "Service role only" on public.agencyzoom_config for all using (false) with check (false);
