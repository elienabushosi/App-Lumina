import express from "express";
import { getSupabase } from "../lib/supabase.js";
import { extractLeadFromTranscript } from "../lib/claude-extract-lead.js";
import { createAgencyZoomLeadForCall } from "../lib/agencyzoom-leads.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// GET /api/calls
// List recent call_recordings for debugging UI.
// ?mine=1  — filter to calls handled by the requesting user
router.get("/", async (req, res) => {
	try {
		const db = getSupabase();
		const limit = Number.parseInt(req.query.limit, 10) || 50;
		const mine = req.query.mine === "1";

		let query = db
			.from("call_recordings")
			.select(
				"id, id_organization, ringcentral_call_id, from_number, to_number, from_name, to_name, start_time, duration_sec, status, lead_status, handled_by_user_id"
			)
			.eq("id_organization", req.user.IdOrganization)
			.order("start_time", { ascending: false, nullsFirst: false })
			.limit(limit);

		if (mine) {
			query = query.eq("handled_by_user_id", req.user.IdUser);
		}

		const { data, error } = await query;

		if (error) {
			console.error("[Calls] list error:", error.message);
			return res.status(500).json({ error: "Failed to list calls" });
		}

		return res.json({ items: data ?? [] });
	} catch (err) {
		console.error("[Calls] list error (exception):", err.message);
		return res.status(500).json({ error: "Failed to list calls" });
	}
});

// GET /api/calls/:id
// Single call_recordings row with transcript and lead payload.
router.get("/:id", async (req, res) => {
	try {
		const db = getSupabase();
		const id = req.params.id;

		const { data, error } = await db
			.from("call_recordings")
			.select(
				"id, id_organization, ringcentral_call_id, from_number, to_number, from_name, to_name, start_time, duration_sec, status, lead_status, transcript, lead_payload"
			)
			.eq("id", id)
			.eq("id_organization", req.user.IdOrganization)
			.single();

		if (error || !data) {
			return res.status(404).json({ error: "Call not found" });
		}

		return res.json(data);
	} catch (err) {
		console.error("[Calls] get error:", err.message);
		return res.status(500).json({ error: "Failed to load call" });
	}
});

// POST /api/calls/:id/extract-lead
// Runs Claude extraction for a single call_recordings row.
router.post("/:id/extract-lead", async (req, res) => {
	try {
		const db = getSupabase();
		const id = req.params.id;

		const { data: recording, error } = await db
			.from("call_recordings")
			.select(
				"id, ringcentral_call_id, status, transcript, transcript_words, lead_status, lead_payload"
			)
			.eq("id", id)
			.eq("id_organization", req.user.IdOrganization)
			.single();

		if (error || !recording) {
			return res.status(404).json({ error: "Recording not found" });
		}

		if (recording.status !== "transcribed") {
			return res.status(400).json({
				error: "Recording is not transcribed",
				status: recording.status,
			});
		}

		const transcript = recording.transcript || "";
		const words = recording.transcript_words || [];
		const meta = {
			call_id: recording.ringcentral_call_id,
		};

		const result = await extractLeadFromTranscript({
			transcript,
			words,
			meta,
		});

		await db
			.from("call_recordings")
			.update({
				lead_payload: result,
				lead_status: result?.lead?.status || "extracted",
				lead_error: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", id);

		return res.json({
			ok: true,
			lead_status: result?.lead?.status || "extracted",
			lead: result.lead,
		});
	} catch (err) {
		console.error("[Calls] extract-lead error:", err.message);
		try {
			const db = getSupabase();
			await db
				.from("call_recordings")
				.update({
					lead_status: "error",
					lead_error: err.message,
					updated_at: new Date().toISOString(),
				})
				.eq("id", req.params.id);
		} catch {
			// ignore secondary errors
		}
		return res.status(500).json({ error: "Lead extraction failed" });
	}
});

// POST /api/calls/:id/push-agencyzoom
// Uses existing lead_payload to create a lead in AgencyZoom.
router.post("/:id/push-agencyzoom", async (req, res) => {
	try {
		const db = getSupabase();
		const id = req.params.id;

		const { data: recording, error } = await db
			.from("call_recordings")
			.select(
				"id, id_organization, ringcentral_call_id, lead_status, lead_payload"
			)
			.eq("id", id)
			.eq("id_organization", req.user.IdOrganization)
			.single();

		if (error || !recording) {
			return res.status(404).json({ error: "Recording not found" });
		}

		if (!recording.lead_payload || !recording.lead_payload.lead) {
			return res.status(400).json({
				error: "No lead payload found. Run extract-lead first.",
				lead_status: recording.lead_status,
			});
		}

		await createAgencyZoomLeadForCall(recording, req.user.IdUser);

		return res.json({
			ok: true,
			message: "Lead pushed to AgencyZoom",
		});
	} catch (err) {
		console.error("[Calls] push-agencyzoom error:", err.message);
		return res
			.status(500)
			.json({ error: "Failed to push lead to AgencyZoom" });
	}
});

export default router;

