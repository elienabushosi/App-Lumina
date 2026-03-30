import express from "express";
import {
  connectAgencyZoom,
  getAgencyZoomJwt,
  loadAgencyZoomConnection,
} from "../lib/agencyzoom.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabase } from "../lib/supabase.js";
import { loadSchema, hasNewFields, discoverSchema } from "../lib/agencyzoom-schema-discovery.js";
import { normalizeLeads } from "../lib/agencyzoom-normalizer.js";

const router = express.Router();
const DEFAULT_ORG_ID = "default";
const AGENCYZOOM_BASE_URL =
  process.env.AGENCYZOOM_BASE_URL || "https://api.agencyzoom.com";

// ---------------------------------------------------------------------------
// Status — org-aware (requireAuth), falls back to "default" in dev bypass
// ---------------------------------------------------------------------------
router.get("/status", requireAuth, async (req, res) => {
  try {
    const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
    await getAgencyZoomJwt(orgId);
    const conn = await loadAgencyZoomConnection(orgId);
    res.json({ connected: true, az_email: conn?.api_key ?? null });
  } catch {
    res.json({ connected: false });
  }
});

// ---------------------------------------------------------------------------
// Connect — save credentials for the org
// ---------------------------------------------------------------------------
router.post("/connect", requireAuth, async (req, res) => {
  const { email, password } = req.body || {};
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;

  if (req.user.Role !== "Owner" && req.user.Role !== "Admin") {
    return res.status(403).json({ error: "Only org owners can connect AgencyZoom." });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    await connectAgencyZoom({ email, password, orgId });
    res.json({ success: true, az_email: email });
  } catch (error) {
    console.error("[AgencyZoom] connect error:", error.message);
    res.status(400).json({ success: false, error: error.message || "Connect failed" });
  }
});

// ---------------------------------------------------------------------------
// Helper — proxy a GET to the AZ API using the org's JWT
// ---------------------------------------------------------------------------
async function proxyAgencyZoom(orgId, res, path) {
  try {
    const jwt = await getAgencyZoomJwt(orgId);
    const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("[AgencyZoom] Config proxy failed:", path, response.status, text.slice(0, 300));
      return res.status(500).json({ error: `AgencyZoom config request failed: ${response.status}` });
    }
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return res.json(json);
  } catch (error) {
    console.error("[AgencyZoom] Config proxy error:", error.message);
    return res.status(500).json({ error: "Failed to fetch AgencyZoom config data" });
  }
}

// ---------------------------------------------------------------------------
// GET /config/all — fetch all discovery data in parallel for the setup wizard
// ---------------------------------------------------------------------------
router.get("/config/all", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    const jwt = await getAgencyZoomJwt(orgId);
    const base = AGENCYZOOM_BASE_URL.replace(/\/$/, "");

    // Fetch with one retry on failure (handles rotating 429s from AZ rate limiter)
    const fetchJson = async (path, attempt = 1) => {
      const r = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const text = await r.text();
      if (!r.ok) {
        if (r.status === 429 && attempt === 1) {
          await new Promise((res) => setTimeout(res, 1500));
          return fetchJson(path, 2);
        }
        console.error(`[AgencyZoom] /config/all fetch failed: ${path} → ${r.status} ${r.statusText} — ${text.slice(0, 200)}`);
        return null;
      }
      try {
        const json = JSON.parse(text);
        const preview = Array.isArray(json)
          ? `array(${json.length}) keys=${json[0] ? Object.keys(json[0]).join(",") : "empty"}`
          : `object keys=${Object.keys(json).join(",")}`;
        console.log(`[AgencyZoom] /config/all OK: ${path} → ${preview}`);
        return json;
      } catch { return null; }
    };

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const customFieldsRaw = await fetchJson("/v1/api/custom-fields");
    await delay(500);
    const pipelinesAndStages = await fetchJson("/v1/api/pipelines-and-stages");
    await delay(500);
    const employeesRaw = await fetchJson("/v1/api/employees");
    await delay(500);
    const leadSources = await fetchJson("/v1/api/lead-sources");
    await delay(500);
    const locationsRaw = await fetchJson("/v1/api/locations");

    // Normalize custom fields: AZ returns { fieldName, label } but frontend expects fieldLabel
    const customFields = Array.isArray(customFieldsRaw)
      ? customFieldsRaw.map((f) => ({ ...f, fieldLabel: f.fieldLabel ?? f.label ?? f.fieldName }))
      : customFieldsRaw;

    // Normalize employees: AZ returns lowercase firstname/lastname
    const employees = Array.isArray(employeesRaw)
      ? employeesRaw.map((e) => ({ ...e, name: e.name ?? `${e.firstname ?? e.firstName ?? ""} ${e.lastname ?? e.lastName ?? ""}`.trim() }))
      : employeesRaw;

    // Normalize locations: AZ returns { id, name } with no agencyNumber/locationCode
    const locations = Array.isArray(locationsRaw)
      ? locationsRaw.map((loc) => ({
          ...loc,
          agencyNumber: loc.agencyNumber ?? loc.locationCode ?? String(loc.id ?? ""),
          locationCode: loc.locationCode ?? String(loc.id ?? ""),
        }))
      : locationsRaw;

    // Load existing saved config for pre-population
    const db = getSupabase();
    const { data: savedConfig } = await db
      .from("agencyzoom_config")
      .select("*")
      .eq("id_organization", orgId)
      .maybeSingle();

    res.json({ customFields, pipelinesAndStages, employees, leadSources, locations, savedConfig: savedConfig ?? null });
  } catch (error) {
    console.error("[AgencyZoom] /config/all error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /config — save org AgencyZoom config to DB
// ---------------------------------------------------------------------------
router.post("/config", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  const {
    lead_source_id, pipeline_id, stage_id, primary_producer_id,
    primary_csr_id, location_code, country,
    cf_roof_year, cf_roof_type, cf_flooring_types, cf_bathrooms, cf_occupation_degree,
  } = req.body;

  const db = getSupabase();
  const { error } = await db.from("agencyzoom_config").upsert(
    {
      id_organization: orgId,
      lead_source_id:      lead_source_id      ?? null,
      pipeline_id:         pipeline_id         ?? null,
      stage_id:            stage_id            ?? null,
      primary_producer_id: primary_producer_id ?? null,
      primary_csr_id:      primary_csr_id      ?? null,
      location_code:       location_code       ?? null,
      country:             country             ?? "US",
      cf_roof_year:        cf_roof_year        ?? null,
      cf_roof_type:        cf_roof_type        ?? null,
      cf_flooring_types:   cf_flooring_types   ?? null,
      cf_bathrooms:        cf_bathrooms        ?? null,
      cf_occupation_degree: cf_occupation_degree ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id_organization" }
  );

  if (error) {
    console.error("[AgencyZoom] /config save error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

// GET /leads — read stored leads from Supabase, zero AZ calls
router.get("/leads", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("agencyzoom_leads")
      .select("az_lead_id, data, pulled_at, updated_at")
      .eq("id_organization", orgId)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const leads = (data || []).map((row) => row.data);
    const lastPulled = data?.[0]?.pulled_at ?? null;
    return res.json({ leads, lastPulled, total: leads.length });
  } catch (err) {
    console.error("[AgencyZoom] GET /leads error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /leads/pull — fetch from AZ, run schema discovery if needed, upsert to DB
router.post("/leads/pull", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    let jwt;
    try {
      jwt = await getAgencyZoomJwt(orgId);
    } catch {
      return res.status(403).json({ error: "not_connected" });
    }

    const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}/v1/api/leads/list`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ page: 0, pageSize: 100, sort: "createDate", order: "desc" }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[AgencyZoom] leads/pull AZ fetch failed:", response.status, text);
      return res.status(response.status).json({ error: `AgencyZoom error: ${response.status} — ${text.slice(0, 200)}` });
    }

    const json = JSON.parse(text);
    const rawItems = json.data ?? json.leads ?? json;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.json({ pulled: 0, message: "No leads found in AgencyZoom." });
    }

    console.log(`[AgencyZoom] leads/pull: fetched ${rawItems.length} leads for org: ${orgId}`);

    // Schema discovery — run Claude if new fields detected.
    const rawFieldNames = Object.keys(rawItems[0]);
    let schema = await loadSchema(orgId);

    if (!schema || hasNewFields(rawFieldNames, schema.raw_fields)) {
      try {
        const discovered = await discoverSchema(orgId, rawItems[0]);
        schema = discovered;
      } catch (discoveryErr) {
        console.error("[AZ Schema] Discovery failed during pull:", discoveryErr.message);
        // Continue without normalization — store raw leads
        schema = { field_map: {} };
      }
    }

    // Normalize and upsert into Supabase.
    const normalizedItems = normalizeLeads(rawItems, schema.field_map);
    const db = getSupabase();
    const pulledAt = new Date().toISOString();

    const rows = normalizedItems.map((lead, i) => ({
      az_lead_id: String(lead.id || rawItems[i]?.id || i),
      id_organization: orgId,
      data: lead,
      raw_data: rawItems[i] ?? {},
      pulled_at: pulledAt,
      updated_at: pulledAt,
    }));

    const { error: upsertError } = await db
      .from("agencyzoom_leads")
      .upsert(rows, { onConflict: "id_organization,az_lead_id" });

    if (upsertError) throw upsertError;

    console.log(`[AgencyZoom] leads/pull: upserted ${rows.length} leads for org: ${orgId}`);
    return res.json({ pulled: rows.length, lastPulled: pulledAt });
  } catch (err) {
    console.error("[AgencyZoom] leads/pull error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /leads/list — kept for backwards compatibility, now deprecated in favour of GET /leads + POST /leads/pull
router.post("/leads/list", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    let jwt;
    try {
      jwt = await getAgencyZoomJwt(orgId);
    } catch {
      return res.status(403).json({ error: "not_connected" });
    }
    const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}/v1/api/leads/list`;

    const body = {
      page: req.body.page ?? 0,
      pageSize: req.body.pageSize ?? 50,
      sort: req.body.sort ?? "lastEnterStageDate",
      order: req.body.order ?? "desc",
      ...(req.body.status !== undefined && { status: req.body.status }),
      ...(req.body.startDate && { startDate: req.body.startDate }),
      ...(req.body.endDate && { endDate: req.body.endDate }),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[AgencyZoom] leads/list failed:", response.status, text.slice(0, 300));
      return res.status(response.status).json({ error: `AgencyZoom error: ${response.status}` });
    }

    const json = JSON.parse(text);
    const rawItems = json.data ?? json.leads ?? json;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.json({ data: [], _normalized: true });
    }

    console.log("[AgencyZoom] leads/list sample keys:", Object.keys(rawItems[0]));

    // Schema discovery — run Claude if this org has new fields we haven't seen before.
    const rawFieldNames = Object.keys(rawItems[0]);
    let schema = await loadSchema(orgId);

    if (!schema || hasNewFields(rawFieldNames, schema.raw_fields)) {
      try {
        const { field_map, display_config, downstream_map } = await discoverSchema(orgId, rawItems[0]);
        schema = { field_map, display_config, downstream_map };
      } catch (discoveryErr) {
        console.error("[AZ Schema] Discovery failed, returning raw leads:", discoveryErr.message);
        return res.json(json);
      }
    }

    // Normalize leads using the stored field map.
    const normalizedItems = normalizeLeads(rawItems, schema.field_map);
    return res.json({ data: normalizedItems, _normalized: true });
  } catch (err) {
    console.error("[AgencyZoom] leads/list error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/leads/:leadId", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    const jwt = await getAgencyZoomJwt(orgId);
    const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}/v1/api/leads/${req.params.leadId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[AgencyZoom] leads/:id failed:", response.status, text.slice(0, 300));
      return res.status(response.status).json({ error: `AgencyZoom error: ${response.status}` });
    }

    return res.json(JSON.parse(text));
  } catch (err) {
    console.error("[AgencyZoom] leads/:id error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Individual config proxy endpoints (org-aware)
// ---------------------------------------------------------------------------
router.get("/config/lead-sources",       requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/lead-sources"));
router.get("/config/pipelines",          requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/pipelines?type=lead"));
router.get("/config/pipelines-and-stages", requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/pipelines-and-stages"));
router.get("/config/locations",          requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/locations"));
router.get("/config/employees",          requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/employees"));
router.get("/config/csrs",               requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/csrs"));
router.get("/config/custom-fields",      requireAuth, (req, res) => proxyAgencyZoom(req.user.IdOrganization ?? DEFAULT_ORG_ID, res, "/v1/api/custom-fields"));

export default router;
