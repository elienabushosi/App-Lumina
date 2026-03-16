import express from "express";
import {
  connectAgencyZoom,
  loadAgencyZoomConnection,
  getAgencyZoomJwt,
} from "../lib/agencyzoom.js";

const router = express.Router();
const DEFAULT_ORG_ID = "default";
const AGENCYZOOM_BASE_URL =
  process.env.AGENCYZOOM_BASE_URL || "https://api.agencyzoom.com";

router.get("/status", async (req, res) => {
  try {
    const conn = await loadAgencyZoomConnection(DEFAULT_ORG_ID);
    const connected = !!(conn && conn.jwt_token);
    res.json({ connected });
  } catch (error) {
    console.error("[AgencyZoom] status error:", error.message);
    res.status(500).json({ error: "Failed to load AgencyZoom status" });
  }
});

router.post("/connect", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "email and password are required" });
  }

  try {
    const result = await connectAgencyZoom({
      email,
      password,
      orgId: DEFAULT_ORG_ID,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[AgencyZoom] connect error:", error.message);
    res
      .status(400)
      .json({ success: false, error: error.message || "Connect failed" });
  }
});

async function proxyAgencyZoom(req, res, path) {
  try {
    const jwt = await getAgencyZoomJwt(DEFAULT_ORG_ID);
    const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(
        "[AgencyZoom] Config proxy failed:",
        path,
        response.status,
        text.slice(0, 300)
      );
      return res.status(500).json({
        error: `AgencyZoom config request failed: ${response.status}`,
      });
    }
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return res.json(json);
  } catch (error) {
    console.error("[AgencyZoom] Config proxy error:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to fetch AgencyZoom config data" });
  }
}

// Simple config proxy endpoints to help discover IDs during setup.
router.get("/config/lead-sources", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/lead-sources")
);

router.get("/config/pipelines", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/pipelines?type=lead")
);

router.get("/config/pipelines-and-stages", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/pipelines-and-stages")
);

router.get("/config/locations", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/locations")
);

router.get("/config/employees", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/employees")
);

router.get("/config/csrs", (req, res) =>
  proxyAgencyZoom(req, res, "/v1/api/csrs")
);

export default router;

