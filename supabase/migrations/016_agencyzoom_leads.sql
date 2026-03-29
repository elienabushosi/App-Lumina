-- Per-org AgencyZoom leads storage.
-- Composite primary key (id_organization, az_lead_id) guarantees:
--   1. No duplicates — upsert on pull always updates, never inserts twice
--   2. No cross-org leakage — same AZ lead ID in two orgs = two separate rows

CREATE TABLE IF NOT EXISTS agencyzoom_leads (
  az_lead_id      TEXT NOT NULL,
  id_organization TEXT NOT NULL,
  data            JSONB NOT NULL,
  raw_data        JSONB NOT NULL DEFAULT '{}',
  pulled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_organization, az_lead_id)
);

CREATE INDEX IF NOT EXISTS agencyzoom_leads_org_updated
  ON agencyzoom_leads (id_organization, updated_at DESC);
