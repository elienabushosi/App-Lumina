import express from "express";
import {
  connectAgencyZoom,
  getAgencyZoomJwt,
} from "../lib/agencyzoom.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabase } from "../lib/supabase.js";

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
    // Attempt to get (or refresh) a valid JWT — throws if credentials are
    // missing or the stored password no longer works.
    await getAgencyZoomJwt(orgId);
    res.json({ connected: true });
  } catch (error) {
    // Distinguish a genuine auth failure from an unexpected server error
    const msg = error.message ?? "";
    const isAuthFailure =
      msg.includes("No stored") ||
      msg.includes("Invalid AgencyZoom") ||
      msg.includes("credentials");
    if (!isAuthFailure) {
      console.error("[AgencyZoom] status error:", msg);
    }
    res.json({ connected: false });
  }
});

// ---------------------------------------------------------------------------
// Connect — save credentials for the org
// ---------------------------------------------------------------------------
router.post("/connect", requireAuth, async (req, res) => {
  const { email, password } = req.body || {};
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await connectAgencyZoom({ email, password, orgId });
    res.json({ success: true, ...result });
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

    const fetchJson = async (path) => {
      const r = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const text = await r.text();
      if (!r.ok) {
        console.error(`[AgencyZoom] /config/all fetch failed: ${path} → ${r.status} ${r.statusText} — ${text.slice(0, 200)}`);
        return null;
      }
      try { return JSON.parse(text); } catch { return null; }
    };

    const [customFields, pipelinesAndStages, employees, leadSources, locations] =
      await Promise.all([
        fetchJson("/v1/api/custom-fields"),
        fetchJson("/v1/api/pipelines-and-stages"),
        fetchJson("/v1/api/employees"),
        fetchJson("/v1/api/lead-sources"),
        fetchJson("/v1/api/locations"),
      ]);

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
router.post("/leads/list", requireAuth, async (req, res) => {
  const orgId = req.user.IdOrganization ?? DEFAULT_ORG_ID;
  try {
    const jwt = await getAgencyZoomJwt(orgId);
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
    const items = json.data ?? json.leads ?? json;
    if (Array.isArray(items) && items.length > 0) {
      console.log("[AgencyZoom] leads/list sample keys:", Object.keys(items[0]));
    }
    return res.json(json);
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
