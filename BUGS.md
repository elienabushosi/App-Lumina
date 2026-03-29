# Bugs

Logged after first customer session with Jake Ridley and CG Insurance (2026-03-28).

---

## AgencyZoom

### B5 — AgencyZoom has no disconnect option
Users cannot sever their AgencyZoom connection from within Lumina. Need a Disconnect button in Settings.

### B14 — AgencyZoom credentials not persisted after OAuth connection ✅ Resolved 2026-03-28
Could not reproduce in production. Credentials are saving correctly for tested accounts.

### B16 — Investigate AgencyZoom leads/list field mapping vs client-side error ✅ Resolved 2026-03-29
Railway logs show the AZ leads/list endpoint successfully returning leads with the correct field names (all lowercase: `firstname`, `lastname`, `leadSourceName`, etc.). Jake confirmed the fields look correct. However the frontend still throws a client-side error when clicking Leads. Need to determine if the field mapping mismatch between what AZ returns and what the frontend expects is the cause, or if B14 (credentials not persisted) is the only root cause. Not a red log — just needs investigation.

AZ confirmed field names: `id`, `firstname`, `lastname`, `email`, `phone`, `streetAddress`, `city`, `state`, `zip`, `status`, `leadSourceName`, `createDate`, `enterStageDate`, `assignedTo`, `leadType`, etc.

### B17 — AgencyZoom API rate limiting (429 Too Many Requests)
The `/config/all` endpoint makes parallel calls to multiple AZ API endpoints (pipelines-and-stages, custom-fields, locations, etc.) and is hitting 429 rate limits.

**AZ rate limit confirmed (from their OpenAPI docs, as of 2023-11-21):** 30 calls/minute during the day, 60 calls/minute from 10PM–4AM CT.

**Root cause:** `/config/all` fires 5 parallel calls in a single click = 1/6 of the entire minute budget gone instantly. If the wizard retries (current behaviour adds 1 retry on 429), that's 10 calls from one click.

**Fix:** Serialize the 5 `/config/all` calls with ~300ms delay between each instead of `Promise.all`. 5 sequential calls ≈ 1.5s total — imperceptible to the user and spreads load across the minute.

Sample log:
```
[AgencyZoom] /config/all fetch failed: /v1/api/pipelines-and-stages → 429 Too Many Requests
[AgencyZoom] /config/all fetch failed: /v1/api/custom-fields → 429 Too Many Requests
[AgencyZoom] /config/all fetch failed: /v1/api/locations → 429 Too Many Requests
```

### B18 — Investigate AZ field differences between Jake and CG when posting leads from RC calls
CG Insurance's AZ account returns the same field schema as Jake's. Need to verify whether the lead creation payload (POST from RC call extraction) maps correctly to both accounts, and whether any required fields differ between orgs (e.g. `locationCode`, `workflowId`, `assignedTo`, `csrId`). A mismatch could silently drop or misroute leads when RC calls are pushed to AZ.

CG's confirmed AZ field list:
`id`, `firstname`, `lastname`, `middlename`, `leadType`, `email`, `phone`, `secondaryEmail`, `secondaryPhone`, `streetAddress`, `city`, `state`, `country`, `zip`, `comments`, `status`, `contactDate`, `soldDate`, `leadSourceId`, `leadSourceName`, `xDate`, `quoteDate`, `createDate`, `premium`, `quoted`, `assignedTo`, `assignToFirstname`, `assignToLastname`, `csrId`, `csrFirstname`, `csrLastname`, `creditToFirstname`, `creditToLastname`, `taskCount`, `contactFirstName`, `contactLastName`, `locationCode`, `locationName`, `departmentCode`, `departmentName`, `groupCode`, `groupName`, `workflowId`, `workflowName`, `workflowStageId`, `workflowStageName`, `lastActivityDate`, `enterStageDate`, `tagNames`, `convertedHouseholdId`, `nextExpirationDate`, `externalSystem`, `externalId`

### B19 — AZ config wizard spinner never resolves for CG Insurance
When CG clicks "Configure AgencyZoom" in Settings, the button spins indefinitely and the wizard never displays the lead options (pipeline, stage, lead source, etc.). Likely related to B17 (429 rate limiting on the /config/all endpoint hitting AZ API too aggressively). The config fetch fails silently and the UI never transitions out of the loading state.

### B20 — Investigate whether AZ restricts OAuth to admin accounts only
CG is experiencing AZ login/connection issues that Jake (likely the account admin) does not. Need to check AgencyZoom's API documentation to determine if OAuth access is restricted to admin-level accounts, or if there are permission tiers that affect what a non-admin user can do via the API. If true, Lumina may need to use a single org-level AZ connection (admin's credentials) rather than per-user connections.

---

## RingCentral

### B1 — RingCentral connection fails outside incognito mode
RingCentral OAuth connect works in incognito but fails in a normal browser session. Likely a stale cookie or cached token conflict. Investigate what differs between incognito and normal mode.

### B2 — RingCentral connection failure for CG Insurance
Cintya Garza (CG Insurance) could not authorize RingCentral. Check Railway logs for her OAuth attempt and identify the specific error.

### B8 — PSTN call error in RingCentral
An error message referencing "PSTN call" appears in RingCentral. Determine what it means and whether it affects call recording/transcription in Lumina.

### B9 — Ricochet phone system not integrated
Some agents use Ricochet instead of RingCentral. Need to determine if Ricochet allows third-party access and whether Lumina can support it.

### B12 — No way to track agency main office phone number
Lumina has no field to store or display each agency's main office phone number. Determine where this belongs and implement it.

---

## Research Agent

### B3 — Address lookup fails for specific addresses
2 specific addresses do not appear in the research agent address lookup. Determine if it's an ATTOM API, Google Maps autocomplete, or geocoding failure. Get the failing addresses from the customers.

### B6 — Editable property fields appear too early in research flow
Editable fields for property data should only appear on the READY_360 final review page. Earlier steps (DATA_PULLED, DATA_GATHERED) should be read-only.

### B7 — Exterior wall and foundation missing when CAD data unavailable
If ATTOM doesn't return exterior wall type or foundation type, the field shows "—" with no fallback. Should fall back to Zillow/RealtyAPI data first.

### B13 — AI image analysis missing foundation and exterior wall detection
The Google Maps image analysis step does not detect foundation type or exterior wall material. Need Gemini vision to identify these and include them in the research report.

### B21 — Poor error handling when address not found in ATTOM
When a user enters an address that ATTOM doesn't have in its database, the research agent fails silently or shows a generic error. Need better messaging to explain why the lookup failed, and consider offering a fallback option to proceed with Google Maps data only (skipping CAD entirely) so the user isn't completely blocked.

### B22 — Research review page shows empty fields when data exists in another source
If CAD (ATTOM) is missing a field (e.g. foundation type, exterior wall) but Zillow or Google Maps has it, the review page still shows "—" for that field. Need a reconciliation layer that merges all available data sources before presenting the review page.

Proposed approach: after all research steps complete, pass the combined raw data (CAD + Zillow + Maps) to Claude/Gemini and ask it to reconcile into a single clean research report — filling each field from whichever source has it, with a confidence note if sources conflict. That reconciled output becomes what the user sees on the READY_360 review page, which they can then edit manually before sending to APEX. This gives the user the cleanest possible data Lumina can provide rather than showing gaps that a different source already answered.

### B23 — No image date shown for Zillow/Realty photos in research report
The photo carousel on the research page shows listing images from Zillow/RealtyAPI but gives the user no indication of when those photos were taken or posted. If the listing is old, the images may not reflect the current state of the property, leading to inaccurate AI analysis. Need to pull the listing date or photo date from the RealtyAPI response and display it alongside the photos so the user knows how fresh the images are.

---

## APEX / Proposal Pipeline

### B10 — MFA blocks APEX automation
Salesforce MFA interrupts the APEX browser agent flow, requiring human intervention every session. Need a game plan to reduce or eliminate this friction (trusted device, session persistence, Browserbase contexts).

### B11 — No 8-hour session limit for saved Salesforce credentials
Salesforce credentials are remembered indefinitely. Should default to 8 hours or provide a toggle for how long credentials are retained.

---

## General / App

### B4 — "Luminina" spelling error in browser tab ✅ Fixed 2026-03-28
The browser/app tab shows "Luminina" instead of "Lumina". Fixed in Next.js metadata.

### B15 — Missing `subscriptions` table causes repeated 500 errors ✅ Fixed 2026-03-28
Railway logs show `PGRST205: Could not find the table 'public.subscriptions'` repeatedly. The billing/subscription status route is querying a `subscriptions` table that doesn't exist in Supabase. Fixed by silencing PGRST205 and returning a graceful `{ plan: "free", status: "not_configured" }` response.
