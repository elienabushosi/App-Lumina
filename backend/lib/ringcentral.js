// RingCentral SDK client (app-level credentials only; no user/org tokens here)
import { SDK } from "@ringcentral/sdk";

const clientId = process.env.RINGCENTRAL_CLIENT_ID;
const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
const serverUrl =
	process.env.RINGCENTRAL_SERVER_URL || SDK.server.production;

let rcsdk = null;
if (clientId && clientSecret && clientId !== "placeholder" && clientSecret !== "placeholder") {
	rcsdk = new SDK({
		server: serverUrl,
		clientId,
		clientSecret,
	});
}

/**
 * Returns the RingCentral SDK instance configured with app credentials.
 * Use this for OAuth URL generation, token exchange, and API calls (with tokens set per-request or via platform.login).
 * Returns null if RINGCENTRAL_CLIENT_ID or RINGCENTRAL_CLIENT_SECRET are missing or placeholder.
 * @returns {SDK | null}
 */
export function getRingCentralSDK() {
	return rcsdk;
}
