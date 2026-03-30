# Research: B17 + B19 + B20 — AgencyZoom Config Wizard Failures

**Status:** Investigation complete — ready for fix proposal
**Date:** 2026-03-29
**Bugs covered:** B17 (429 rate limiting), B19 (spinner never resolves for CG), B20 (admin-only OAuth investigation)

---

## Summary

Three related bugs all point to the same root area: the `/config/all` endpoint that powers the AgencyZoom setup wizard in Settings. CG Insurance cannot get past the spinner. Jake Ridley can (mostly). The investigation below separates confirmed facts from assumptions.

---

## What We Know — Confirmed Facts

### Rate Limiting (B17)
- **AZ rate limit:** 30 calls/minute during the day, 60 calls/minute from 10PM–4AM CT
- **Source:** Official AgencyZoom OpenAPI spec — https://app.agencyzoom.com/openapi/agencyzoom.yaml (as of 2023-11-21)
- **Our `/config/all` behavior:** Fires 5 parallel API calls in a single click (`Promise.all`):
  - `/v1/api/custom-fields`
  - `/v1/api/pipelines-and-stages`
  - `/v1/api/employees`
  - `/v1/api/lead-sources`
  - `/v1/api/locations`
- **Impact:** 5 calls = 1/6 of the entire per-minute budget in one click. If the current retry logic fires again on 429, that's 10 calls from one button press.
- **Confirmed in Railway logs:**
  ```
  [AgencyZoom] /config/all fetch failed: /v1/api/pipelines-and-stages → 429 Too Many Requests
  [AgencyZoom] /config/all fetch failed: /v1/api/custom-fields → 429 Too Many Requests
  [AgencyZoom] /config/all fetch failed: /v1/api/locations → 429 Too Many Requests
  ```

### Permissions — Not Admin-Only, But Role-Dependent (B20)
- **Source:** Official AgencyZoom OpenAPI spec — https://app.agencyzoom.com/openapi/agencyzoom.yaml
- **What the docs say:** *"Permissions afforded to the caller are the same as those for the logged in user."*
- **What the docs recommend:** Use agency owner credentials for full API access.
- **Conclusion:** Non-owner accounts can authenticate successfully but may receive restricted or empty responses on certain endpoints (pipelines, custom fields, locations, employees). There is no hard block — just silently reduced access based on role.
- **This is NOT confirmed for CG specifically** — we do not know what role CG's connected AZ account has.

### Spinner Never Resolves (B19)
- The UI enters a loading state when "Configure AgencyZoom" is clicked and calls `GET /api/agencyzoom/config/all`.
- If any of the 5 parallel AZ calls fail (429 or permissions), the backend returns a partial or error response.
- The frontend does not handle error responses from `/config/all` — it never exits the loading state.
- **Two possible causes, possibly both at once:**
  1. 429 rate limit hit → backend returns error → UI hangs
  2. CG's account role lacks permissions → AZ returns empty/restricted data → UI doesn't know how to render it

---

## What We Don't Know — Open Questions

1. **What role is CG's AZ account?** Owner, admin, or standard user? This determines whether permissions are the issue.
2. **Does Jake ever hit 429s?** He may retry successfully within the minute budget, masking the issue.
3. **Does the UI handle a partial `/config/all` response?** If pipelines come back empty due to permissions, does the wizard still render or hang?
4. **Does CG get 429s, permission errors, or both?** We need Railway logs from a CG config wizard attempt to separate the two.

---

## Proposed Fixes

### Fix 1 — Serialize `/config/all` calls (addresses B17)
Replace `Promise.all` with sequential calls and ~300ms delay between each:
```js
// Before
const [customFields, pipelines, employees, leadSources, locations] = await Promise.all([...])

// After
const customFields = await fetchJson("/v1/api/custom-fields");
await delay(300);
const pipelines = await fetchJson("/v1/api/pipelines-and-stages");
await delay(300);
// etc.
```
5 sequential calls ≈ 1.5s total — imperceptible to the user. Spreads load across the rate limit window.

### Fix 2 — Handle errors gracefully in the UI (addresses B19)
If `/config/all` returns an error or partial data, the wizard should exit the loading state and show a clear message rather than spinning forever. Options:
- Show an error banner: "Could not load AgencyZoom config. Please try again."
- Retry button instead of infinite spinner

### Fix 3 — Confirm CG's account role before assuming permissions issue (addresses B20)
Ask CG what account they used to connect AZ in Lumina. If it's not an owner account, recommend they reconnect using their owner credentials. No code change needed — just a support action.

---

## Recommended Build Order

1. **Ask CG** what AZ account role they used — rules out or confirms B20 before writing code
2. **Fix 2 first** — UI graceful error handling is low risk, unblocks CG from seeing a useful error instead of a spinner
3. **Fix 1 second** — serialize the API calls to prevent 429s for all users going forward
4. **Retest with CG** after both fixes to confirm wizard loads

---

## Source
- AgencyZoom OpenAPI spec: https://app.agencyzoom.com/openapi/agencyzoom.yaml
- Railway logs from Jake's session (2026-03-28)
