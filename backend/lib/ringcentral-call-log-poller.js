/**
 * Polls RingCentral call log every 30s. Logs ended calls; for calls with recordings,
 * inserts into call_recordings and kicks off Deepgram transcription.
 */
import { getRingCentralSDK } from "./ringcentral.js";
import {
	getRingCentralTokens,
	setRingCentralTokens,
} from "./ringcentral-token-store.js";
import { getSupabase } from "./supabase.js";
import { processRecording } from "./recording-processor.js";

const STATE_KEY = "default";
const POLL_INTERVAL_MS = 30 * 1000;
const DATE_FROM_MINUTES = 30;

const processedCallIds = new Set();
let pollerStopped = false;
let refreshTokenExpiredLogged = false;

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

async function poll() {
	if (pollerStopped) return;
	const tokens = await getRingCentralTokens(STATE_KEY);
	if (!tokens?.access_token) {
		return;
	}

	const sdk = getRingCentralSDK();
	if (!sdk) return;

	const platform = sdk.platform();
	const oldTokens = {
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token,
		expire_time: tokens.expire_time,
	};

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

		// If name is an object (rare but possible), try displayName fields.
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

	/**
	 * Detailed call log legs often carry the answering extension / display names that
	 * the top-level `to` party omits (company DID has no CNAM in `to.name`).
	 */
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
		if (baseToName) return baseToName;

		if (
			record.to &&
			typeof record.to.location === "string" &&
			record.to.location.trim()
		) {
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

	async function persistUpdatedTokensIfNeeded() {
		try {
			// The RingCentral SDK may silently refresh access tokens when needed.
			// Persist any rotated refresh token so the next poll keeps working.
			const authData = await platform.auth().data();
			const nextAccess = authData?.access_token;
			const nextRefresh = authData?.refresh_token;
			const nextExpire = authData?.expire_time;
			const nextExpiresIn = authData?.expires_in;

			if (!nextAccess || !nextRefresh) return;

			const changed =
				nextAccess !== oldTokens.access_token ||
				nextRefresh !== oldTokens.refresh_token ||
				nextExpire !== oldTokens.expire_time;

			if (!changed) return;

			await setRingCentralTokens(STATE_KEY, {
				access_token: nextAccess,
				refresh_token: nextRefresh,
				expire_time: nextExpire,
				expires_in: nextExpiresIn,
			});

			console.log("[CallLog] Persisted refreshed RingCentral tokens");
		} catch (e) {
			// Don't fail call logging because token persistence failed.
			console.error("[CallLog] Failed to persist refreshed tokens:", e.message);
		}
	}

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
				// Adds `legs` (e.g. Accept + extension id) so we can resolve receiver name.
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

		let newCount = 0;
		let loggedMissingNames = false;
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
			const fromName = pickPartyName(record.from);
			let toName = pickPartyName(record.to);
			// Only enrich when we persist (avoids extra /extension calls for log-only rows).
			if (hasRecording) {
				toName = await enrichToPartyName(record, toName);
			}
			const startTime = record.startTime ?? "—";
			const duration = record.duration ?? 0;
			const type = record.type ?? "—";
			const result = record.result ?? "—";
			const direction = record.direction ?? "—";
			// Match RingCentral call-log semantics: `from` / `to` are already the wire parties
			// (inbound: customer → from, your number → to; outbound: your line → from, callee → to).
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
				// Backfill names for already-inserted rows so UI updates immediately.
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
		const mostRecentText = mostRecentEst ? mostRecentEst : "—";

		console.log(
			`🕒 [CallLog] Poll run - ${allRecords.length} calls in the logs from last ${DATE_FROM_MINUTES}mins, most recent call was at ${mostRecentText}`
		);

		// Persist tokens after polling so any refresh-token rotation is not lost.
		await persistUpdatedTokensIfNeeded();
	} catch (e) {
		// If RingCentral refreshed/rotated tokens before failing, persist them.
		try {
			await persistUpdatedTokensIfNeeded();
		} catch {
			// ignore
		}

		const msg = e?.message || "";
		if (/refresh token has expired/i.test(msg)) {
			if (!refreshTokenExpiredLogged) {
				console.error(
					"🔴 [CallLog] Refresh token has expired. Reconnect RingCentral to continue polling."
				);
				refreshTokenExpiredLogged = true;
			}
			pollerStopped = true;
			return;
		}

		console.error("[CallLog poll] API error:", msg);
	}
}

let intervalId = null;

export function startCallLogPoller() {
	if (intervalId) return;
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
