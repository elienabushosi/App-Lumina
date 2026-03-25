-- Password reset codes table.
-- Used by POST /api/auth/password/forgot and POST /api/auth/password/reset-with-code.

create table if not exists public.password_reset_codes (
  "IdPasswordResetCode" uuid primary key default gen_random_uuid(),
  "IdUser"              uuid not null references public.users("IdUser") on delete cascade,
  "Code"                text not null,
  "ExpiresAt"           timestamptz not null,
  "UsedAt"              timestamptz,
  "CreatedAt"           timestamptz not null default now()
);

create index if not exists password_reset_codes_user_idx
  on public.password_reset_codes ("IdUser");

alter table public.password_reset_codes enable row level security;

create policy "Service role only"
  on public.password_reset_codes for all
  using (false) with check (false);
