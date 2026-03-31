// RingCentral SDK client (app-level credentials only; no user/org tokens here)
import { SDK } from "@ringcentral/sdk";

const clientId = process.env.RINGCENTRAL_CLIENT_ID;
const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
const serverUrl =
	process.env.RINGCENTRAL_SERVER_URL || SDK.server.production;

const appCredentialsValid =
	clientId && clientSecret && clientId !== "placeholder" && clientSecret !== "placeholder";

// Singleton used only for OAuth URL generation and token exchange (no per-org state).
let rcsdk = null;
if (appCredentialsValid) {
	rcsdk = new SDK({ server: serverUrl, clientId, clientSecret });
}

/**
 * Returns the shared RingCentral SDK instance.
 * Use ONLY for OAuth URL generation and token exchange — never call platform() on this
 * for per-org polling, because sdk.platform() is a singleton and would be shared across orgs.
 * @returns {SDK | null}
 */
export function getRingCentralSDK() {
	return rcsdk;
}

/**
 * Creates a fresh SDK instance for one org so its platform() is fully independent.
 * Call this in initPlatform — never reuse across orgs.
 * @returns {SDK | null}
 */
export function createRingCentralSDKForOrg() {
	if (!appCredentialsValid) return null;
	return new SDK({ server: serverUrl, clientId, clientSecret });
}
