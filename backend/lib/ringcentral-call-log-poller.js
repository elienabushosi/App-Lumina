/**
 * Polls RingCentral call log every 30s (workaround when Call Control webhook isn't approved).
 * Logs ended calls and the data we can pull (id, from, to, duration, result, recording).
 */
import { getRingCentralSDK } from "./ringcentral.js";
import { getRingCentralTokens } from "./ringcentral-token-store.js";

const STATE_KEY = "default";
const POLL_INTERVAL_MS = 30 * 1000;
const DATE_FROM_HOURS = 24; // fetch calls from last 24h; we only log ones we haven't seen

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

		let newCount = 0;
		for (const record of allRecords) {
			const id = record.id;
			if (!id || processedCallIds.has(id)) continue;

			processedCallIds.add(id);
			newCount++;

			const from = record.from?.phoneNumber ?? record.from?.extensionNumber ?? record.from?.name ?? "—";
			const to = record.to?.phoneNumber ?? record.to?.extensionNumber ?? record.to?.name ?? "—";
			const startTime = record.startTime ?? "—";
			const duration = record.duration ?? 0;
			const type = record.type ?? "—";
			const result = record.result ?? "—";
			const direction = record.direction ?? "—";
			const recording = record.recording
				? {
						id: record.recording.id,
						contentUri: record.recording.contentUri ? "(present)" : null,
						uri: record.recording.uri ? "(present)" : null,
					}
				: null;

			console.log("[CallLog] Ended call:", {
				id,
				direction,
				from,
				to,
				startTime,
				durationSec: duration,
				type,
				result,
				recording: recording ? "yes" : "no",
				recordingContentUri: record.recording?.contentUri ?? null,
			});
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
