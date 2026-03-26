-- RC extension to Lumina user mapping.
-- Org admins map each RC extension to a Lumina user so calls can be attributed.
create table if not exists public.rc_user_extensions (
  "IdRcUserExtension" uuid primary key default gen_random_uuid(),
  id_organization text not null,
  id_user         text not null,
  rc_extension_id text not null,
  rc_extension_number text,
  rc_display_name text,
  created_at      timestamptz not null default now(),
  unique (id_organization, rc_extension_id)
);
create index if not exists rc_user_extensions_org_idx on public.rc_user_extensions (id_organization);
create index if not exists rc_user_extensions_user_idx on public.rc_user_extensions (id_organization, id_user);
alter table public.rc_user_extensions enable row level security;
create policy "Service role only" on public.rc_user_extensions for all using (false) with check (false);

-- Tag each call with the Lumina user who handled it (the agent's extension).
alter table public.call_recordings
  add column if not exists handled_by_user_id text;
