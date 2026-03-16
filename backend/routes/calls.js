import express from "express";
import { getSupabase } from "../lib/supabase.js";
import { extractLeadFromTranscript } from "../lib/claude-extract-lead.js";

const router = express.Router();

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

export default router;

