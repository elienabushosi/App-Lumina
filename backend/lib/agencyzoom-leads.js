import { getAgencyZoomJwt, loadAgencyZoomConnection } from "./agencyzoom.js";
import { getSupabase } from "./supabase.js";

const AGENCYZOOM_BASE_URL =
	process.env.AGENCYZOOM_BASE_URL || "https://api.agencyzoom.com";

/**
 * Read org-level AgencyZoom config (IDs, location codes, etc.).
 * For now this is driven by env vars; later we can move to per-org config in DB.
 */
function getAgencyZoomLeadConfig(orgId) {
	const cfg = {
		leadSourceId: Number(process.env.AGENCYZOOM_LEAD_SOURCE_ID || "0") || null,
		pipelineId: Number(process.env.AGENCYZOOM_PIPELINE_ID || "0") || null,
		stageId: Number(process.env.AGENCYZOOM_STAGE_ID || "0") || null,
		assignTo: Number(process.env.AGENCYZOOM_PRIMARY_PRODUCER_ID || "0") || null,
		csrId:
			process.env.AGENCYZOOM_PRIMARY_CSR_ID !== undefined
				? Number(process.env.AGENCYZOOM_PRIMARY_CSR_ID || "0") || null
				: null,
		agencyNumber: process.env.AGENCYZOOM_LOCATION_CODE || null,
		country: process.env.AGENCYZOOM_COUNTRY || "US",
	};

	if (
		!cfg.leadSourceId ||
		!cfg.pipelineId ||
		!cfg.stageId ||
		!cfg.assignTo ||
		!cfg.agencyNumber
	) {
		throw new Error(
			"[AgencyZoom] Missing required lead config env vars. Set AGENCYZOOM_LEAD_SOURCE_ID, AGENCYZOOM_PIPELINE_ID, AGENCYZOOM_STAGE_ID, AGENCYZOOM_PRIMARY_PRODUCER_ID, AGENCYZOOM_LOCATION_CODE."
		);
	}

	return cfg;
}

function splitName(fullName) {
	if (!fullName || typeof fullName !== "string") {
		return { first: null, last: null };
	}
	const parts = fullName.trim().split(/\s+/);
	if (parts.length === 1) {
		return { first: parts[0], last: null };
	}
	return {
		first: parts[0],
		last: parts.slice(1).join(" "),
	};
}

/**
 * Map our Claude lead JSON into AgencyZoom LeadDataRequest.
 * @param {*} leadPayload - value from call_recordings.lead_payload
 * @param {string} orgId
 */
export function buildLeadDataRequest(leadPayload, orgId) {
	if (!leadPayload || typeof leadPayload !== "object") {
		throw new Error("[AgencyZoom] Missing lead payload");
	}
	const lead = leadPayload.lead || {};

	// Skip if Claude said it's not a lead.
	if (lead.status && lead.status === "not_a_lead") {
		throw new Error("[AgencyZoom] Payload marked as not_a_lead; skipping create");
	}

	const cfg = getAgencyZoomLeadConfig(orgId);

	const name = lead.name || {};
	let first = name.first || null;
	let last = name.last || null;
	if (!first || (!last && name.full)) {
		const split = splitName(name.full);
		first = first || split.first;
		last = last || split.last;
	}

	const contact = lead.contact || {};
	const address = lead.address || {};
	const notes = lead.notes || {};

	const body = {
		firstname: first || "Unknown",
		lastname: last || "",
		email: contact.email || "unknown@example.com",
		phone: contact.primary_phone || null,
		secondaryEmail: contact.alternate_email || null,
		secondaryPhone: contact.alternate_phone || null,
		notes: notes.summary || null,
		pipelineId: cfg.pipelineId,
		stageId: cfg.stageId,
		leadSourceId: cfg.leadSourceId,
		assignTo: cfg.assignTo,
		csrId: cfg.csrId || undefined,
		streetAddress: address.street || null,
		streetAddressLine2: null,
		city: address.city || null,
		state: address.state || null,
		country: cfg.country,
		zip: address.postal_code || null,
		agencyNumber: cfg.agencyNumber,
		departmentCode: null,
		groupCode: null,
		// customFields, tagNames etc can be added later when we know exact IDs/codes.
	};

	return body;
}

/**
 * Create a lead in AgencyZoom for a given call_recordings row.
 * Expects the row to already have lead_payload from Claude.
 * @param {{ id: string, id_organization: string, ringcentral_call_id: string | null, lead_payload: any }} callRow
 */
export async function createAgencyZoomLeadForCall(callRow) {
	const orgId = callRow.id_organization || "default";
	const jwt = await getAgencyZoomJwt(orgId);
	const body = buildLeadDataRequest(callRow.lead_payload, orgId);

	const url = `${AGENCYZOOM_BASE_URL.replace(/\/$/, "")}/v1/api/leads/create`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	const text = await res.text();
	if (!res.ok) {
		console.error("[AgencyZoom] Create lead failed:", res.status, text.slice(0, 500));
		throw new Error(
			`AgencyZoom lead create failed: ${res.status} ${res.statusText}`
		);
	}

	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}

	console.log("[AgencyZoom] Lead created for call:", callRow.ringcentral_call_id, {
		status: res.status,
		response: json,
	});

	// Update DB to mark that this call has an AgencyZoom lead.
	const db = getSupabase();
	await db
		.from("call_recordings")
		.update({
			lead_status: "pushed",
			lead_error: null,
			updated_at: new Date().toISOString(),
		})
		.eq("id", callRow.id);

	return json;
}

