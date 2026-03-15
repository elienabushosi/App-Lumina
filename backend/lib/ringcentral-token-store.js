/**
 * Temporary file-based store for RingCentral OAuth tokens (no DB yet).
 * Key is "default" for now; when we add Supabase, we'll key by IdOrganization.
 */
import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, "..", ".ringcentral-tokens.json");

async function readStore() {
	try {
		const raw = await readFile(FILE_PATH, "utf-8");
		return JSON.parse(raw);
	} catch (e) {
		if (e.code === "ENOENT") return {};
		throw e;
	}
}

async function writeStore(data) {
	await writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * @param {string} key - e.g. "default" or later IdOrganization
 * @returns {Promise<{ access_token: string, refresh_token: string, expire_time?: number } | null>}
 */
export async function getRingCentralTokens(key) {
	const store = await readStore();
	return store[key] || null;
}

/**
 * @param {string} key - e.g. "default" or later IdOrganization
 * @param {{ access_token: string, refresh_token: string, expire_time?: number, expires_in?: string, subscription_id?: string }} data
 */
export async function setRingCentralTokens(key, data) {
	const store = await readStore();
	const existing = store[key] || {};
	store[key] = {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expire_time: data.expire_time ?? (data.expires_in ? Date.now() / 1000 + Number(data.expires_in) : undefined),
		subscription_id: data.subscription_id ?? existing.subscription_id,
	};
	await writeStore(store);
}

/**
 * Update only subscription_id for a key (e.g. after creating webhook subscription).
 * @param {string} key
 * @param {string} subscriptionId
 */
export async function setRingCentralSubscriptionId(key, subscriptionId) {
	const store = await readStore();
	if (store[key]) {
		store[key].subscription_id = subscriptionId;
		await writeStore(store);
	}
}
