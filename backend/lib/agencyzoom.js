import { getSupabase } from "./supabase.js";

const DEFAULT_ORG_ID = "default";

/**
 * Load AgencyZoom connection row for an organization.
 * @param {string} orgId
 */
export async function loadAgencyZoomConnection(orgId = DEFAULT_ORG_ID) {
  const db = getSupabase();
  const { data, error } = await db
    .from("agencyzoom_connections")
    .select(
      "id_organization, api_key, api_secret, jwt_token, jwt_expires_at"
    )
    .eq("id_organization", orgId)
    .maybeSingle();

  if (error) {
    console.error("[AgencyZoom] load connection error:", error.message);
    throw error;
  }

  return data || null;
}

/**
 * Upsert AgencyZoom connection row.
 * @param {string} orgId
 * @param {{ api_key?: string; api_secret?: string; jwt_token?: string | null; jwt_expires_at?: string | null }} updates
 */
export async function saveAgencyZoomConnection(
  orgId = DEFAULT_ORG_ID,
  updates
) {
  const existing = await loadAgencyZoomConnection(orgId);
  const row = {
    id_organization: orgId,
    api_key: updates.api_key ?? existing?.api_key ?? null,
    api_secret: updates.api_secret ?? existing?.api_secret ?? null,
    jwt_token:
      updates.jwt_token !== undefined ? updates.jwt_token : existing?.jwt_token ?? null,
    jwt_expires_at:
      updates.jwt_expires_at !== undefined
        ? updates.jwt_expires_at
        : existing?.jwt_expires_at ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!row.api_key || !row.api_secret) {
    throw new Error(
      "[AgencyZoom] api_key and api_secret are required to save connection"
    );
  }

  const db = getSupabase();
  const { error } = await db
    .from("agencyzoom_connections")
    .upsert(row, { onConflict: "id_organization" });

  if (error) {
    console.error("[AgencyZoom] save connection error:", error.message);
    throw error;
  }

  return row;
}

function decodeJwtPayload(token) {
  try {
    const [, payloadB64] = String(token).split(".");
    if (!payloadB64) return null;
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtExpiresAtIso(token) {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return new Date(exp * 1000).toISOString();
  }
  return null;
}

/**
 * Call AgencyZoom auth endpoint to exchange username/password for JWT.
 * Based on AgencyZoom OpenAPI: POST /v1/api/auth/login returns { jwt }.
 * Docs: https://app.agencyzoom.com/openapi/
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string; expires_at?: string | null }>}
 */
export async function exchangeCredentialsForJwt(email, password) {
  const baseUrl = process.env.AGENCYZOOM_BASE_URL || "https://api.agencyzoom.com";
  const url = `${baseUrl.replace(/\/$/, "")}/v1/api/auth/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: email,
      password,
      version: "api",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[AgencyZoom] Auth exchange failed:",
      res.status,
      res.statusText,
      text.slice(0, 500)
    );
    throw new Error("Invalid AgencyZoom credentials");
  }

  const json = await res.json();
  const token = json.jwt;

  if (!token) {
    console.error("[AgencyZoom] Auth response missing token field:", json);
    throw new Error("AgencyZoom auth response did not include a token");
  }

  return { token, expires_at: getJwtExpiresAtIso(token) };
}

/**
 * Get a valid JWT for an org, refreshing via key+secret if needed.
 * @param {string} orgId
 */
export async function getAgencyZoomJwt(orgId = DEFAULT_ORG_ID) {
  const conn = await loadAgencyZoomConnection(orgId);
  if (!conn?.api_key || !conn?.api_secret) {
    throw new Error("[AgencyZoom] No stored API key/secret for this organization");
  }

  const now = Date.now();
  if (conn.jwt_token && conn.jwt_expires_at) {
    const exp = new Date(conn.jwt_expires_at).getTime();
    if (exp - now > 60_000) {
      return conn.jwt_token;
    }
  }

  const { token, expires_at } = await exchangeCredentialsForJwt(
    conn.api_key,
    conn.api_secret
  );

  await saveAgencyZoomConnection(orgId, {
    jwt_token: token,
    jwt_expires_at: expires_at,
  });

  return token;
}

/**
 * Verify credentials once and store email/password + JWT for an org.
 * @param {{ email: string; password: string; orgId?: string }} params
 */
export async function connectAgencyZoom({ email, password, orgId }) {
  const effectiveOrgId = orgId || DEFAULT_ORG_ID;

  if (!email || !password) {
    throw new Error("[AgencyZoom] email and password are required");
  }

  const { token, expires_at } = await exchangeCredentialsForJwt(email, password);

  await saveAgencyZoomConnection(effectiveOrgId, {
    api_key: email,
    api_secret: password,
    jwt_token: token,
    jwt_expires_at: expires_at,
  });

  return {
    orgId: effectiveOrgId,
    connected: true,
  };
}

