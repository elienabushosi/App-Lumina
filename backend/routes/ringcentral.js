/**
 * RingCentral OAuth + webhook (no DB yet — tokens stored in file keyed by "default").
 * GET  /api/ringcentral/auth     -> redirect to RingCentral authorize
 * GET  /api/ringcentral/callback -> exchange code, store tokens, create subscription, redirect to frontend
 * GET  /api/ringcentral/status   -> { connected: boolean } for UI
 * GET  /api/ringcentral/webhook  -> validation (return Validation-Token header)
 * POST /api/ringcentral/webhook  -> call-ended events (respond 200, process async)
 */
import express from "express";
import { getRingCentralSDK } from "../lib/ringcentral.js";
import {
	getRingCentralTokens,
	setRingCentralTokens,
	setRingCentralSubscriptionId,
} from "../lib/ringcentral-token-store.js";

const router = express.Router();
const STATE_KEY = "default";
// statusCode=Disconnected fires when a call ends; CallControl permission required in app
const TELEPHONY_SESSIONS_FILTER = "/restapi/v1.0/account/~/telephony/sessions?statusCode=Disconnected";

router.get("/status", async (req, res) => {
	const tokens = await getRingCentralTokens(STATE_KEY);
	res.json({ connected: !!(tokens && tokens.access_token) });
});

router.get("/auth", (req, res) => {
	const sdk = getRingCentralSDK();
	const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;
	const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

	if (!sdk || !redirectUri) {
		return res.status(500).json({
			error: "RingCentral not configured",
			detail: !sdk ? "Missing RINGCENTRAL_CLIENT_ID/SECRET" : "Missing RINGCENTRAL_REDIRECT_URI",
		});
	}

	const platform = sdk.platform();
	const authUrl = platform.loginUrl({
		redirectUri,
		state: STATE_KEY,
	});
	res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
	const sdk = getRingCentralSDK();
	const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;
	const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

	if (!sdk || !redirectUri) {
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=not_configured`);
	}

	const { code, state } = req.query;
	if (!code) {
		return res.redirect(`${frontendUrl}/settings?ringcentral=error&message=no_code`);
	}

	console.log("[RingCentral] Callback hit, exchanging code for tokens...");
	const platform = sdk.platform();
	try {
		await platform.login({
			code,
			redirect_uri: redirectUri,
		});
		const authData = await platform.auth().data();
		const key = state || STATE_KEY;
		await setRingCentralTokens(key, {
			access_token: authData.access_token,
			refresh_token: authData.refresh_token,
			expire_time: authData.expire_time,
			expires_in: authData.expires_in,
		});
		console.log("[RingCentral] Tokens stored for key:", key);

		// Create webhook subscription if URL is configured (e.g. ngrok)
		const webhookUrl = process.env.RINGCENTRAL_WEBHOOK_URL;
		if (webhookUrl) {
			try {
				const subRes = await platform.post("/restapi/v1.0/subscription", {
					eventFilters: [TELEPHONY_SESSIONS_FILTER],
					deliveryMode: {
						transportType: "WebHook",
						address: webhookUrl,
					},
					expiresIn: 604800, // 7 days
				});
				const subJson = await subRes.json();
				if (subJson.id) {
					await setRingCentralSubscriptionId(key, subJson.id);
					console.log("[RingCentral] Webhook subscription created:", subJson.id);
				} else {
					console.warn("[RingCentral] Subscription response missing id:", subJson);
				}
			} catch (subErr) {
				console.error("[RingCentral] Subscription create error:", subErr.message);
				// Don't fail the callback; tokens are stored, user can retry subscription later
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

// --- Webhook: validation (GET/POST) and events (POST) ---
function handleWebhook(req, res) {
	// Log every request so we can see if RingCentral is hitting us
	console.log("[RingCentral webhook] Request:", req.method, req.method === "POST" ? "(body keys: " + Object.keys(req.body || {}).join(", ") + ")" : "");

	const validationToken =
		req.query.validationToken ||
		req.headers["validation-token"] ||
		(req.body && req.body.validationToken);

	if (validationToken) {
		res.set("Validation-Token", validationToken);
		return res.status(200).send();
	}

	// Event payload: respond 200 immediately, process async
	res.status(200).send();

	const body = req.body || {};
	const uuid = body.uuid || body.subscriptionId;
	const event = body.event;

	// Telephony session event (e.g. call ended)
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
