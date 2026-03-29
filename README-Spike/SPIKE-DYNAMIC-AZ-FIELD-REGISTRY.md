# Spike: Dynamic AgencyZoom Field Registry

**Status:** Proposal — awaiting approval before any build
**Date:** 2026-03-29
**Motivation:** Jake and CG return different AZ field shapes. A third agency could return completely different field names we've never seen. Hardcoding field assumptions breaks with every new customer. This spike proposes an AI-powered field registry that learns each agency's schema once and uses it everywhere — leads table, lead detail, research agent, APEX browser agent.

---

## The Problem at Scale

Today Lumina hardcodes assumptions about AZ field names:
- `lead.firstname`, `lead.status`, `lead.enterStageDate` etc. are expected by name
- If an agency returns `first_name`, `statusCode`, or `stageEnteredDate` — the UI silently breaks or crashes
- Every new agency is a potential bug

As Lumina scales to 10, 50, 100 agencies — each with their own AZ configuration — this becomes unmanageable. We can't chase field name variants for every customer.

---

## The Solution — Per-Org AI Field Registry

When Lumina first sees a new set of field names from an agency's AZ account, it sends them to Claude. Claude maps them to Lumina's standard schema. That mapping is stored in the database, keyed by org. From that point on, Jake's data is always rendered using Jake's schema. CG's data is rendered using CG's schema. They can be completely different and everything still works.

---

## Architecture

### 1. Standard Schema (Lumina's internal contract)

Lumina defines a fixed set of normalized field names that the rest of the app — frontend, research agent, APEX agent — always works with:

```ts
interface NormalizedLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  leadSource: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lastStageDate: string | null;         // maps to enterStageDate, lastEnterStageDate, etc.
  assignedTo: string | null;
  locationCode: string | null;
  workflowId: string | null;
  [key: string]: unknown;               // unknown fields passed through untouched
}
```

Everything downstream (frontend, research, APEX) only ever sees `NormalizedLead`. It never touches raw AZ field names.

---

### 2. Per-Org Schema Table (Supabase)

```sql
CREATE TABLE agencyzoom_field_schemas (
  id_organization   TEXT PRIMARY KEY,
  raw_fields        JSONB NOT NULL,   -- array of raw field names seen from AZ
  field_map         JSONB NOT NULL,   -- { "enterStageDate": "lastStageDate", "first_name": "firstName", ... }
  display_config    JSONB NOT NULL,   -- { "firstName": { label: "First Name", type: "string", visible: true, order: 1 }, ... }
  downstream_map    JSONB NOT NULL,   -- { "locationCode": { research: "address.locationCode", apex: "agencyNumber" }, ... }
  discovered_at     TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

**`field_map`** — raw AZ field name → Lumina normalized field name. Jake and CG will have different entries here.

**`display_config`** — per normalized field: display label, data type (string/date/number/boolean), whether to show it in the table, column order. This is what the frontend reads to render columns dynamically.

**`downstream_map`** — per normalized field: how it maps into the research agent input and the APEX browser agent input. Claude fills this in at discovery time.

---

### 3. Schema Discovery Flow

This runs automatically whenever the backend receives a leads/list response from AZ.

```
AZ returns leads for org "jake-ridley-org"
          │
          ▼
Extract all field names from first lead
          │
          ▼
Compare against stored raw_fields for this org
          │
     New fields?
    /           \
  No             Yes
  │               │
  Use             Send to Claude:
  existing        "Here are new field names with sample values.
  schema          Map each to our standard schema.
                  Flag any that are downstream-relevant
                  (research agent, APEX form fields)."
                  │
                  ▼
                Claude returns field_map + display_config + downstream_map
                  │
                  ▼
                Upsert into agencyzoom_field_schemas for this org
                  │
                  ▼
                Continue — normalize leads using updated schema
```

**Claude prompt (rough shape):**
```
You are mapping AgencyZoom API field names to Lumina's standard lead schema.

Standard schema fields: id, firstName, lastName, email, phone, status,
leadSource, streetAddress, city, state, zip, lastStageDate, assignedTo,
locationCode, workflowId.

New fields seen for this org with sample values:
- enterStageDate: "2026-03-15T10:00:00Z"
- first_name: "John"
- statusCode: 2
- agencyLocationCode: "TX-001"
...

For each field return:
1. normalized_name: which standard field it maps to (or null if unknown)
2. display_label: human-readable label for the UI
3. data_type: string | number | date | boolean
4. visible_in_table: true/false
5. maps_to_research: which research agent input field this feeds (or null)
6. maps_to_apex: which APEX form field this feeds (or null)
```

This runs once per org, on first connection or when new fields are detected. Not on every leads fetch.

---

### 4. Normalization at the Backend

After schema discovery, every leads/list response is normalized before being returned to the frontend:

```js
// backend/lib/agencyzoom-normalizer.js

export function normalizeLeads(rawLeads, fieldMap) {
  return rawLeads.map(raw => {
    const normalized = {};
    // Apply known mappings
    for (const [rawField, normalizedField] of Object.entries(fieldMap)) {
      if (raw[rawField] !== undefined) {
        normalized[normalizedField] = coerce(raw[rawField], normalizedField);
      }
    }
    // Pass through unknown fields untouched
    for (const [key, value] of Object.entries(raw)) {
      if (!fieldMap[key]) {
        normalized[`_raw_${key}`] = value;
      }
    }
    return normalized;
  });
}

function coerce(value, fieldName) {
  // Enforce expected types for known fields
  if (['firstName', 'lastName', 'email', 'status', 'leadSource'].includes(fieldName)) {
    return value != null ? String(value) : null;
  }
  if (['lastStageDate'].includes(fieldName)) {
    return value != null ? String(value) : null; // keep as ISO string
  }
  return value;
}
```

The frontend always receives normalized leads. `status` is always a string. `firstName` is always a string or null. No `.toLowerCase()` crashes. No missing fields.

---

### 5. Frontend Renders Dynamically

Instead of hardcoded columns, the leads table fetches the org's `display_config` and renders whatever columns exist:

```ts
// Fetch display config for this org
const { data: schemaConfig } = await fetch('/api/agencyzoom/schema');

// Columns are driven by display_config, ordered by `order`, filtered by `visible: true`
const columns = schemaConfig
  .filter(f => f.visible_in_table)
  .sort((a, b) => a.order - b.order);
```

Jake's table might show: Name, Source, Address, Phone, Email, Status, Last Stage Date.
CG's table might show: Name, Lead Type, Location, Status, Assigned To, Workflow Stage.

Same code, different schemas, completely different columns — and it all works.

---

### 6. Downstream — Research Agent and APEX

When a lead is passed to the research agent or APEX browser agent, the `downstream_map` from the schema is used to build the input:

```js
// Build research agent input from normalized lead + downstream_map
function buildResearchInput(normalizedLead, downstreamMap) {
  const input = {};
  for (const [normalizedField, mapping] of Object.entries(downstreamMap)) {
    if (mapping.research && normalizedLead[normalizedField] != null) {
      set(input, mapping.research, normalizedLead[normalizedField]);
    }
  }
  return input;
}

// Build APEX input
function buildApexInput(normalizedLead, downstreamMap) {
  const input = {};
  for (const [normalizedField, mapping] of Object.entries(downstreamMap)) {
    if (mapping.apex && normalizedLead[normalizedField] != null) {
      set(input, mapping.apex, normalizedLead[normalizedField]);
    }
  }
  return input;
}
```

Claude already figured out the mappings at discovery time. The agents just use them.

---

## How Jake and CG Stay Independent

| | Jake | CG |
|---|---|---|
| AZ field for first name | `firstname` | `firstName` |
| AZ field for stage date | `enterStageDate` | `lastEnterStageDate` |
| AZ field for location | `locationCode` | `agencyLocationId` |
| Normalized field (Lumina) | `firstName`, `lastStageDate`, `locationCode` | same |
| Display label for stage date | "Last Stage Date" | "Last Stage Date" |
| APEX mapping for location | `agencyNumber` | `agencyNumber` |

Both orgs use the same normalized schema internally. The field_map per org is what translates between raw AZ and that shared standard. Downstream agents never know the difference.

---

## What Claude Does (and Doesn't Do)

**Claude does:**
- Map raw field names to normalized names based on semantic meaning
- Infer data types from sample values
- Identify which fields are relevant to research and APEX
- Generate human-readable display labels

**Claude does not:**
- Run on every request — only on schema discovery (once per org, or when new fields appear)
- Guess field values — only maps field names
- Handle fields with no semantic meaning — those get passed through as `_raw_*`

---

## Build Order

1. `agencyzoom_field_schemas` table — migration
2. Schema discovery service — `backend/lib/agencyzoom-schema-discovery.js`
3. Claude prompt + response parser
4. Normalizer — `backend/lib/agencyzoom-normalizer.js`
5. Wire into `leads/list` route — discover on first call, normalize before returning
6. `GET /api/agencyzoom/schema` route — returns `display_config` for the org
7. Frontend leads table — dynamic columns from schema
8. Frontend lead detail page — dynamic fields from schema
9. Wire `downstream_map` into research agent input builder
10. Wire `downstream_map` into APEX input builder

---

## What This Fixes Beyond B16

- B16 — `statusColor` crash: gone, `status` is always a string after normalization
- B18 — field mapping on lead create: the downstream_map handles this per org
- Any future agency with unexpected field names: handled automatically at discovery
- Research agent and APEX always get correctly mapped data regardless of source agency

---

## Open Questions

1. **When do we re-run discovery?** On every leads/list call we check if raw fields have changed. If a new field appears, we trigger Claude. This should be lightweight — just a Set comparison of field names.
2. **What if Claude maps something wrong?** Add an admin UI (Owner only) to view and override the field map for an org. Claude's suggestion is the default, human can correct it.
3. **Cost?** Claude is called once per org, or when new fields appear. Not per request. Cost is negligible.
4. **Scope for MVP?** Steps 1–6 (discovery + normalization + dynamic table) are the core. Steps 7–10 (downstream wiring) can follow after the leads page is confirmed working.
