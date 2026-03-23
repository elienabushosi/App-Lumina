-- Research reports: stores property research data collected before APEX submission.
-- Each report links to either a call recording or an Agency Zoom lead (both nullable).
-- Run in Supabase Dashboard → SQL Editor.

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  id_organization text not null,

  -- Source linkage (both nullable — either source is valid)
  call_recording_id uuid references public.call_recordings(id) on delete set null,
  agency_zoom_lead_id text,  -- AZ lead ID (string from Agency Zoom API)

  -- Property address
  address text,
  city text,
  state text,
  zip text,

  -- Lead contact info (denormalized for convenience)
  lead_first_name text,
  lead_last_name text,
  lead_phone text,
  lead_email text,

  -- Research data (progressive — each step saved when user confirms)
  cad_data jsonb,
  maps_data jsonb,
  realtor_data jsonb,

  -- Pipeline status
  status text not null default 'in_progress',
  -- in_progress | research_complete | apex_submitted | failed

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_reports enable row level security;

create policy "Service role only"
  on public.research_reports
  for all
  using (false)
  with check (false);

comment on table public.research_reports is 'Property research reports collected before APEX submission. Status: in_progress | research_complete | apex_submitted | failed.';
