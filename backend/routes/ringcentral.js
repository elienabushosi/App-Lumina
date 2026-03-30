/**
 * RingCentral OAuth + extensions + webhook.
 *
 * GET  /api/ringcentral/status         -> { connected: boolean }  (requires auth)
 * GET  /api/ringcentral/auth           -> redirect to RC authorize  (requires auth)
 * GET  /api/ringcentral/callback       -> exchange code, store tokens, start poller
 * GET  /api/ringcentral/extensions     -> list RC extensions + saved mappings  (requires auth)
 * POST /api/ringcentral/extensions/map -> save extension → user mapping  (requires auth)
 * GET  /api/ringcentral/webhook        -> validation (return Validation-Token header)
 * POST /api/ringcentral/webhook        -> call-ended events (respond 200, process async)
 */
import express from "express";
import { getRingCentralSDK } from "../lib/ringcentral.js";
import {
	getRingCentralTokens,
	setRingCentralTokens,
	setRingCentralSubscriptionId,
} from "../lib/ringcentral-token-store.js";
import { resetAndRestartPoller, startOrgPoller } from "../lib/ringcentral-call-log-poller.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabase } from "../lib/supabase.js";

const router = express.Router();

// statusCode=Disconnected fires when a call ends; CallControl permission required in app
const TELEPHONY_SESSIONS_FILTER = "/restapi/v1.0/account/~/telephony/sessions?statusCode=Disconnected";

// ---------------------------------------------------------------------------
// Status — uses logged-in user's org
// ---------------------------------------------------------------------------
router.get("/status", requireAuth, async (req, res) => {
	const orgId = req.user.IdOrganization;
	const tokens = await getRingCentralTokens(orgId);
	if (!tokens || !tokens.access_token) {
		return res.json({ connected: false });
	}
	// Connected = refresh token is still valid. The access token expires every ~60min
	// but the SDK auto-refreshes it, so checking access token expiry gives false
	// "Disconnected" after a server restart. Refresh token expiry (7-day window,
	// rolling) is the real indicator of whether reconnect is needed.
	const nowMs = Date.now();
	const rtExpireMs = typeof tokens.refresh_token_expire_time === "number"
		? tokens.refresh_token_expire_time
		: null;

	// Normalise: if stored in seconds (< year 2100 in ms), convert to ms.
	const normalizedRtExpireMs = rtExpireMs !== null && rtExpireMs < 4_000_000_000
		? rtExpireMs * 1000
		: rtExpireMs;

	// Fall back to access token check if refresh_token_expire_time not stored yet.
	let connected;
	if (normalizedRtExpireMs !== null) {
		connected = normalizedRtExpireMs > nowMs + 60_000;
	} else {
		const atExpireMs = typeof tokens.expire_time === "number"
			? (tokens.expire_time > 1_000_000_000_0 ? tokens.expire_time : tokens.expire_time * 1000)
			: null;
		connected = atExpireMs !== null && atExpireMs > nowMs + 60_000;
	}

	const payload = { connected };
	if (process.env.NODE_ENV === "development") {
		payload._debug = { nowMs, refresh_token_expire_time: tokens.refresh_token_expire_time, normalizedRtExpireMs };
	}
	res.json(payload);
});

// ---------------------------------------------------------------------------
// OAuth initiation — two variants:
//   GET /auth-url  (requires auth header) → returns JSON { url } for frontend fetch+redirect
//   GET /auth      (legacy, requires auth header) → 302 redirect to RC
// ---------------------------------------------------------------------------
router.get("/auth-url", requireAuth, (req, res) => {
	const sdk = getRingCentralSDK();
	const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;

	if (!sdk || !redirectUri) {
		return res.status(500).json({
			error: "RingCentral not configured",
			detail: !sdk ? "Missing RINGCENTRAL_CLIENT_ID/SECRET" : "Missing RINGCENTRAL_REDIRECT_URI",
		});
	}

	const orgId = req.user.IdOrganization;
	const platform = sdk.platform();
	const url = platform.loginUrl({ redirectUri, state: orgId });
	res.json({ url });
});

router.get("/auth", requireAuth, (req, res) => {
	const sdk = getRingCentralSDK();
	const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;
	const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

	if (!sdk || !redirectUri) {
		return res.status(500).json({
			error: "RingCentral not configured",
			detail: !sdk ? "Missing RINGCENTRAL_CLIENT_ID/SECRET" : "Missing RINGCENTRAL_REDIRECT_URI",
		});
	}

	const orgId = req.user.IdOrganization;
	const platform = sdk.platform();
	const authUrl = platform.loginUrl({ redirectUri, state: orgId });
	res.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// OAuth callback — state = orgId
// ---------------------------------------------------------------------------
router.get("/callback", async (req, res) => {
	const sdk = getRingCentralSDK();
	const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;
	const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

	if (!sdk || !redirectUri) {
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=not_configured`);
	}

	const { code, state, error: rcError, error_description: rcErrorDesc } = req.query;

	// RC sends ?error=... if the user denied access or permissions are insufficient
	if (rcError) {
		const msg = rcErrorDesc || rcError;
		console.error(`[RingCentral] OAuth error from RC: ${rcError} — ${rcErrorDesc}`);
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=${encodeURIComponent(msg)}`);
	}

	if (!code) {
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=no_code`);
	}

	// state = orgId set during /auth; fall back to "default" for legacy redirects
	const orgId = state || "default";
	console.log(`[RingCentral] Callback for org: ${orgId}, exchanging code...`);

	const clientId = process.env.RINGCENTRAL_CLIENT_ID;
	const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
	const serverUrl = process.env.RINGCENTRAL_SERVER_URL || "https://platform.ringcentral.com";
	try {
		// Bypass the RC SDK for token exchange — SDK doesn't reliably forward redirect_uri.
		// Call the token endpoint directly so we control exactly what's sent.
		const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
		const tokenRes = await fetch(`${serverUrl}/restapi/oauth/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Authorization": `Basic ${basicAuth}`,
			},
			body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
		});
		const tokenData = await tokenRes.json();
		if (!tokenRes.ok) throw new Error(tokenData.error_description || "Token exchange failed");
		await setRingCentralTokens(orgId, {
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token,
			expires_in: tokenData.expires_in,
			refresh_token_expires_in: tokenData.refresh_token_expires_in,
		});
		console.log("[RingCentral] Tokens stored for org:", orgId);

		// Restart this org's poller with fresh tokens.
		resetAndRestartPoller(orgId).catch((e) =>
			console.error(`[RingCentral:${orgId}] Failed to restart poller:`, e.message)
		);

		// Create webhook subscription if configured.
		const webhookUrl = process.env.RINGCENTRAL_WEBHOOK_URL;
		if (webhookUrl) {
			try {
				const platform = sdk.platform();
				await platform.auth().setData({
					access_token: tokenData.access_token,
					refresh_token: tokenData.refresh_token,
					expires_in: tokenData.expires_in,
					refresh_token_expires_in: tokenData.refresh_token_expires_in,
				});
				const subRes = await platform.post("/restapi/v1.0/subscription", {
					eventFilters: [TELEPHONY_SESSIONS_FILTER],
					deliveryMode: { transportType: "WebHook", address: webhookUrl },
					expiresIn: 604800,
				});
				const subJson = await subRes.json();
				if (subJson.id) {
					await setRingCentralSubscriptionId(orgId, subJson.id);
					console.log("[RingCentral] Webhook subscription created:", subJson.id);
				} else {
					console.warn("[RingCentral] Subscription response missing id:", subJson);
				}
			} catch (subErr) {
				console.error("🔴 [RingCentral] Subscription create error:", subErr.message);
			}
		} else {
			console.log("[RingCentral] RINGCENTRAL_WEBHOOK_URL not set; skipping subscription.");
		}

		return res.redirect(`${frontendUrl}/settings?ringcentral=connected`);
	} catch (err) {
		console.error("RingCentral callback error:", err.message);
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=exchange_failed`);
	}
});

// ---------------------------------------------------------------------------
// Extensions — list RC extensions for the org + saved user mappings
// ---------------------------------------------------------------------------
router.get("/extensions", requireAuth, async (req, res) => {
	const orgId = req.user.IdOrganization;
	const tokens = await getRingCentralTokens(orgId);
	if (!tokens?.access_token) {
		return res.status(400).json({ error: "RingCentral not connected for this org." });
	}

	// We need a live platform instance to call the RC API.
	const sdk = getRingCentralSDK();
	if (!sdk) return res.status(500).json({ error: "RC SDK not configured." });

	try {
		const p = sdk.platform();
		await p.auth().setData({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expire_time: tokens.expire_time,
			refresh_token_expire_time: tokens.refresh_token_expire_time ?? (Date.now() + 7 * 24 * 60 * 60 * 1000),
		});

		// Fetch all extensions.
		const resp = await p.get("/restapi/v1.0/account/~/extension", {
			perPage: 1000,
			page: 1,
			type: "User",
		});
		const data = await resp.json();
		const extensions = (data.records ?? []).map((ext) => ({
			id: String(ext.id),
			extensionNumber: ext.extensionNumber ?? null,
			name: ext.name ?? null,
			email: ext.contact?.email ?? null,
			status: ext.status ?? null,
		}));

		// Load saved mappings for this org.
		const db = getSupabase();
		const { data: mappings } = await db
			.from("rc_user_extensions")
			.select("rc_extension_id, id_user")
			.eq("id_organization", orgId);
		const mappingByExtId = Object.fromEntries(
			(mappings ?? []).map((m) => [m.rc_extension_id, m.id_user])
		);

		// Merge.
		const result = extensions.map((ext) => ({
			...ext,
			mapped_user_id: mappingByExtId[ext.id] ?? null,
		}));

		res.json({ extensions: result });
	} catch (e) {
		console.error("[RingCentral] /extensions error:", e.message);
		res.status(500).json({ error: "Failed to fetch RC extensions." });
	}
});

// ---------------------------------------------------------------------------
// Map extension → Lumina user
// ---------------------------------------------------------------------------
router.post("/extensions/map", requireAuth, async (req, res) => {
	const orgId = req.user.IdOrganization;
	const { rc_extension_id, rc_extension_number, rc_display_name, id_user } = req.body;

	if (!rc_extension_id) {
		return res.status(400).json({ error: "rc_extension_id is required." });
	}

	const db = getSupabase();

	if (!id_user) {
		// Remove mapping.
		await db
			.from("rc_user_extensions")
			.delete()
			.eq("id_organization", orgId)
			.eq("rc_extension_id", rc_extension_id);
		return res.json({ ok: true, action: "removed" });
	}

	const { error } = await db.from("rc_user_extensions").upsert(
		{
			id_organization: orgId,
			id_user,
			rc_extension_id,
			rc_extension_number: rc_extension_number ?? null,
			rc_display_name: rc_display_name ?? null,
		},
		{ onConflict: "id_organization,rc_extension_id" }
	);

	if (error) {
		console.error("[RingCentral] /extensions/map error:", error.message);
		return res.status(500).json({ error: "Failed to save mapping." });
	}

	res.json({ ok: true, action: "saved" });
});

// ---------------------------------------------------------------------------
// Webhook — RC calls this; no user auth
// ---------------------------------------------------------------------------
function handleWebhook(req, res) {
	console.log("[RingCentral webhook] Request:", req.method,
		req.method === "POST" ? "(body keys: " + Object.keys(req.body || {}).join(", ") + ")" : "");

	const validationToken =
		req.query.validationToken ||
		req.headers["validation-token"] ||
		(req.body && req.body.validationToken);

	if (validationToken) {
		res.set("Validation-Token", validationToken);
		return res.status(200).send();
	}

	res.status(200).send();

	const body = req.body || {};
	const uuid = body.uuid || body.subscriptionId;
	const event = body.event;

	if (event && body.body) {
		setImmediate(() => {
			console.log("[RingCentral webhook] event:", event, "uuid:", uuid);
			const sessionId = body.body?.telephonySessionId ?? body.body?.sessionId;
			if (sessionId) {
				console.log("[RingCentral webhook] telephonySessionId:", sessionId, "- (call-ended pipeline placeholder)");
			}
		});
	} else if (req.method === "POST" && Object.keys(body).length > 0) {
		setImmediate(() => {
			console.log("[RingCentral webhook] Unrecognized payload:", JSON.stringify(body).slice(0, 300));
		});
	}
}

router.get("/webhook", handleWebhook);
router.post("/webhook", handleWebhook);

export default router;
