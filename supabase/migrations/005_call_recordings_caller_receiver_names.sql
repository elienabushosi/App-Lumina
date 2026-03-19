-- Add caller/receiver names from RingCentral call log
-- Run in Supabase Dashboard → SQL Editor, or via `supabase db push`

alter table public.call_recordings
  add column if not exists from_name text,
  add column if not exists to_name text;

