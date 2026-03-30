// Backend server entry point

import express from "express";
import cors from "cors";
import { supabase } from "./lib/supabase.js";
import authRoutes from "./routes/auth.js";
import billingRoutes from "./routes/billing.js";
import emailRoutes from "./routes/email.js";
import ringcentralRoutes from "./routes/ringcentral.js";
import callsRoutes from "./routes/calls.js";
import agencyzoomRoutes from "./routes/agencyzoom.js";
import propertyRoutes from "./routes/property.js";
import researchReportsRoutes from "./routes/research-reports.js";
import { startCallLogPoller } from "./lib/ringcentral-call-log-poller.js";
import { startProposalWorker } from "./src/workers/proposal.worker.js";
import { closeBrowser } from "./src/agents/browser.js";
import proposalRoutes from "./src/routes/proposals.js";
import triggerRoutes from "./src/routes/triggers.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
	if (req.method === "OPTIONS") {
		return res.status(204).end();
	}
	next();
});

// Stripe webhook needs raw body for signature verification
// Apply raw body parser only to webhook endpoint, before JSON parser
app.use(
	"/api/billing/webhook",
	express.raw({ type: "application/json" })
);

// JSON body parser for all other routes (skip webhook which uses raw body)
app.use((req, res, next) => {
	if (req.path === "/api/billing/webhook") {
		return next(); // Skip JSON parsing for webhook
	}
	express.json()(req, res, next);
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/ringcentral", ringcentralRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/agencyzoom", agencyzoomRoutes);
app.use("/api/property", propertyRoutes);
app.use("/api/research-reports", researchReportsRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/triggers", triggerRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", message: "Backend is running" });
});

// Test Supabase connection
app.get("/api/test-supabase", async (req, res) => {
	try {
		// Simple connection test - just verify the client is configured
		const { data, error } = await supabase.auth.getSession();

		// Even if there's no session, if we get here without a connection error, Supabase is working
		res.json({
			status: "ok",
			message: "Successfully connected to Supabase",
			connected: true,
			url:
				process.env.SUPABASE_URL ||
				"https://navarlhgtpvdgutcsfhj.supabase.co",
		});
	} catch (error) {
		console.error("Supabase test error:", error);
		res.status(500).json({
			status: "error",
			message: "Error testing Supabase connection",
			error: error.message,
		});
	}
});

app.listen(PORT, () => {
	console.log(`🚀 Backend server running on http://localhost:${PORT}`);
	console.log("🟢 Supabase client initialized");
	startCallLogPoller();
	startProposalWorker();
});

async function shutdown() {
	console.log("Shutting down...");
	await closeBrowser();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
