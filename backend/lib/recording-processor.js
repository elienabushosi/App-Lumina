/**
 * Process a call recording: download from RingCentral, transcribe with Deepgram, store in DB.
 */
import { getSupabase } from "./supabase.js";
import { getRingCentralTokens } from "./ringcentral-token-store.js";
import { transcribeWithDiarization } from "./deepgram.js";

/**
 * Download recording from RingCentral (requires auth).
 * @param {string} recordingContentUri - Full URL from call log recording.contentUri
 * @param {string} accessToken - RingCentral access token
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function downloadRecording(recordingContentUri, accessToken) {
	const response = await fetch(recordingContentUri, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		throw new Error(`RingCentral recording download failed: ${response.status} ${response.statusText}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/wav";
	return { buffer: Buffer.from(arrayBuffer), contentType };
}

/**
 * Process one call_recording row: download, transcribe, update DB.
 * @param {string} recordingId - call_recordings.id (uuid)
 */
export async function processRecording(recordingId) {
	const db = getSupabase();
	const { data: row, error: fetchError } = await db
		.from("call_recordings")
		.select("id, id_organization, ringcentral_call_id, recording_content_uri, status")
		.eq("id", recordingId)
		.single();

	if (fetchError || !row) {
		console.error("[RecordingProcessor] Row not found:", recordingId, fetchError?.message);
		return;
	}
	if (row.status !== "pending_transcription") {
		return;
	}

	await db
		.from("call_recordings")
		.update({ status: "transcribing", updated_at: new Date().toISOString() })
		.eq("id", recordingId);

	const tokens = await getRingCentralTokens(row.id_organization);
	if (!tokens?.access_token) {
		await db
			.from("call_recordings")
			.update({
				status: "failed",
				error_message: "No RingCentral tokens",
				updated_at: new Date().toISOString(),
			})
			.eq("id", recordingId);
		return;
	}

	try {
		const { buffer: audioBuffer, contentType } = await downloadRecording(row.recording_content_uri, tokens.access_token);
		const { transcript, words } = await transcribeWithDiarization(audioBuffer, contentType);

		await db
			.from("call_recordings")
			.update({
				status: "transcribed",
				transcript,
				transcript_words: words?.length ? words : null,
				error_message: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", recordingId);

		console.log("[RecordingProcessor] Transcribed:", row.ringcentral_call_id, "length:", transcript?.length ?? 0);
	} catch (err) {
		console.error("[RecordingProcessor] Error:", row.ringcentral_call_id, err.message);
		await db
			.from("call_recordings")
			.update({
				status: "failed",
				error_message: err.message,
				updated_at: new Date().toISOString(),
			})
			.eq("id", recordingId);
	}
}
