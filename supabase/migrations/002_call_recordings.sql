-- Call recordings we process: RingCentral call id, recording URL, pipeline status, transcript.
-- Run in Supabase Dashboard → SQL Editor.

create table if not exists public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  id_organization text not null,
  ringcentral_call_id text not null,
  recording_content_uri text not null,
  from_number text,
  to_number text,
  start_time timestamptz,
  duration_sec int,
  status text not null default 'pending_transcription',
  transcript text,
  transcript_words jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_recordings_ringcentral_call_id_key unique (ringcentral_call_id)
);

alter table public.call_recordings enable row level security;

create policy "Service role only"
  on public.call_recordings
  for all
  using (false)
  with check (false);

comment on table public.call_recordings is 'Recordings from RingCentral call log; status: pending_transcription | transcribing | transcribed | failed.';
