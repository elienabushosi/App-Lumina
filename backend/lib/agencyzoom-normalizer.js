/**
 * AgencyZoom Lead Normalizer
 *
 * Converts raw AZ lead objects to Lumina's standard NormalizedLead shape
 * using a stored field_map for the org.
 *
 * The frontend and all downstream agents (research, APEX) only ever
 * receive NormalizedLead — they never see raw AZ field names.
 *
 * NormalizedLead shape:
 * {
 *   id: string,
 *   firstName: string | null,
 *   lastName: string | null,
 *   email: string | null,
 *   phone: string | null,
 *   status: string | null,
 *   leadSource: string | null,
 *   streetAddress: string | null,
 *   city: string | null,
 *   state: string | null,
 *   zip: string | null,
 *   lastStageDate: string | null,
 *   assignedTo: string | null,
 *   locationCode: string | null,
 *   workflowId: string | null,
 *   _raw: object  -- original AZ fields, passed through untouched for debugging
 * }
 */

// Type coercions per normalized field name.
// Ensures the frontend never receives unexpected types.
const COERCIONS = {
  id:            (v) => (v != null ? String(v) : ""),
  firstName:     (v) => (v != null ? String(v) : null),
  lastName:      (v) => (v != null ? String(v) : null),
  email:         (v) => (v != null ? String(v) : null),
  phone:         (v) => (v != null ? String(v) : null),
  status:        (v) => (v != null ? String(v) : null),  // key fix — handles integer status
  leadSource:    (v) => (v != null ? String(v) : null),
  streetAddress: (v) => (v != null ? String(v) : null),
  city:          (v) => (v != null ? String(v) : null),
  state:         (v) => (v != null ? String(v) : null),
  zip:           (v) => (v != null ? String(v) : null),
  lastStageDate: (v) => (v != null ? String(v) : null),
  assignedTo:    (v) => (v != null ? String(v) : null),
  locationCode:  (v) => (v != null ? String(v) : null),
  workflowId:    (v) => (v != null ? String(v) : null),
};

/**
 * Normalize a single raw AZ lead using the org's field_map.
 * @param {object} rawLead - raw lead object from AZ API
 * @param {object} fieldMap - { rawFieldName: normalizedFieldName } from agencyzoom_field_schemas
 * @returns {object} NormalizedLead
 */
export function normalizeLead(rawLead, fieldMap) {
  const normalized = {
    id: "",
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    status: null,
    leadSource: null,
    streetAddress: null,
    city: null,
    state: null,
    zip: null,
    lastStageDate: null,
    assignedTo: null,
    locationCode: null,
    workflowId: null,
    _raw: rawLead,
  };

  for (const [rawField, normalizedField] of Object.entries(fieldMap)) {
    if (normalizedField && rawLead[rawField] !== undefined) {
      const coerce = COERCIONS[normalizedField];
      normalized[normalizedField] = coerce
        ? coerce(rawLead[rawField])
        : rawLead[rawField];
    }
  }

  return normalized;
}

/**
 * Normalize an array of raw AZ leads.
 * @param {object[]} rawLeads
 * @param {object} fieldMap
 * @returns {object[]} array of NormalizedLead
 */
export function normalizeLeads(rawLeads, fieldMap) {
  if (!Array.isArray(rawLeads)) return [];
  return rawLeads.map((lead) => normalizeLead(lead, fieldMap));
}
