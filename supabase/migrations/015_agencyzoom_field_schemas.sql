-- Per-org AgencyZoom field schema registry.
-- Stores Claude's mapping of raw AZ field names → Lumina normalized fields,
-- display config for the frontend, and downstream mappings for research + APEX agents.

CREATE TABLE IF NOT EXISTS agencyzoom_field_schemas (
  id_organization   TEXT PRIMARY KEY,
  raw_fields        JSONB NOT NULL DEFAULT '[]',
  field_map         JSONB NOT NULL DEFAULT '{}',
  display_config    JSONB NOT NULL DEFAULT '{}',
  downstream_map    JSONB NOT NULL DEFAULT '{}',
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
