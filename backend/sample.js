/**
 * RingCentral demo — uses the app that’s created when you onboard (no new app).
 * Proves the connection works by fetching your extension info (no RingOut needed).
 *
 * Set in .env.development: RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT_TOKEN
 * Optional: RINGCENTRAL_SERVER_URL (e.g. https://platform.devtest.ringcentral.com for sandbox)
 *
 * Run from backend: node sample.js
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { SDK } from "@ringcentral/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env.NODE_ENV || "development";
dotenv.config({ path: join(__dirname, `.env.${nodeEnv}`) });
dotenv.config({ path: join(__dirname, ".env"), override: false });

const SERVER_URL =
	process.env.RINGCENTRAL_SERVER_URL || "https://platform.ringcentral.com";
const CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID;
const CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET;
const JWT_TOKEN = process.env.RINGCENTRAL_JWT_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !JWT_TOKEN) {
	console.error(
		"Missing credentials. Set in backend/.env.development:\n  RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT_TOKEN"
	);
	process.exit(1);
}

const rcsdk = new SDK({
	server: SERVER_URL,
	clientId: CLIENT_ID,
	clientSecret: CLIENT_SECRET,
});

const platform = rcsdk.platform();

platform.login({
	jwt: JWT_TOKEN,
});

platform.on(platform.events.loginSuccess, () => {
	runDemo();
});

platform.on(platform.events.loginError, (e) => {
	console.error("Login failed:", e.message);
	process.exit(1);
});

async function runDemo() {
	try {
		const resp = await platform.get("/restapi/v1.0/account/~/extension/~");
		const ext = await resp.json();
		console.log("Demo OK — RingCentral API is working.");
		console.log("Extension:", ext.extensionNumber || ext.id, "| Name:", ext.name || "(n/a)");
	} catch (e) {
		console.error("API call failed:", e.message);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}
