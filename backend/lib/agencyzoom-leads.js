import { getAgencyZoomJwt, loadAgencyZoomConnection } from "./agencyzoom.js";
import { getSupabase } from "./supabase.js";

const AGENCYZOOM_BASE_URL =
	process.env.AGENCYZOOM_BASE_URL || "https://api.agencyzoom.com";

/**
 * Lead custom field IDs from /api/agencyzoom/config/custom-fields (use the "fieldName" value for entityType "lead").
 * Override via env if your org uses different IDs.
 */
function getLeadCustomFieldIds() {
	return {
		roofYear:
			process.env.AGENCYZOOM_CUSTOM_FIELD_ID_ROOF_YEAR || "cf54741",
		roofType:
			process.env.AGENCYZOOM_CUSTOM_FIELD_ID_ROOF_TYPE || "cf54743",
		flooringTypes:
			process.env.AGENCYZOOM_CUSTOM_FIELD_ID_FLOORING_TYPES || "cf54745",
		numberOfBathrooms:
			process.env.AGENCYZOOM_CUSTOM_FIELD_ID_NUMBER_OF_BATHROOMS || "cf54747",
		occupationDegree:
			process.env.AGENCYZOOM_CUSTOM_FIELD_ID_OCCUPATION_DEGREE || "cf54749",
	};
}

/**
 * Read org-level AgencyZoom config (IDs, location codes, etc.).
 * For now this is driven by env vars; later we can move to per-org config in DB.
 * Lead Source and Primary CSR must be valid IDs in your AgencyZoom org.
 */
function getAgencyZoomLeadConfig(orgId) {
	const cfg = {
		leadSourceId: Number(process.env.AGENCYZOOM_LEAD_SOURCE_ID || "0") || null,
		pipelineId: Number(process.env.AGENCYZOOM_PIPELINE_ID || "0") || null,
		stageId: Number(process.env.AGENCYZOOM_STAGE_ID || "0") || null,
		assignTo: Number(process.env.AGENCYZOOM_PRIMARY_PRODUCER_ID || "0") || null,
		csrId:
			process.env.AGENCYZOOM_PRIMARY_CSR_ID !== undefined &&
			process.env.AGENCYZOOM_PRIMARY_CSR_ID !== ""
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
	const property = lead.property || {};

	// AgencyZoom expects custom field ID (e.g. cf54741) as fieldName, not the label. Get IDs from /api/agencyzoom/config/custom-fields (entityType "lead").
	const ids = getLeadCustomFieldIds();
	const customFields = [];
	function addCustomField(fieldId, value) {
		if (value != null && value !== "" && fieldId) {
			customFields.push({
				fieldName: fieldId,
				fieldValue: String(value),
			});
		}
	}
	addCustomField(ids.roofYear, property.roof_year);
	addCustomField(ids.roofType, property.roof_type);
	addCustomField(ids.flooringTypes, property.flooring_types);
	addCustomField(ids.numberOfBathrooms, property.number_of_bathrooms);
	addCustomField(ids.occupationDegree, lead.occupation_degree);

	// maritalStatus: API expects integer (e.g. 1=Single, 2=Married). Map our string or leave unset.
	const maritalStatusMap = {
		Single: 1,
		Married: 2,
		Widowed: 3,
		Separated: 4,
		Divorced: 5,
		"Domestic Partner": 6,
	};
	const maritalStatusId =
		lead.marital_status && maritalStatusMap[lead.marital_status];

	// birthday: API expects MM/DD/YY. Pass through if already in a compatible format, else leave for custom field if needed.
	let birthday = lead.date_of_birth ?? null;
	if (birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
		const [y, m, d] = birthday.split("-");
		birthday = `${m}/${d}/${y.slice(-2)}`;
	}

	// API expects leadSourceId (integer) and assignTo (string ID); include csrId when set.
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
		assignTo: String(cfg.assignTo),
		...(cfg.csrId != null && { csrId: cfg.csrId }),
		streetAddress: address.street || null,
		streetAddressLine2: null,
		city: address.city || null,
		state: address.state || null,
		country: cfg.country,
		zip: address.postal_code || null,
		agencyNumber: cfg.agencyNumber,
		departmentCode: null,
		groupCode: null,
		birthday: birthday || undefined,
		maritalStatus: maritalStatusId ?? undefined,
		customFields: customFields.length ? customFields : undefined,
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
	if (process.env.NODE_ENV === "development") {
		console.log("[AgencyZoom] Lead create request (sanitized):", {
			leadSourceId: body.leadSourceId,
			csrId: body.csrId,
			assignTo: body.assignTo,
			customFieldsCount: body.customFields?.length ?? 0,
			customFields: body.customFields,
		});
	}
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

