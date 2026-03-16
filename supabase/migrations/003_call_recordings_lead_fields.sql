-- Add lead extraction fields to call_recordings.
-- Run in Supabase Dashboard → SQL Editor after 002_call_recordings.sql.

alter table public.call_recordings
  add column if not exists lead_payload jsonb,
  add column if not exists lead_status text,
  add column if not exists lead_error text;

comment on column public.call_recordings.lead_status is
  'Lead extraction status: null | extracted | not_a_lead | error';

