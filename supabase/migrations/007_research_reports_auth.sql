-- Add created_by (user attribution) and upsert constraint to research_reports.
-- created_by stores the IdUser of the Lumina user who ran the research.
-- The unique constraint on (id_organization, agency_zoom_lead_id) allows
-- upsert so there is always exactly one report per lead per org (latest wins).
-- Run in Supabase Dashboard → SQL Editor.

alter table public.research_reports
  add column if not exists created_by text;

-- Unique constraint for upsert: one report per lead per org.
-- agency_zoom_lead_id is nullable so only enforce when it is set.
create unique index if not exists research_reports_org_az_lead_unique
  on public.research_reports (id_organization, agency_zoom_lead_id)
  where agency_zoom_lead_id is not null;
