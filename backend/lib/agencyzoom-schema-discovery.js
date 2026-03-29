/**
 * AgencyZoom Field Schema Discovery
 *
 * When leads/list returns fields we haven't seen before for an org,
 * this module sends them to Claude to map to Lumina's standard schema.
 * The result is stored in agencyzoom_field_schemas keyed by id_organization.
 *
 * Lumina's preset normalized fields (what the frontend and agents always see):
 *   id, firstName, lastName, email, phone, status, leadSource,
 *   streetAddress, city, state, zip, lastStageDate, assignedTo, locationCode, workflowId
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_SCHEMA });

// Lumina's standard schema — these are the only field names the frontend
// and downstream agents ever work with.
const STANDARD_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "status",
  "leadSource",
  "streetAddress",
  "city",
  "state",
  "zip",
  "lastStageDate",
  "assignedTo",
  "locationCode",
  "workflowId",
];

/**
 * Load stored schema for an org. Returns null if not yet discovered.
 */
export async function loadSchema(orgId) {
  const db = getSupabase();
  const { data } = await db
    .from("agencyzoom_field_schemas")
    .select("*")
    .eq("id_organization", orgId)
    .maybeSingle();
  if (data) {
    console.log(`[AZ Schema] Loaded cached schema for org: ${orgId}, fields: ${(data.raw_fields || []).length}`);
  } else {
    console.log(`[AZ Schema] No cached schema found for org: ${orgId} — will run discovery`);
  }
  return data || null;
}

/**
 * Check if the raw fields from a new AZ response contain any fields
 * not yet in the stored schema. Returns true if discovery should run.
 */
export function hasNewFields(rawFieldNames, storedRawFields) {
  const stored = new Set(storedRawFields || []);
  return rawFieldNames.some((f) => !stored.has(f));
}

/**
 * Run Claude schema discovery for an org.
 * Sends raw field names + sample values, gets back field_map, display_config, downstream_map.
 * Upserts result into agencyzoom_field_schemas.
 */
export async function discoverSchema(orgId, sampleLead) {
  const rawFieldNames = Object.keys(sampleLead);
  const sampleValues = Object.fromEntries(
    rawFieldNames.map((k) => [k, sampleLead[k]])
  );

  console.log(`[AZ Schema] Running discovery for org: ${orgId}, fields: ${rawFieldNames.length}`);

  const prompt = `You are mapping AgencyZoom API field names to Lumina's standard lead schema.

Lumina's standard fields (normalized names the app always uses):
${STANDARD_FIELDS.map((f) => `- ${f}`).join("\n")}

Raw fields returned by this agency's AgencyZoom account, with sample values:
${JSON.stringify(sampleValues, null, 2)}

For each raw field, return a JSON object with these keys:
- "field_map": object mapping each raw field name to a Lumina standard field name, or null if it doesn't match any standard field
- "display_config": object mapping each Lumina standard field name to { "label": string, "type": "string"|"date"|"number"|"boolean", "visible_in_table": boolean, "order": number }
- "downstream_map": object mapping each Lumina standard field name to { "research": string|null, "apex": string|null }
  - research: the key this field maps to in the research agent input (address.street, contact.firstName, etc.) or null
  - apex: the key this field maps to in the APEX browser agent input or null

Rules:
- Map semantically — "enterStageDate", "lastEnterStageDate", "stageDate" all map to "lastStageDate"
- "firstname", "first_name", "firstName" all map to "firstName"
- "leadSourceName", "source", "leadSource" all map to "leadSource"
- status may be a string or integer — always map to "status"
- If a raw field has no match in the standard schema, map it to null in field_map
- visible_in_table should be true for: firstName, lastName, status, leadSource, streetAddress, phone, email, lastStageDate
- order should reflect a sensible left-to-right column order starting at 1

Return ONLY valid JSON. No explanation, no markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  let result;
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip markdown code fences if Claude wrapped the response (e.g. ```json ... ```)
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    console.log("[AZ Schema] Claude raw response length:", raw.length, "first 100 chars:", raw.slice(0, 100));
    result = JSON.parse(text);
  } catch (e) {
    console.error("[AZ Schema] Failed to parse Claude response:", e.message);
    throw new Error("Schema discovery failed: could not parse Claude response");
  }

  const { field_map, display_config, downstream_map } = result;

  const db = getSupabase();
  await db.from("agencyzoom_field_schemas").upsert(
    {
      id_organization: orgId,
      raw_fields: rawFieldNames,
      field_map: field_map ?? {},
      display_config: display_config ?? {},
      downstream_map: downstream_map ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id_organization" }
  );

  console.log(`[AZ Schema] Discovery complete for org: ${orgId}`);
  return { field_map, display_config, downstream_map };
}
