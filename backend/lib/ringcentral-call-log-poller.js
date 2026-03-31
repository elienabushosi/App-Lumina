/**
 * Polls RingCentral call log every 30s for each connected org.
 * Multi-tenant: one poller instance per org, keyed by id_organization.
 *
 * Token management: one platform instance per org, created at startup and kept
 * alive. The RC SDK handles access-token refresh automatically. refreshSuccess
 * persists rotated tokens to DB. refreshError stops that org's poller and
 * flags it for reconnect.
 */
import { createRingCentralSDKForOrg } from "./ringcentral.js";
import {
	getRingCentralTokens,
	setRingCentralTokens,
	getAllConnectedOrgs,
} from "./ringcentral-token-store.js";
import { getSupabase } from "./supabase.js";
import { processRecording } from "./recording-processor.js";

const POLL_INTERVAL_MS = 30 * 1000;
const DATE_FROM_MINUTES = 30;

/**
 * Per-org poller state.
 * @type {Map<string, { platform: any, processedCallIds: Set, pollerStopped: boolean, intervalId: any }>}
 */
const orgPollers = new Map();

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
 * Creates and initialises the platform for one org. Returns null if no tokens.
 */
async function initPlatform(orgId) {
	const sdk = createRingCentralSDKForOrg();
	if (!sdk) return null;

	const tokens = await getRingCentralTokens(orgId);
	if (!tokens?.access_token) return null;

	const p = sdk.platform();

	await p.auth().setData({
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token,
		expire_time: tokens.expire_time,
		refresh_token_expire_time: tokens.refresh_token_expire_time ?? (Date.now() + 7 * 24 * 60 * 60 * 1000),
	});

	// Persist rotated tokens on each successful refresh.
	p.on(p.events.refreshSuccess, async () => {
		try {
			const data = await p.auth().data();
			await setRingCentralTokens(orgId, {
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				expire_time: data.expire_time,
				refresh_token_expire_time: data.refresh_token_expire_time,
			});
			console.log(`[CallLog:${orgId}] Persisted refreshed RC tokens`);
		} catch (e) {
			console.error(`[CallLog:${orgId}] Failed to persist refreshed tokens:`, e.message);
		}
	});

	// Refresh token expired (7-day RC limit) — stop this org's poller.
	p.on(p.events.refreshError, () => {
		console.error(`🔴 [CallLog:${orgId}] Refresh token expired. Reconnect RingCentral.`);
		const state = orgPollers.get(orgId);
		if (state) state.pollerStopped = true;
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

async function enrichToPartyName(platform, record, baseToName) {
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

/**
 * Looks up the Lumina user ID mapped to an RC extension for this org.
 */
async function resolveHandledByUserId(orgId, extensionId) {
	if (!extensionId) return null;
	try {
		const db = getSupabase();
		const { data } = await db
			.from("rc_user_extensions")
			.select("id_user")
			.eq("id_organization", orgId)
			.eq("rc_extension_id", String(extensionId))
			.maybeSingle();
		return data?.id_user ?? null;
	} catch {
		return null;
	}
}

/**
 * Runs one poll cycle for an org.
 */
async function poll(orgId) {
	const state = orgPollers.get(orgId);
	if (!state || state.pollerStopped) return;
	const { platform, processedCallIds } = state;
	if (!platform) return;

	try {
		const allRecords = [];
		let page = 1;
		let totalPages = 1;
		const perPage = 100;

		do {
			const resp = await platform.get("/restapi/v1.0/account/~/extension/~/call-log", {
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
				console.error(`[CallLog:${orgId}] DB check error:`, e.message);
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
				toName = await enrichToPartyName(platform, record, toName);
			}
			const startTime = record.startTime ?? "—";
			const duration = record.duration ?? 0;
			const type = record.type ?? "—";
			const result = record.result ?? "—";
			const direction = record.direction ?? "—";
			const fromNumber = from !== "—" ? from : null;
			const toNumber = to !== "—" ? to : null;

			console.log(`[CallLog:${orgId}] Ended call:`, {
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
						console.log(`[CallLog:${orgId}] Missing from/to names; RC party fields:`, {
							fromKeys: Object.keys(record.from ?? {}),
							toKeys: Object.keys(record.to ?? {}),
							fromSample: record.from ?? null,
							toSample: record.to ?? null,
							legCount: Array.isArray(record.legs) ? record.legs.length : 0,
						});
					}

					// Determine which extension handled the call (for user attribution).
					const answeringExtId = findAnsweringExtensionId(record);
					const handledByUserId = await resolveHandledByUserId(orgId, answeringExtId);

					const db = getSupabase();
					const { data: inserted, error } = await db
						.from("call_recordings")
						.insert({
							id_organization: orgId,
							ringcentral_call_id: id,
							recording_content_uri: recordingContentUri,
							from_number: fromNumber,
							to_number: toNumber,
							from_name: fromName,
							to_name: toName,
							start_time: record.startTime || null,
							duration_sec: duration || null,
							status: "pending_transcription",
							handled_by_user_id: handledByUserId,
						})
						.select("id")
						.single();
					if (!error && inserted?.id) {
						existingRecordingIds.add(id);
						setImmediate(() => processRecording(inserted.id));
					} else if (error?.code !== "23505") {
						console.error(`[CallLog:${orgId}] Insert call_recordings error:`, error?.message);
					}
				} catch (e) {
					console.error(`[CallLog:${orgId}] Insert recording error:`, e.message);
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
					console.error(`[CallLog:${orgId}] Backfill names error:`, e.message);
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
			`🕒 [CallLog:${orgId}] Poll run - ${allRecords.length} calls in last ${DATE_FROM_MINUTES}mins, most recent: ${mostRecentEst ?? "—"}`
		);
	} catch (e) {
		const msg = e?.message || "";
		if (/refresh token has expired/i.test(msg)) {
			const state = orgPollers.get(orgId);
			if (state && !state.pollerStopped) {
				console.error(`🔴 [CallLog:${orgId}] Refresh token expired. Reconnect RingCentral.`);
				state.pollerStopped = true;
			}
			return;
		}
		console.error(`[CallLog:${orgId}] API error:`, msg);
	}
}

/**
 * Start a poller for one org. No-op if already running.
 */
export async function startOrgPoller(orgId) {
	const existing = orgPollers.get(orgId);
	if (existing?.intervalId) return; // already running

	const platform = await initPlatform(orgId);
	if (!platform) {
		console.log(`📞 [CallLog:${orgId}] No RC tokens — poller not started.`);
		return;
	}

	const state = {
		platform,
		processedCallIds: new Set(),
		pollerStopped: false,
		intervalId: null,
	};
	orgPollers.set(orgId, state);

	console.log(`📞 [CallLog:${orgId}] Poller started (every 30s).`);
	poll(orgId);
	state.intervalId = setInterval(() => poll(orgId), POLL_INTERVAL_MS);
}

/**
 * Stop the poller for one org.
 */
export function stopOrgPoller(orgId) {
	const state = orgPollers.get(orgId);
	if (state?.intervalId) {
		clearInterval(state.intervalId);
		state.intervalId = null;
		console.log(`📞 [CallLog:${orgId}] Poller stopped.`);
	}
}

/**
 * Stop then restart the poller for one org (call after OAuth reconnect).
 */
export async function resetAndRestartPoller(orgId) {
	stopOrgPoller(orgId);
	orgPollers.delete(orgId);
	await startOrgPoller(orgId);
}

/**
 * Start pollers for all orgs that have tokens in ringcentral_connections.
 * Called once at server startup.
 */
export async function startCallLogPoller() {
	const orgIds = await getAllConnectedOrgs();
	if (orgIds.length === 0) {
		console.log("📞 [CallLog] No RC connections found — no pollers started.");
		return;
	}
	for (const orgId of orgIds) {
		await startOrgPoller(orgId);
	}
}

/**
 * Stop all running pollers (used for graceful shutdown).
 */
export function stopCallLogPoller() {
	for (const [orgId] of orgPollers) {
		stopOrgPoller(orgId);
	}
}

