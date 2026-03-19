/**
 * Polls RingCentral call log every 30s. Logs ended calls; for calls with recordings,
 * inserts into call_recordings and kicks off Deepgram transcription.
 */
import { getRingCentralSDK } from "./ringcentral.js";
import { getRingCentralTokens } from "./ringcentral-token-store.js";
import { getSupabase } from "./supabase.js";
import { processRecording } from "./recording-processor.js";

const STATE_KEY = "default";
const POLL_INTERVAL_MS = 30 * 1000;
const DATE_FROM_HOURS = 24;

const processedCallIds = new Set();

function dateFrom() {
	const d = new Date(Date.now() - DATE_FROM_HOURS * 60 * 60 * 1000);
	return d.toISOString();
}

async function poll() {
	const tokens = await getRingCentralTokens(STATE_KEY);
	if (!tokens?.access_token) {
		return;
	}

	const sdk = getRingCentralSDK();
	if (!sdk) return;

	const platform = sdk.platform();
	try {
		await platform.auth().setData({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expire_time: tokens.expire_time,
		});
	} catch (e) {
		console.error("[CallLog poll] Failed to set auth:", e.message);
		return;
	}

	try {
		const allRecords = [];
		let page = 1;
		let totalPages = 1;
		const perPage = 100;

		do {
			// Account-level = all extensions' calls (dashboard shows these). Extension-level = only the connected extension.
			const resp = await platform.get("/restapi/v1.0/account/~/call-log", {
				dateFrom: dateFrom(),
				perPage,
				page,
			});
			const data = await resp.json();
			const records = data.records || [];
			allRecords.push(...records);
			const paging = data.paging || {};
			totalPages = paging.totalPages ?? 1;
			page++;
		} while (page <= totalPages);

		const recordingCallIds = allRecords
			.filter((r) => r.recording?.contentUri)
			.map((r) => r.id);
		let existingRecordingIds = new Set();
		if (recordingCallIds.length > 0) {
			try {
				const db = getSupabase();
				const { data: rows } = await db
					.from("call_recordings")
					.select("ringcentral_call_id")
					.in("ringcentral_call_id", recordingCallIds);
				if (rows?.length) existingRecordingIds = new Set(rows.map((r) => r.ringcentral_call_id));
			} catch (e) {
				console.error("[CallLog] DB check error:", e.message);
			}
		}

		let newCount = 0;
		for (const record of allRecords) {
			const id = record.id;
			const recordingContentUri = record.recording?.contentUri ?? null;
			const hasRecording = !!recordingContentUri;

			if (!id) continue;
			// If we already saw this call but there was no recording content URI yet,
			// keep checking until it becomes available.
			if (processedCallIds.has(id) && !hasRecording) continue;

			processedCallIds.add(id);
			newCount++;

			const from = record.from?.phoneNumber ?? record.from?.extensionNumber ?? record.from?.name ?? "—";
			const to = record.to?.phoneNumber ?? record.to?.extensionNumber ?? record.to?.name ?? "—";
			const startTime = record.startTime ?? "—";
			const duration = record.duration ?? 0;
			const type = record.type ?? "—";
			const result = record.result ?? "—";
			const direction = record.direction ?? "—";

			console.log("[CallLog] Ended call:", {
				id,
				direction,
				from,
				to,
				startTime,
				durationSec: duration,
				type,
				result,
				recording: hasRecording ? "yes" : "no",
				recordingContentUri,
			});

			if (hasRecording && !existingRecordingIds.has(id)) {
				try {
					const db = getSupabase();
					const { data: inserted, error } = await db
						.from("call_recordings")
						.insert({
							id_organization: STATE_KEY,
							ringcentral_call_id: id,
							recording_content_uri: recordingContentUri,
							from_number: from !== "—" ? from : null,
							to_number: to !== "—" ? to : null,
							start_time: record.startTime || null,
							duration_sec: duration || null,
							status: "pending_transcription",
						})
						.select("id")
						.single();
					if (!error && inserted?.id) {
						existingRecordingIds.add(id);
						setImmediate(() => processRecording(inserted.id));
					} else if (error?.code !== "23505") {
						console.error("[CallLog] Insert call_recordings error:", error?.message);
					}
				} catch (e) {
					console.error("[CallLog] Insert recording error:", e.message);
				}
			}
		}
		console.log("[CallLog] Poll run —", allRecords.length, "calls in log,", newCount, "new");
	} catch (e) {
		console.error("[CallLog poll] API error:", e.message);
	}
}

let intervalId = null;

export function startCallLogPoller() {
	if (intervalId) return;
	console.log("[CallLog] Poller started (every 30s). Will log new ended calls.");
	poll();
	intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopCallLogPoller() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
		console.log("[CallLog] Poller stopped.");
	}
}
