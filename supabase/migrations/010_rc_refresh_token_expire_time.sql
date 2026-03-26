-- Add refresh_token_expire_time to ringcentral_connections.
-- The RC SDK needs this to know whether the refresh token is still valid
-- before attempting a refresh. Without it, it defaults to 0 and immediately
-- emits refreshError even when the refresh token is still within its 7-day window.

alter table public.ringcentral_connections
  add column if not exists refresh_token_expire_time bigint;
