import express from "express";
import {
  connectAgencyZoom,
  loadAgencyZoomConnection,
} from "../lib/agencyzoom.js";

const router = express.Router();
const DEFAULT_ORG_ID = "default";

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

export default router;

