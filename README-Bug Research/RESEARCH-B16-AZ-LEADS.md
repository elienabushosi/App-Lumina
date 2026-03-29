# Research: B16 — AgencyZoom Leads/List Client-Side Error

**Status:** Investigation complete — awaiting approval before any fix
**Date:** 2026-03-29
**Bug:** Jake connected AZ, went to the Leads page, and leads weren't loading. The frontend threw a client-side error on his screen. B16 is about **fetching leads FROM AZ onto the Leads page** — this is separate from B18 which is about posting leads TO AZ after an RC call.

---

## What the Logs Actually Tell Us

Railway logs at `2026-03-27T20:45:11` confirm the backend successfully fetched leads from AZ and logged the first lead's field keys:

```
[AgencyZoom] leads/list sample keys: [
  'id', 'firstname', 'middlename', 'lastname', 'leadType', 'email',
  'phone', 'secondaryEmail', 'secondaryPhone', 'streetAddress', 'city',
  'state', 'country', 'zip', 'status', 'leadSourceId', 'leadSourceName',
  'enterStageDate', 'assignedTo', ...
]
```

**Conclusion: the backend is working. The bug is in the frontend.**

The backend received leads from AZ, parsed them, and returned them. Something crashed in the browser while trying to render them.

---

## What the Code Actually Does

### Backend (`POST /api/agencyzoom/leads/list`)
1. Gets the user's AZ JWT via `getAgencyZoomJwtForUser(req.user.IdUser)`
2. Proxies a POST to `https://api.agencyzoom.com/v1/api/leads/list` with:
   - `page: 0`, `pageSize: 50`
   - `sort: "lastEnterStageDate"`, `order: "desc"`
3. Parses the response and logs the first lead's keys
4. Returns the raw AZ response body as-is (`res.json(json)`)

### Frontend (`/agency-zoom-leads/page.tsx`)
1. POSTs to `/api/agencyzoom/leads/list`
2. Extracts leads array: `json.data ?? json.leads ?? json ?? []`
3. Guards with `Array.isArray(items) ? items : []`
4. Calls `leads.map((lead) => ...)` to render each table row
5. Each row calls `statusColor(lead.status)` to determine the badge color

---

## Root Cause — `statusColor` crashes on non-string `status`

The `statusColor` function in `agency-zoom-leads/page.tsx`:

```js
function statusColor(status?: string) {
  if (!status) return "secondary";
  const s = status.toLowerCase();  // 💥 crashes if status is a number
  ...
}
```

AZ's confirmed field list includes `status`. If AZ returns `status` as an **integer** (e.g. `1`, `2`, `0`) instead of a string like `"active"`:

- `!status` → `false` when status is `1` (1 is truthy, so the guard doesn't catch it)
- `status.toLowerCase()` → `TypeError: status.toLowerCase is not a function`

This exception is thrown inside `leads.map()` during React's render cycle. There is no error boundary on the leads page, so the exception crashes the entire component — which is exactly the "client-side error" Jake saw on his screen.

**Why this is plausible:** AZ's API has integer-coded fields elsewhere (e.g. `leadSourceId`, `csrId`, `maritalStatus` expects integers). `status` could be returned as a numeric code in some account configurations.

---

## Secondary Issue — Sort field name mismatch

The request sends `sort: "lastEnterStageDate"`. AZ's actual confirmed field name is `enterStageDate` (no "last" prefix). AZ likely ignores the unknown sort key and falls back to default ordering — not a crash, but leads may not sort as intended.

---

## What Is NOT the Problem

- **Backend auth / JWT:** Backend successfully authenticated and fetched leads (confirmed by logs).
- **Field mapping (firstname/lastname/leadSourceName):** All have safe `|| "—"` fallbacks in the frontend.
- **Response structure:** `json.data ?? json.leads ?? json ?? []` + `Array.isArray` guard handles all shapes.
- **B14 (credentials not persisted):** Already resolved. Not a factor.
- **B18 (posting leads to AZ):** Completely separate issue about field mapping on lead create — not related to this page.

---

## Proposed Fix

### Fix 1 — Harden `statusColor` to handle non-string values (HIGH — actual crash fix)

```js
function statusColor(status?: string | number | null) {
  if (!status && status !== 0) return "secondary";
  const s = String(status).toLowerCase();
  ...
}
```

Converts `status` to a string before calling `.toLowerCase()`. Safe for integers, nulls, and strings.

### Fix 2 — Sort field name (LOW — cosmetic)

Change `sort: "lastEnterStageDate"` → `sort: "enterStageDate"` in `backend/routes/agencyzoom.js:203` to match AZ's actual field name.

---

## Files to Change

| File | Line | What changes |
|---|---|---|
| `frontend/app/(workspace)/agency-zoom-leads/page.tsx` | `statusColor` function | Handle non-string `status` with `String(status)` coercion |
| `backend/routes/agencyzoom.js` | ~203 | `sort: "lastEnterStageDate"` → `sort: "enterStageDate"` |

---

## Open Questions for Discussion

1. **What does AZ actually return for `status`?** If it's always a string like `"active"`, the `String()` coercion is harmless but the crash would need another explanation. Do you recall if the browser console showed `TypeError: status.toLowerCase is not a function` specifically?
2. **Should we add an error boundary to the leads page** so a single bad lead field can't crash the whole table?
