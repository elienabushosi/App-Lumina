-- Add token_valid flag to ringcentral_connections.
-- false = tokens are known to be revoked/expired (set by health checker).
-- true  = tokens appear healthy (default, reset on OAuth reconnect).

ALTER TABLE ringcentral_connections
  ADD COLUMN IF NOT EXISTS token_valid BOOLEAN NOT NULL DEFAULT true;
