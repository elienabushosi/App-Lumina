/**
 * Polls RingCentral call log every 30s. Logs ended calls; for calls with recordings,
 * inserts into call_recordings and kicks off Deepgram transcription.
 *
 * Token management: one platform instance is created at startup and kept alive.
 * The RC SDK handles access-token refresh automatically. We listen for the
 * refreshSuccess event to persist rotated tokens back to DB. If the refresh token
 * itself expires (7-day RC limit), we stop the poller and flag for reconnect.
 */
import { getRingCentralSDK } from "./ringcentral.js";
import {
	getRingCentralTokens,
	setRingCentralTokens,
} from "./ringcentral-token-store.js";
import { getSupabase } from "./supabase.js";
import { processRecording } from "./recording-processor.js";

export const STATE_KEY = "default";
const POLL_INTERVAL_MS = 30 * 1000;
const DATE_FROM_MINUTES = 30;

const processedCallIds = new Set();
let pollerStopped = false;
let intervalId = null;

// Singleton platform instance — created once, kept alive across polls.
let platform = null;

function dateFrom() {
	const d = new Date(Date.now() - DATE_FROM_MINUTES * 60 * 1000);
	return d.toISOString();
}

function formatEstTime(isoString) {
	try {
		const d = new Date(isoString);
		if (Number.isNaN(d.getTime())) return null;
		return new Intl.DateTimeFormat("en-US", {
			timeZone: "America/New_York",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		}).format(d);
	} catch {
		return null;
	}
}

/**
 * Creates the singleton platform instance, restores stored tokens, and wires
 * up refreshSuccess / refreshError listeners.
 * Returns the platform, or null if SDK/tokens are not available.
 */
async function initPlatform() {
	const sdk = getRingCentralSDK();
	if (!sdk) return null;

	const tokens = await getRingCentralTokens(STATE_KEY);
	if (!tokens?.access_token) return null;

	const p = sdk.platform();

	await p.auth().setData({
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token,
		expire_time: tokens.expire_time,
	});

	// SDK auto-refreshes the access token; persist rotated tokens to DB.
	p.on(p.events.refreshSuccess, async () => {
		try {
			const data = await p.auth().data();
			await setRingCentralTokens(STATE_KEY, {
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				expire_time: data.expire_time,
			});
			console.log("[CallLog] Persisted refreshed RC tokens");
		} catch (e) {
			console.error("[CallLog] Failed to persist refreshed tokens:", e.message);
		}
	});

	// Refresh token expired (7-day RC limit) — stop poller, require reconnect.
	p.on(p.events.refreshError, () => {
		console.error(
			"🔴 [CallLog] Refresh token has expired. Reconnect RingCentral to continue polling."
		);
		pollerStopped = true;
	});

	return p;
}

function pickPartyName(party) {
	if (!party || typeof party !== "object") return null;

	const candidates = [
		party.name,
		party.displayName,
		party.contactName,
		party.callerName,
		party.userName,
		party.partyName,
		party?.contact?.name,
		party?.party?.name,
		party?.user?.name,
	];

	for (const c of candidates) {
		if (typeof c === "string" && c.trim() !== "") return c;
	}

	if (typeof party.name === "object" && party.name) {
		const nested = [
			party.name.displayName,
			party.name.value,
			party.name.name,
		];
		for (const c of nested) {
			if (typeof c === "string" && c.trim() !== "") return c;
		}
	}

	return null;
}

function pickNameFromDetailedLegs(record) {
	const legs = record.legs;
	if (!Array.isArray(legs) || legs.length === 0) return null;

	const acceptFirst = [];
	const rest = [];
	for (const leg of legs) {
		if (String(leg.legType || "").toLowerCase() === "accept") {
			acceptFirst.push(leg);
		} else {
			rest.push(leg);
		}
	}
	const ordered = acceptFirst.length ? [...acceptFirst, ...rest] : legs;

	for (const leg of ordered) {
		const n =
			pickPartyName(leg.to) ||
			pickPartyName(leg.from) ||
			(typeof leg.extension?.name === "string" && leg.extension.name.trim()
				? leg.extension.name.trim()
				: null);
		if (n) return n;
	}
	return null;
}

function findAnsweringExtensionId(record) {
	const legs = record.legs;
	if (!Array.isArray(legs)) return null;
	for (const leg of legs) {
		if (String(leg.legType || "").toLowerCase() !== "accept") continue;
		const id = leg.extension?.id ?? leg.extensionId;
		if (id != null) return id;
	}
	for (const leg of legs) {
		const id = leg.extension?.id ?? leg.extensionId;
		if (id != null) return id;
	}
	return null;
}

async function enrichToPartyName(record, baseToName) {
	/** In-memory for one poll — avoids duplicate GET /extension/{id} calls. */
	const extensionNameCache = new Map();

	async function getExtensionDisplayName(extensionId) {
		if (extensionId == null || extensionId === "") return null;
		const key = String(extensionId);
		if (extensionNameCache.has(key)) return extensionNameCache.get(key);
		try {
			const resp = await platform.get(
				`/restapi/v1.0/account/~/extension/${encodeURIComponent(key)}`
			);
			const ext = await resp.json();
			const fromContact = [ext.contact?.firstName, ext.contact?.lastName]
				.filter(Boolean)
				.join(" ")
				.trim();
			const label =
				(typeof ext.name === "string" && ext.name.trim()) ||
				fromContact ||
				(ext.extensionNumber != null && String(ext.extensionNumber).trim() !== ""
					? `Extension ${String(ext.extensionNumber).trim()}`
					: null);
			if (label) extensionNameCache.set(key, label);
			return label || null;
		} catch (e) {
			console.error("[CallLog] Extension lookup failed:", key, e.message);
			return null;
		}
	}

	if (baseToName) return baseToName;

	if (record.to && typeof record.to.location === "string" && record.to.location.trim()) {
		return record.to.location.trim();
	}

	const fromLegs = pickNameFromDetailedLegs(record);
	if (fromLegs) return fromLegs;

	const extId = findAnsweringExtensionId(record);
	if (extId != null) {
		const resolved = await getExtensionDisplayName(extId);
		if (resolved) return resolved;
	}

	if (
		record.to &&
		record.to.extensionNumber != null &&
		String(record.to.extensionNumber).trim() !== ""
	) {
		return `Extension ${String(record.to.extensionNumber).trim()}`;
	}

	return null;
}

async function poll() {
	if (pollerStopped) return;
	if (!platform) return;

	try {
		const allRecords = [];
		let page = 1;
		let totalPages = 1;
		const perPage = 100;

		do {
			const resp = await platform.get("/restapi/v1.0/account/~/call-log", {
				dateFrom: dateFrom(),
				perPage,
				page,
				view: "Detailed",
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

		let loggedMissingNames = false;
		for (const record of allRecords) {
			const id = record.id;
			const recordingContentUri = record.recording?.contentUri ?? null;
			const hasRecording = !!recordingContentUri;

			if (!id) continue;
			if (processedCallIds.has(id) && !hasRecording) continue;

			processedCallIds.add(id);

			const from = record.from?.phoneNumber ?? record.from?.extensionNumber ?? record.from?.name ?? "—";
			const to = record.to?.phoneNumber ?? record.to?.extensionNumber ?? record.to?.name ?? "—";
			const fromName = pickPartyName(record.from);
			let toName = pickPartyName(record.to);
			if (hasRecording) {
				toName = await enrichToPartyName(record, toName);
			}
			const startTime = record.startTime ?? "—";
			const duration = record.duration ?? 0;
			const type = record.type ?? "—";
			const result = record.result ?? "—";
			const direction = record.direction ?? "—";
			const fromNumber = from !== "—" ? from : null;
			const toNumber = to !== "—" ? to : null;

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
					if (!fromName && !toName && !loggedMissingNames) {
						loggedMissingNames = true;
						console.log("[CallLog] Missing from/to names; RingCentral party fields:", {
							fromKeys: Object.keys(record.from ?? {}),
							toKeys: Object.keys(record.to ?? {}),
							fromSample: record.from ?? null,
							toSample: record.to ?? null,
							legCount: Array.isArray(record.legs) ? record.legs.length : 0,
						});
					}

					const db = getSupabase();
					const { data: inserted, error } = await db
						.from("call_recordings")
						.insert({
							id_organization: STATE_KEY,
							ringcentral_call_id: id,
							recording_content_uri: recordingContentUri,
							from_number: fromNumber,
							to_number: toNumber,
							from_name: fromName,
							to_name: toName,
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
			} else if (hasRecording && existingRecordingIds.has(id)) {
				try {
					const db = getSupabase();
					await db
						.from("call_recordings")
						.update({
							from_number: fromNumber,
							to_number: toNumber,
							from_name: fromName ?? null,
							to_name: toName ?? null,
						})
						.eq("ringcentral_call_id", id);
				} catch (e) {
					console.error("[CallLog] Backfill names error:", e.message);
				}
			}
		}

		const mostRecent = allRecords
			.map((r) => r.startTime)
			.filter(Boolean)
			.reduce((acc, cur) => {
				const accT = new Date(acc).getTime();
				const curT = new Date(cur).getTime();
				if (!Number.isFinite(accT)) return cur;
				if (!Number.isFinite(curT)) return acc;
				return curT > accT ? cur : acc;
			}, allRecords[0]?.startTime ?? null);

		const mostRecentEst = mostRecent ? formatEstTime(mostRecent) : null;
		console.log(
			`🕒 [CallLog] Poll run - ${allRecords.length} calls in the logs from last ${DATE_FROM_MINUTES}mins, most recent call was at ${mostRecentEst ?? "—"}`
		);
	} catch (e) {
		const msg = e?.message || "";
		// refreshError event handles this, but catch it here too as a safety net.
		if (/refresh token has expired/i.test(msg)) {
			if (!pollerStopped) {
				console.error(
					"🔴 [CallLog] Refresh token has expired. Reconnect RingCentral to continue polling."
				);
				pollerStopped = true;
			}
			return;
		}
		console.error("[CallLog poll] API error:", msg);
	}
}

export async function startCallLogPoller() {
	if (intervalId) return;

	platform = await initPlatform();
	if (!platform) {
		console.log("📞 [CallLog] No RC tokens found — poller not started.");
		return;
	}

	console.log("📞 [CallLog] Poller started (every 30s). Will log new ended calls.");
	poll();
	intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopCallLogPoller() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
		console.log("📞 [CallLog] Poller stopped.");
	}
}

/**
 * Call this after a successful RC OAuth reconnect to restart the poller
 * with fresh tokens.
 */
export async function resetAndRestartPoller() {
	stopCallLogPoller();
	pollerStopped = false;
	platform = null;
	await startCallLogPoller();
}
