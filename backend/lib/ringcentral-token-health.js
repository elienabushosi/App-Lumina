/**
 * RingCentral token health checker.
 *
 * Runs every 5 minutes. For each connected org, makes a lightweight RC API
 * call to verify tokens are still valid. Updates token_valid in DB accordingly.
 *
 * Uses a Redis distributed lock (SET NX EX) to ensure only one backend
 * instance runs the health check at a time — prevents concurrent token use
 * during Railway rolling deploys, which can cause RC to revoke tokens.
 */
import Redis from "ioredis";
import { createRingCentralSDKForOrg } from "./ringcentral.js";
import { getRingCentralTokens, getAllConnectedOrgs, setTokenValid } from "./ringcentral-token-store.js";

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_KEY = "rc:health:lock";
const LOCK_TTL_SECONDS = 60; // lock expires after 60s if holder dies

let redis = null;
let intervalId = null;

function getRedis() {
	if (!redis) {
		const url = process.env.REDIS_URL || "redis://localhost:6379";
		redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
		redis.on("error", (err) => {
			console.error("[RC:Health] Redis error:", err.message);
		});
	}
	return redis;
}

async function acquireLock() {
	try {
		const result = await getRedis().set(LOCK_KEY, "1", "EX", LOCK_TTL_SECONDS, "NX");
		return result === "OK";
	} catch {
		return false;
	}
}

async function releaseLock() {
	try {
		await getRedis().del(LOCK_KEY);
	} catch {
		// best effort
	}
}

async function checkOrg(orgId) {
	const tokens = await getRingCentralTokens(orgId);
	if (!tokens?.access_token) return;

	const sdk = createRingCentralSDKForOrg();
	if (!sdk) return;

	const platform = sdk.platform();
	try {
		await platform.auth().setData({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expire_time: tokens.expire_time,
		});
		// Lightweight call — just checks if tokens work
		await platform.get("/restapi/v1.0/status");
		await setTokenValid(orgId, true);
		console.log(`[RC:Health] ✅ Org ${orgId} tokens valid`);
	} catch (err) {
		const msg = err?.message || "";
		const isRevoked =
			msg.includes("revoked") ||
			msg.includes("expired") ||
			msg.includes("Unauthorized") ||
			msg.includes("401");
		if (isRevoked) {
			await setTokenValid(orgId, false);
			console.warn(`[RC:Health] ❌ Org ${orgId} tokens revoked — marked invalid`);
		} else {
			// Network error or RC outage — don't flip to false, could be transient
			console.warn(`[RC:Health] ⚠️ Org ${orgId} check failed (transient?): ${msg}`);
		}
	}
}

async function runHealthCheck() {
	const acquired = await acquireLock();
	if (!acquired) {
		console.log("[RC:Health] Another instance holds the lock — skipping this run");
		return;
	}
	try {
		const orgIds = await getAllConnectedOrgs();
		if (orgIds.length === 0) return;
		console.log(`[RC:Health] Checking ${orgIds.length} org(s)...`);
		await Promise.all(orgIds.map(checkOrg));
	} finally {
		await releaseLock();
	}
}

export function startTokenHealthChecker() {
	if (!process.env.RINGCENTRAL_CLIENT_ID) {
		console.log("[RC:Health] RC not configured — health checker not started");
		return;
	}
	console.log("[RC:Health] Token health checker started (every 5min, distributed lock)");
	// Run once at startup after a short delay so the old container has time to shut down
	setTimeout(() => {
		runHealthCheck();
		intervalId = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
	}, 15_000);
}

export function stopTokenHealthChecker() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
