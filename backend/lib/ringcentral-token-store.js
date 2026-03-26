/**
 * RingCentral OAuth token store backed by Supabase (ringcentral_connections).
 * Key is id_organization; use "default" until multi-tenant orgs exist.
 */
import { getSupabase } from "./supabase.js";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, "..", ".ringcentral-tokens.json");

/**
 * One-time: if DB has no row for "default", try to migrate from file and return tokens.
 * @param {string} key
 * @returns {Promise<{ access_token: string, refresh_token: string, expire_time?: number, subscription_id?: string } | null>}
 */
async function migrateFromFileIfNeeded(key) {
	if (key !== "default") return null;
	try {
		const raw = await readFile(FILE_PATH, "utf-8");
		const store = JSON.parse(raw);
		const existing = store[key];
		if (!existing?.access_token) return null;
		const row = {
			access_token: existing.access_token,
			refresh_token: existing.refresh_token,
			expire_time: existing.expire_time ?? undefined,
			subscription_id: existing.subscription_id ?? null,
		};
		const db = getSupabase();
		await db.from("ringcentral_connections").upsert(
			{
				id_organization: key,
				access_token: row.access_token,
				refresh_token: row.refresh_token,
				expire_time: row.expire_time ?? null,
				subscription_id: row.subscription_id,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "id_organization" }
		);
		console.log("[RingCentral] Migrated tokens from file to DB for key:", key);
		return row;
	} catch (e) {
		if (e.code === "ENOENT") return null;
		console.warn("[RingCentral] File migration skipped:", e.message);
		return null;
	}
}

/**
 * @param {string} key - e.g. "default" or later IdOrganization
 * @returns {Promise<{ access_token: string, refresh_token: string, expire_time?: number, subscription_id?: string } | null>}
 */
export async function getRingCentralTokens(key) {
	const db = getSupabase();
	const { data, error } = await db
		.from("ringcentral_connections")
		.select("access_token, refresh_token, expire_time, refresh_token_expire_time, subscription_id")
		.eq("id_organization", key)
		.maybeSingle();

	if (error) {
		console.error("[RingCentral] Token store get error:", error.message);
		return null;
	}
	if (data) {
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expire_time: data.expire_time ?? undefined,
			refresh_token_expire_time: data.refresh_token_expire_time ?? undefined,
			subscription_id: data.subscription_id ?? undefined,
		};
	}
	return migrateFromFileIfNeeded(key);
}

/**
 * @param {string} key - e.g. "default" or later IdOrganization
 * @param {{ access_token: string, refresh_token: string, expire_time?: number, expires_in?: string, subscription_id?: string }} data
 */
export async function setRingCentralTokens(key, data) {
	const expireTime =
		data.expire_time ??
		(data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null);

	const refreshTokenExpireTime =
		data.refresh_token_expire_time ??
		(data.refresh_token_expires_in ? Date.now() + Number(data.refresh_token_expires_in) * 1000 : null);

	let subscriptionId = data.subscription_id ?? null;
	if (subscriptionId === null) {
		const existing = await getRingCentralTokens(key);
		if (existing?.subscription_id) subscriptionId = existing.subscription_id;
	}

	const db = getSupabase();
	const row = {
		id_organization: key,
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expire_time: expireTime,
		refresh_token_expire_time: refreshTokenExpireTime,
		subscription_id: subscriptionId,
		updated_at: new Date().toISOString(),
	};

	const { error } = await db.from("ringcentral_connections").upsert(row, {
		onConflict: "id_organization",
	});

	if (error) {
		console.error("[RingCentral] Token store set error:", error.message);
		throw error;
	}
}

/**
 * Returns all id_organization values that have an active RC access_token.
 * Used at startup to launch per-org pollers.
 * @returns {Promise<string[]>}
 */
export async function getAllConnectedOrgs() {
	const db = getSupabase();
	const { data, error } = await db
		.from("ringcentral_connections")
		.select("id_organization")
		.not("access_token", "is", null);
	if (error) {
		console.error("[RingCentral] getAllConnectedOrgs error:", error.message);
		return [];
	}
	return (data ?? []).map((r) => r.id_organization);
}

/**
 * Update only subscription_id for a key (e.g. after creating webhook subscription).
 * @param {string} key
 * @param {string} subscriptionId
 */
export async function setRingCentralSubscriptionId(key, subscriptionId) {
	const db = getSupabase();
	const { error } = await db
		.from("ringcentral_connections")
		.update({ subscription_id: subscriptionId, updated_at: new Date().toISOString() })
		.eq("id_organization", key);

	if (error) {
		console.error("[RingCentral] Token store setSubscriptionId error:", error.message);
		throw error;
	}
}
