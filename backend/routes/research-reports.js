import express from "express";
import { getSupabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// POST /api/research-reports
// Creates a new report, or updates the existing one if this org+lead already has one.
router.post("/", async (req, res) => {
	try {
		const db = getSupabase();
		const { agencyZoomLeadId, address, city, state, zip, leadName, leadPhone, leadEmail, cad, maps, realtor, status } = req.body;

		const [leadFirstName, ...rest] = (leadName ?? "").split(" ");
		const leadLastName = rest.join(" ") || null;

		const fields = {
			id_organization: req.user.IdOrganization,
			created_by: req.user.IdUser,
			agency_zoom_lead_id: agencyZoomLeadId ?? null,
			address: address ?? null,
			city: city ?? null,
			state: state ?? null,
			zip: zip ?? null,
			lead_first_name: leadFirstName || null,
			lead_last_name: leadLastName,
			lead_phone: leadPhone ?? null,
			lead_email: leadEmail ?? null,
			cad_data: cad ?? null,
			maps_data: maps ?? null,
			realtor_data: realtor ?? null,
			status: status ?? "in_progress",
			updated_at: new Date().toISOString(),
		};

		// If an AZ lead ID is provided, check for an existing report to update instead of insert.
		if (agencyZoomLeadId) {
			const { data: existing } = await db
				.from("research_reports")
				.select("id")
				.eq("id_organization", req.user.IdOrganization)
				.eq("agency_zoom_lead_id", agencyZoomLeadId)
				.single();

			if (existing) {
				const { error } = await db
					.from("research_reports")
					.update(fields)
					.eq("id", existing.id);

				if (error) {
					console.error("[research-reports] POST update error:", error.message);
					return res.status(500).json({ error: "Failed to update research report" });
				}
				return res.status(201).json({ id: existing.id });
			}
		}

		const { data, error } = await db
			.from("research_reports")
			.insert(fields)
			.select("id")
			.single();

		if (error) {
			console.error("[research-reports] POST insert error:", error.message);
			return res.status(500).json({ error: "Failed to save research report" });
		}

		return res.status(201).json({ id: data.id });
	} catch (err) {
		console.error("[research-reports] POST exception:", err.message);
		return res.status(500).json({ error: "Failed to save research report" });
	}
});

// PATCH /api/research-reports/:id
// Updates maps, realtor data, and/or status on an existing report.
router.patch("/:id", async (req, res) => {
	try {
		const db = getSupabase();
		const { maps, realtor, status } = req.body;

		const updates = { updated_at: new Date().toISOString() };
		if (maps !== undefined) updates.maps_data = maps;
		if (realtor !== undefined) updates.realtor_data = realtor;
		if (status !== undefined) updates.status = status;

		const { error } = await db
			.from("research_reports")
			.update(updates)
			.eq("id", req.params.id)
			.eq("id_organization", req.user.IdOrganization);

		if (error) {
			console.error("[research-reports] PATCH error:", error.message);
			return res.status(500).json({ error: "Failed to update research report" });
		}

		return res.json({ ok: true });
	} catch (err) {
		console.error("[research-reports] PATCH exception:", err.message);
		return res.status(500).json({ error: "Failed to update research report" });
	}
});

// GET /api/research-reports?agencyZoomLeadId=:id
// Fetches the research report for a given AZ lead within the org.
router.get("/", async (req, res) => {
	try {
		const db = getSupabase();
		const { agencyZoomLeadId } = req.query;

		if (!agencyZoomLeadId) {
			return res.status(400).json({ error: "agencyZoomLeadId is required" });
		}

		const { data, error } = await db
			.from("research_reports")
			.select("*")
			.eq("id_organization", req.user.IdOrganization)
			.eq("agency_zoom_lead_id", String(agencyZoomLeadId))
			.order("updated_at", { ascending: false })
			.limit(1)
			.single();

		if (error?.code === "PGRST116") {
			return res.status(404).json({ error: "Not found" });
		}

		if (error) {
			console.error("[research-reports] GET error:", error.message);
			return res.status(500).json({ error: "Failed to fetch research report" });
		}

		return res.json(data);
	} catch (err) {
		console.error("[research-reports] GET exception:", err.message);
		return res.status(500).json({ error: "Failed to fetch research report" });
	}
});

export default router;
