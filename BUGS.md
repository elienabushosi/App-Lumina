# Bugs

Logged after first customer session with Jake Ridley and CG Insurance (2026-03-28).

---

## AgencyZoom

### B5 — AgencyZoom has no disconnect option
Users cannot sever their AgencyZoom connection from within Lumina. Need a Disconnect button in Settings.

### B14 — AgencyZoom credentials not persisted after OAuth connection ✅ Resolved 2026-03-28
Could not reproduce in production. Credentials are saving correctly for tested accounts.

### B16 — Investigate AgencyZoom leads/list field mapping vs client-side error ✅ Resolved 2026-03-29
Root cause: `statusColor()` called `.toLowerCase()` on AZ's `status` field which is returned as an integer, not a string — `TypeError: e.toLowerCase is not a function` crashed the leads page in production.

Fix: replaced live-fetch leads model with pull-based DB storage. `GET /api/agencyzoom/leads` reads from `agencyzoom_leads` table (zero AZ calls on page load). `POST /api/agencyzoom/leads/pull` fetches from AZ, runs Claude field schema discovery once per org, normalizes all fields (status always coerced to string), and upserts to Supabase. Added `LeadsErrorBoundary` to catch any future render crashes gracefully. Confirmed working in production — leads pulling and displaying correctly for Jake.

### B17 — AgencyZoom API rate limiting (429 Too Many Requests) ✅ Resolved 2026-03-29
Root cause: `/config/all` was firing 5 parallel AZ API calls via `Promise.all` — consuming 1/6 of the 30 calls/minute rate limit in a single click.

Fix: replaced `Promise.all` with sequential calls and 500ms delay between each. Total load time ~2s — imperceptible to users, spreads calls across the rate limit window. Confirmed working locally.

### B18 — Investigate AZ field differences between Jake and CG when posting leads from RC calls
CG Insurance's AZ account returns the same field schema as Jake's. Need to verify whether the lead creation payload (POST from RC call extraction) maps correctly to both accounts, and whether any required fields differ between orgs (e.g. `locationCode`, `workflowId`, `assignedTo`, `csrId`). A mismatch could silently drop or misroute leads when RC calls are pushed to AZ.

CG's confirmed AZ field list:
`id`, `firstname`, `lastname`, `middlename`, `leadType`, `email`, `phone`, `secondaryEmail`, `secondaryPhone`, `streetAddress`, `city`, `state`, `country`, `zip`, `comments`, `status`, `contactDate`, `soldDate`, `leadSourceId`, `leadSourceName`, `xDate`, `quoteDate`, `createDate`, `premium`, `quoted`, `assignedTo`, `assignToFirstname`, `assignToLastname`, `csrId`, `csrFirstname`, `csrLastname`, `creditToFirstname`, `creditToLastname`, `taskCount`, `contactFirstName`, `contactLastName`, `locationCode`, `locationName`, `departmentCode`, `departmentName`, `groupCode`, `groupName`, `workflowId`, `workflowName`, `workflowStageId`, `workflowStageName`, `lastActivityDate`, `enterStageDate`, `tagNames`, `convertedHouseholdId`, `nextExpirationDate`, `externalSystem`, `externalId`

### B19 — AZ config wizard spinner never resolves for CG Insurance ✅ Resolved 2026-03-29
Root cause: B17 rate limiting caused `/config/all` to fail silently — the UI never exited the loading state on error.

Fix: B17 serialization fix prevents the 429s. Additionally added a clear error message when the config load fails: "Could not load AgencyZoom config. Try again. If the issue persists, try reconnecting with an admin account." Users are no longer stuck on an infinite spinner.

### B20 — Investigate whether AZ restricts OAuth to admin accounts only
CG is experiencing AZ login/connection issues that Jake (likely the account admin) does not. Need to check AgencyZoom's API documentation to determine if OAuth access is restricted to admin-level accounts, or if there are permission tiers that affect what a non-admin user can do via the API. If true, Lumina may need to use a single org-level AZ connection (admin's credentials) rather than per-user connections.

### B24 — RingCentral webhook subscription fails after OAuth connect
After successful OAuth, the backend attempts to create a RC webhook subscription but throws `ReferenceError: platform is not defined`. The subscription is never created, meaning Lumina won't receive real-time call events via webhook — it falls back to the call log poller only.

Log: `🔴 [RingCentral] Subscription create error: platform is not defined`

---

## RingCentral

### B1 — RingCentral connection fails outside incognito mode
RingCentral OAuth connect works in incognito but fails in a normal browser session. Likely a stale cookie or cached token conflict. Investigate what differs between incognito and normal mode.

### B2 — RingCentral connection failure for CG Insurance + PSTN call error
Cintya Garza (CG Insurance) could not authorize RingCentral.

**What happened:**
1. CG reached the RC OAuth login page (`login.ringcentral.com/?responseType=code&clientId=eL07C8712qLbOt1tK531tr&brandId=12100&state=c9511880-fc7d-4cd8-9e83-96cc8b931b6b...`)
2. A RingCentral notification appeared: *"You cannot use this device to make PSTN calls including Emergency Calls since no Digital Line is associated."*
3. She clicked "Ok, got it" — page started loading and never completed. OAuth callback never returned to Lumina.

**Railway logs at time of attempt:**
```
PGRST205: Could not find the table 'public.subscriptions' in the schema cache
Hint: Perhaps you meant the table 'public.rc_user_extensions'
```
Note: the `subscriptions` error is a pre-existing noise log (B15) — not the cause of the RC failure.

**What we know:**
- The PSTN notification is a RingCentral account configuration issue — CG's device has no Digital Line associated in their RC account. This is not a Lumina code problem.
- The notification interrupting the OAuth flow may have prevented the callback from completing, leaving the page stuck loading.

**Open questions:**
- Does the PSTN notification block the OAuth flow in RC, or does it just display as a warning that can be dismissed?
- Does CG have a Digital Line assigned in their RingCentral admin console?
- Is this a CG account setup issue that needs to be resolved on the RC side before Lumina can connect?

**Next step:** Ask CG to check their RingCentral admin console and verify a Digital Line is assigned to their account. If not, that needs to be set up in RC before OAuth will work.

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
