# CLAUDE.md

This file provides guidance to Claude Code when working with code in this
repository. Read this entire file before taking any action.

---

## Commands

### Development
```bash
# Run both frontend (port 3000) and backend (port 3002) together
npm run dev

# Run separately
npm run dev:frontend
npm run dev:backend
```

### Build & Production
```bash
npm run build          # Build frontend (Next.js)
npm run prod           # Run both in production mode
```

### Frontend-only (from frontend/)
```bash
cd frontend
npm run lint           # Next.js ESLint
npm run dev            # Dev server
npm run build          # Production build
```

### Backend-only (from backend/)
```bash
cd backend
npm run dev            # Node with --watch (auto-reload) — port 3002
```

### Standalone login test (from backend/)
```bash
cd backend
npx tsx src/test-login.ts   # Standalone Farmers SAML login test — opens visible Chromium
# When MFA screen appears, write code to: screenshots/mfa-code.txt
```

### Install all dependencies
```bash
npm run install:all
```

---

## Architecture Overview

**Lumina** is a multi-tenant SaaS platform built for Farmers Insurance agents.
It automates two major workflows:

### Workflow 1 — Voice Agent (Phase 1, MVP built)
Listens to phone calls via RingCentral, transcribes them, extracts structured
lead data using Claude AI, and populates Agency Zoom CRM.

**Data flow:**
1. Call ends → RingCentral webhook fires to `POST /api/ringcentral/webhook`
2. `recording-processor.js` downloads the recording
3. Deepgram or RingCentral AI transcribes with speaker diarization
4. `claude-extract-lead.js` uses Anthropic API to extract structured lead fields
5. Lead is created in Agency Zoom via API (or Playwright fallback)
6. Call record stored in Supabase `call_recordings` table

A polling fallback (`ringcentral-call-log-poller.js`) runs on backend startup
to catch missed webhook events.

### Workflow 2 — Proposal Creation (Phase 2, now building)
This is the next major feature. See full details in the **Proposal Creation
Pipeline** section below.

---

## Monorepo Structure

```
App-Lumina/
├── frontend/           # Next.js 14 + TypeScript + Tailwind CSS v4 + Shadcn UI
├── backend/            # Node.js/Express (mixed JS/TS) — port 3002
│   ├── routes/         # Auth, calls, RingCentral, Agency Zoom, billing, email
│   ├── lib/            # supabase.js, auth-utils.js, shared utilities
│   └── server.js       # Entry point
│   └── src/            # TypeScript proposal pipeline server (port 3003)
│       ├── agents/     # browser.ts, login.ts, mfa.ts, session.ts, gemini.ts, alta.ts, 360.ts
│       ├── config/     # env.ts (Zod validation)
│       ├── data/       # dummy-research.json
│       ├── lib/        # logger.ts, queue.ts, timer.ts
│       ├── routes/     # proposals.ts, triggers.ts
│       ├── steps/      # cad.step.ts, maps.step.ts, realtor.step.ts, aggregator.step.ts
│       ├── triggers/   # call.adapter.ts, apex-lead.adapter.ts, agency-zoom.adapter.ts
│       ├── types/      # proposal.ts
│       ├── workers/    # proposal.worker.ts
│       ├── pipeline.ts # runPipeline orchestrator
│       ├── server.ts   # Entry point (port 3003)
│       └── test-e2e.ts # End-to-end smoke test
├── shared/             # Code shared between frontend & backend
├── supabase/           # DB config/migrations
└── Documentation/      # Architecture docs, design guidelines
```

---

## Frontend (Next.js App Router)

- `app/(workspace)/` — Authenticated routes with shared layout (sidebar nav)
- `app/(public)/` — Unauthenticated routes (login, signup, landing page)
- `components/ui/` — Shadcn/Radix primitives
- `lib/auth.ts` — Token helpers (`getAuthToken`, `setAuthToken`, `removeAuthToken`)
- `lib/config.ts` — API URL configuration
- TypeScript path alias: `@/*` → `frontend/*`

**Key existing routes:**
- `/calls` — call list
- `/calls/[id]` — call detail with transcript + lead form
- `/main-page-1` — primary workspace
- `/settings`, `/reports`

**Proposal creation frontend routes (wiring in progress):**
- `/research-agent` — 9-step state machine (address → CAD → Maps → Realtor → APEX);
  currently uses dummy data + timed animations, being wired to the real backend
- `/research-browser-run` — plays a video simulation; will become a live status feed
  polling `GET /api/proposals/:id` from the proposal pipeline server

**UI Patterns:**
- Shadcn UI (Radix-based) for all core components
- Tailwind CSS v4 utility-first styling
- Sonner for toast notifications
- React Hook Form + Zod for form validation
- ArcGIS loaded via CDN script tag (not bundled — ignored in `next.config.mjs`)
- No global state management — use React `useState`/`useEffect` + direct `fetch()`

---

## Backend (Express)

- `server.js` — Entry point; mounts all routes, starts call log poller
- `routes/` — Auth, calls, RingCentral OAuth/webhook, Agency Zoom, billing, email
- `lib/supabase.js` — Supabase admin client (service-role key)
- `lib/auth-utils.js` — `getUserFromToken()` for request auth
- All data is scoped to `id_organization` for multi-tenancy

---

## Auth Pattern

- Frontend stores `auth_token` in localStorage; all API calls include it as
  Bearer token
- Backend verifies tokens against Supabase; `getUserFromToken()` returns
  user + org

---

## Environment Configuration

- `NODE_ENV` selects `.env.development` or `.env.production` in each package
- Frontend uses `NEXT_PUBLIC_*` prefix for browser-exposed vars
- Required backend vars: Supabase URL/keys, RingCentral credentials, Deepgram
  API key, Anthropic API key, Agency Zoom credentials
- Required frontend vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## Proposal Creation Pipeline

This is the next major feature to build. Understand this section fully before
touching anything related to proposals, research, or APEX.

### What It Is

Proposal Creation is distinct from a phone quote. It requires property research
from multiple sources, then submission of that data through Salesforce/APEX,
Alta, and 360 into Farmers' underwriting model. This is how Farmers agents
create home insurance proposals.

**Terminology:**
- **APEX** = Farmers' internal name for their Salesforce CRM
- **Alta** = Proposal generation tool embedded in APEX/Salesforce
- **360** = Detailed home replacement-cost estimator embedded in APEX/Salesforce
- **Farmers does not expose a Salesforce API** to third parties — all APEX
  automation must be done via browser automation (Playwright + Gemini)

### Three Trigger Sources

Proposal creation can start from three places. Build a thin adapter for each
that normalizes input into a `ProposalInput` object before the pipeline runs.

```typescript
interface ProposalInput {
  triggeredBy: 'call' | 'apex_lead' | 'agency_zoom';
  leadId: string;
  agentId: string;
  property: { address: string; city: string; state: string; zip: string; };
  contact: { firstName: string; lastName: string; phone?: string; email?: string; };
  rawPayload: Record<string, unknown>;
}
```

- **Trigger A:** Post-call → RingCentral → Agency Zoom → proposal
- **Trigger B:** Existing APEX lead from internet source → agent initiates proposal
- **Trigger C:** Direct Agency Zoom lead (no call) → proposal

### Pipeline Steps

```
ProposalInput
    │
    ▼
1. CAD Research          ← REAL — ATTOM Data API (`api.gateway.attomdata.com`)
    │
    ▼
2. Google Maps + Vision  ← STUB (log + return dummy data)
    │
    ▼
3. Realtor.com + Vision  ← STUB (log + return dummy data)
    │
    ▼
4. Research Aggregator   ← Compiles all 3 into research report JSON
    │                       Never fails — partial data is acceptable
    ▼
5. APEX Browser Agent    ← REAL — Playwright + Gemini Computer Use
                            Logs into Salesforce, fills Alta + 360
```

**Critical rule:** Steps 1–3 are wrapped in try/catch. A failure in any
research step must NEVER block the pipeline. Log the error, return null for
that section, and continue. The APEX agent works with whatever data exists.

### Current Status — All 16 Pipeline Steps Complete

The proposal pipeline backend is fully built and smoke-tested end-to-end:

- ✅ Steps 1–5: Research stubs + aggregator run in parallel (~800ms each, ~800ms total)
- ✅ Steps 6–10: Express routes, BullMQ queue/worker, Playwright browser, Salesforce login, MFA human-in-loop gate, session persistence
- ✅ Steps 11–14: Gemini Computer Use loop, Alta form filler, 360 form filler, full APEX orchestrator
- ✅ Steps 15–16: Pipeline orchestrator, smoke test passing

**Full run timing:** ~52s total (research: 800ms, login/session restore: 1.4s, Alta Gemini loop: 22s, 360 Gemini loop: 24s)

**What Gemini currently sees:** Blank pages — `navigateToAlta` and `navigateTo360` in `apex.step.ts` are stubs. Alta and 360 are tools *inside* APEX (Salesforce), not separate URLs — Gemini must navigate to them within the SF UI. Jake Ridley's + CG Insurance credentials are in `backend/.env`. Salesforce login via browser automation is working. Navigating within APEX to Alta/360 is the remaining piece — deferred.

**Completed (2026-03-23):**
- ✅ `/research-agent` "Fill using AI" button now triggers `POST /api/proposals` → gets `proposalId` → routes to `/research-browser-run?proposalId=xxx`
- ✅ `/research-browser-run` video removed; replaced with spinner + real status polling (`GET /api/proposals/:id` every 3s)
- ✅ MFA code entry UI built into `/research-browser-run` (amber banner appears after 8s of active state)
- ✅ Farmers SAML login fixed: correct URL (`eagentsaml.farmersinsurance.com/login.html`), `input[value="I AGREE"]` selector, `domcontentloaded` wait — matches working `test-login.ts` exactly
- ✅ MFA `keyboard.type()` → `fill()` fix (atomic, doesn't lose focus mid-code)
- ✅ Real Realtor.com data via RealtyAPI (Zillow); Gemini interior photo analysis for active listings
- ✅ Backend consolidated: proposal pipeline (formerly port 3003) merged into main Express server (port 3002)

**Completed (2026-03-25):**
- ✅ Story classification logic: CAD stories=1 → "1 story"; stories=2 + upper/first ratio ≥70% → "2 stories"; <70% → "1.5 stories". `storyClassification` + `storyRatioPercent` added to CADData type and displayed with agent notation in DATA_PULLED table and READY_360 review
- ✅ Dynamic CAD image by state: TX → `texascad.png`, NY → `nycad.png`, all others → `usacad.png`. Uses `addrParts.state` which is available by the time either image renders
- ✅ Address input: replaced geocode-on-click + heuristic fallback with single mechanism — geocode fires immediately on autocomplete selection, `addrParts` stored at that point. Research button disabled until valid selection made. Typing clears `addrParts`, forcing re-selection. No random text reaches the backend
- ✅ `researchReport` state built progressively: initialized with CAD on first fetch, patched with maps data, patched with realtor data + `status: "research_complete"`. Mirrors `research_reports` DB schema. Ready to wire to backend save calls
- ✅ Removed schools section from DATA_GATHERED and READY_360 review
- ✅ Added listing history (from RealtyAPI `priceHistory`) to DATA_GATHERED display
- ✅ Photo carousel above DATA_GATHERED data table using Zillow photo URLs (`photoUrls[]` from realtor step)
- ✅ READY_360 review: all fields always visible with "—" when data unavailable; removed duplicate Bathrooms from Interior section
- ✅ Status pills renamed: "Realtor.com data stored" → "Zillow data stored", "Google Map image analysis data stored" → "G-Maps analysis data stored"
- ✅ Research report persistence Phase 1: `researchReport` written to `localStorage` under `research_report_${agencyZoomLeadId}` on every state change in `/research-agent`. `/agency-zoom-leads/[id]` reads on load — renders report section (Property summary, Exterior & site, Interior finishes) at bottom; button shows "Refresh Research" if report exists.
- ✅ Lead detail page field labels changed from ALL CAPS to title case (removed `uppercase` Tailwind class from all field label spans)

**Remaining:**
1. Navigate within APEX to Alta and 360 — these are tools inside Salesforce, not separate URLs. Jake Ridley's + CG Insurance credentials are in `backend/.env`. Login works. Gemini needs to navigate within the SF UI to reach Alta/360 and fill the forms.
2. **Research report persistence Phase 2 (after UI validated):** Replace localStorage with Supabase. Write migration based on confirmed `researchReport` shape. Swap localStorage reads/writes for `POST /api/research-reports` (on CAD success) and `PATCH /api/research-reports/:id` (on maps + realtor success). Upsert on `agency_zoom_lead_id` (one row per lead, always latest).
3. Session saved as `sessions/jake-ridley.json` after first successful MFA — subsequent runs skip login for 30 days

**`researchReport` shape (confirmed, drives Phase 2 DB schema):**
```typescript
{
  agencyZoomLeadId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  cad: CadData | null;
  maps: { roofStyle: string; poolVisible: boolean; solarPanelsVisible: boolean; trampolineVisible: boolean } | null;
  realtor: RealtorApiData | null;
  status: "in_progress" | "research_complete";
}
```

### CAD Research — ATTOM Data API

CAD data comes from [ATTOM Data API](https://api.gateway.attomdata.com), NOT county scraping.

```
GET https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail
  ?address1=9808 Coolidge Dr
  &address2=McKinney, TX
Headers: apikey: <ATTOM_API_KEY>, Accept: application/json
```

Field mappings from response:
- `summary.propclass` → `propertyType`
- `summary.yearbuilt` → `yearBuilt`
- `building.size.livingsize` → `livingAreaSqft`
- `building.size.grosssize` → `totalBuildingSqft`
- `building.parking.prkgSize` → `attachedGarageSqft`

### Stub Pattern (Maps + Realtor steps still stubbed)

Remaining stub steps follow this pattern:

```typescript
export async function runMapsStep(proposalId: string, address: string) {
  logger.info({ proposalId, step: 'maps', status: 'started', address });
  try {
    // TODO: implement real Maps step
    await new Promise(r => setTimeout(r, 800));
    const result = dummyResearch.googleMaps.data;
    logger.info({ proposalId, step: 'maps', status: 'complete' });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'maps', status: 'failed', err });
    return null; // never throw
  }
}
```

### Static Test Property (Dummy Research JSON)

The file `backend/src/data/dummy-research.json` holds static data for the
test property used during APEX agent development:

**9808 Coolidge Dr, McKinney TX 75070 — Collin County**

```json
{
  "proposalId": "test-001",
  "property": {
    "address": "9808 Coolidge Dr",
    "city": "McKinney", "state": "TX", "zip": "75070",
    "county": "Collin County", "apn": "R-8113-00D-0190-1"
  },
  "cad": {
    "data": {
      "propertyType": "Single-family home",
      "yearBuilt": 2003,
      "livingAreaSqft": 1914,
      "totalBuildingSqft": 2379,
      "attachedGarageSqft": 465,
      "coveredPorchPatioSqft": 44,
      "lastSaleAmount": 133700,
      "lastSaleDate": "2003-08-13",
      "estimatedValue": 355921
    }
  },
  "googleMaps": {
    "data": {
      "structureType": "single-family",
      "stories": 2,
      "exteriorMaterial": "brick",
      "roofStyle": "hip",
      "roofCovering": "asphalt shingle",
      "foundationType": "slab",
      "solarPanelsVisible": false,
      "poolVisible": false
    }
  },
  "realtor": {
    "data": {
      "flooringType": "hardwood and carpet",
      "bathroomCount": 2,
      "kitchenFinishes": "standard",
      "interiorCondition": "good"
    }
  }
}
```

---

## APEX Browser Agent

This is the most complex and important component. Read carefully.

### Why Browser Automation (Not Salesforce API)

Farmers controls the Salesforce org. There is no Connected App approved for
third-party API access. Alta and 360 are managed packages that require UI
interaction to function correctly — their logic lives in Lightning components
that only fire properly when forms are submitted through the browser. Browser
automation (Playwright) is the only viable path.

### Tech Stack for APEX Agent

- **Playwright** — browser control, headless Chromium, session management
- **Gemini Computer Use API** (`gemini-2.5-computer-use-preview-10-2025`) —
  vision layer. Takes screenshots, decides what to click/type. Playwright
  executes its instructions.
- **Why Gemini over hardcoded selectors:** Salesforce Lightning uses Shadow DOM
  (synthetic, migrating to native). Selectors break when Farmers pushes UI
  updates (3x/year). Gemini reads the screen visually like a human — it finds
  fields by label, not DOM ID. Shadow DOM is irrelevant to vision-based automation.

### Gemini + Playwright Loop

```
Take screenshot
      ↓
Send to Gemini with goal + screenshot (base64 PNG)
      ↓
Gemini returns functionCall parts: click(coordinate), type(text), scroll, key, done
      ↓
Playwright executes each action
      ↓
Send functionResponse (with current_url field!) back as next user turn
      ↓
Take new screenshot, repeat until no functionCalls returned
```

**Critical implementation details for `gemini.ts`:**
- Model: `gemini-2.5-computer-use-preview-10-2025` (exact string required)
- Must include `tools: [{ computerUse: { environment: Environment.ENVIRONMENT_BROWSER } }]`
  in every `generateContent` call — model returns 400 without it
- Import `Environment` enum from `@google/genai` — do not use string `'browser'`
- Every `functionResponse` must include `current_url: page.url()` in the response object
- Multi-turn: maintain `contents[]` array, alternating `role: 'user'` / `role: 'model'` turns
- First user turn: prepend system prompt + goal as text part before the screenshot
- Function response parts go as the next `role: 'user'` turn (not inline with screenshot)

### Auth Strategy (Build in this order)

**Step 1 — Basic login**
Navigate to SF login URL, fill username/password, submit.

**Step 2 — MFA handling**
Detect MFA screen. Do NOT automate around MFA. Pause, notify the Lumina
frontend via webhook/WebSocket, wait for human to enter the code, then continue.
This is a human-in-the-loop gate — it's intentional and correct.

**Step 3 — Session persistence**
After successful login, save browser storage state per `agentId`:
```typescript
await context.storageState({ path: `sessions/${agentId}.json` });
// Restore on next run:
const context = await browser.newContext({
  storageState: `sessions/${agentId}.json`
});
```
Never share sessions across agents. One session file per `agentId`.

### Shadow DOM — Important Notes

Salesforce Lightning uses synthetic shadow DOM (polyfill). Key facts:
- `document.querySelector()` does NOT work across shadow boundaries
- Playwright's `locator()` with `>>` pierce syntax works for DOM-based targeting
- Gemini Computer Use bypasses this entirely — it sees the screen, not the DOM
- Use Gemini for element discovery, use Playwright for execution
- When Farmers updates their UI, Gemini adapts. Hardcoded selectors break.

### Form Filling — Alta and 360

Each form gets its own module. Pass research report fields as goal context:

**Alta fills:** property type, year built, roof type, roof style, exterior
material, number of stories, garage type.

**360 fills:** living area sqft, total building sqft, attached garage sqft,
year built, exterior wall type, foundation type, roof covering, roof style.

Always instruct Gemini: "Do not submit the form. Stop after the last field
is filled." Human reviews before submission.

---

## Human-in-the-Loop Design

Every significant automation step has a human confirmation moment. This is
intentional — agents need to trust the system before relying on it.

### Research Flow State Machine (frontend `/research`)

```
Address input
    ↓ (triggers CAD — ATTOM API)
DATA_PULLED
    ↓ "Ready to continue with Google Maps?"
GOOGLE_MAP_PROMPT
    ↓ "Ready to continue with Realtor.com?"
DATA_GATHERED
    ↓ "Review Research" button
READY_360
    ↓ "Fill using AI" → /research-browser-run
```

Each step can be skipped. Skipping Maps goes straight to Realtor prompt.
Skipping Realtor goes straight to READY_360. The pipeline always produces
a research report even with partial data.

### APEX Automation View (frontend `/research-browser-run`)

Currently a video simulation (`/browserautosimulation.mov`) + timed checklist.
Will be replaced with real Playwright + Gemini automation. The UI should show:
- Live status feed of what the agent is doing
- Step-level progress (navigating to Alta... filling dwelling coverage...)
- A pause/review moment before any form is submitted

---

## Build Order (all steps complete)

1. ✅ Backend skeleton — TypeScript/ESM, Express (port 3003), Winston, Zod env
2. ✅ BullMQ queue + worker (Redis)
3. ✅ ProposalInput types + three trigger adapters (call, apex_lead, agency_zoom)
4. ✅ Three stub steps (CAD, Maps, Realtor) with 800ms delay + dummy data
5. ✅ Research aggregator — parallel Promise.all, never throws
6. ✅ API: POST /api/proposals, GET /api/proposals/:id, POST /api/proposals/:id/mfa,
   POST /api/triggers/{call,apex-lead,agency-zoom}
7. ✅ Playwright browser instance + sessions/ directory
8. ✅ Salesforce login (`login.ts`) — waitForFunction (not waitForNavigation) for SPA
9. ✅ MFA human-in-loop gate (`mfa.ts`) — polls every 3s, 5min timeout
10. ✅ Session persistence (`session.ts`) — per-agentId storageState JSON
11. ✅ Gemini Computer Use loop (`gemini.ts`) — multi-turn functionCall/functionResponse
12. ✅ Alta form filler (`alta.ts`)
13. ✅ 360 form filler (`360.ts`)
14. ✅ APEX step orchestrator (`apex.step.ts`) — login → MFA → persist → Alta → 360
15. ✅ Pipeline orchestrator (`pipeline.ts`) — research → APEX, timing on each phase
16. ✅ Smoke test (`test-e2e.ts`) — POST /api/proposals → poll to completion

**Next build phase — frontend wiring:**
- Wire `/research-agent` page to proposal pipeline server
- Replace `/research-browser-run` video with live status feed
- Add MFA code entry UI

---

## Known Gotchas (Save Yourself Time)

- **dotenv in ESM**: `config()` must be called inside `env.ts` before the Zod
  schema runs. Calling it in `server.ts` or anywhere else is too late due to
  ESM static import hoisting — env vars will be undefined at validation time.

- **BullMQ jobId**: `queue.add(name, data)` auto-assigns a numeric job ID.
  `queue.getJob(proposalId)` returns null unless you pass `{ jobId: proposalId }`
  as the third argument to `queue.add()`. All three trigger routes must do this.

- **Salesforce login waitForNavigation**: SF renders the MFA screen as a SPA
  transition (no full navigation event). Use `waitForFunction(() =>
  !window.location.href.includes('login.salesforce.com/'))` instead of
  `waitForNavigation`.

- **Screenshot after login**: Read the org domain from saved session cookies
  (`context.cookies()` → find `.salesforce.com` domain) and navigate to it.
  Don't screenshot a newly opened blank page.

- **Winston object logs**: Pass structured objects to `logger.info({ ... })`,
  not `logger.info('message', { ... })`. The printf format must JSON.stringify
  when `typeof message === 'object'`.

- **File editing — always use the native Edit / str_replace tools only.** Never
  use Python, Node.js, `node -e`, or sed to read or modify files — this includes
  tab-indented `.ts` and `.tsx` files. If a pattern match fails, re-read the file
  with the Read tool to get the exact characters (including indentation), then retry
  with the Edit tool.

---

## Key Decisions (Do Not Revisit Without Discussion)

- **Gemini over hardcoded Playwright selectors** for APEX — Shadow DOM + UI
  update fragility makes selectors a maintenance nightmare
- **Stubs first, APEX agent now** — research steps (CAD, Maps, Realtor) are
  explicitly deferred. Do not implement them yet.
- **No single research failure blocks the pipeline** — always produce a report
- **MFA is a human gate** — never automate around Salesforce MFA
- **One session file per agentId** — never share Salesforce sessions
- **Multi-tenant from day one** — all data scoped to `id_organization`. Every new table must also include `created_by` (IdUser) for attribution.
- **Auth middleware before new routes** — `requireAuth` middleware must be wired before adding any new API route that reads or writes user/org data.
- **RC poller multi-tenancy** — `STATE_KEY = "default"` is being replaced with per-org pollers (Task #10). New pollers are closures over `orgId`; existing `"default"` row in `ringcentral_connections` is left as-is (data continuity).
- **No Stripe yet** — per-seat billing is the end state but deferred until auth is hardened.
- **Realtor.com for interior images** — not Zillow. Zillow was considered and
  dropped. Realtor.com is the data source for interior photo analysis.
- **Post-MVP: Nearmap** for high-resolution aerial imagery and roof measurements.
  Do not implement now.

---

## Multi-Tenancy & Auth

### Current State (2026-03-25, updated)

The app uses `NEXT_PUBLIC_BYPASS_AUTH=1` for dev — the workspace layout sets `auth_token = "dev-bypass-token"` in localStorage, and `getUserFromToken` short-circuits to return a hardcoded dev user (`IdUser: "dev-user-id"`, `IdOrganization: "default"`). No DB lookup happens. All dev data in Supabase is stored under `"default"` so dev users see real RC call data.

**What is built and working:**
- `requireAuth` middleware (`backend/middleware/auth.js`) — wired to `/api/calls`, `/api/proposals`, `/api/property/cad|maps|realtor`, `/api/research-reports`
- `research_reports` table in Supabase — rows saved progressively (CAD → POST, maps → PATCH, realtor → PATCH with `status: research_complete`). Includes `id_organization`, `created_by`, `lead_phone`, `lead_email`.
- `/agency-zoom-leads/[id]` loads research report from DB on page load. Shows "Refresh Research" if report exists.
- Dev bypass tested end-to-end — all steps return 200/201, rows confirmed in Supabase.
- Real signup + login confirmed working. `organizations`, `users`, `joincodes` tables migrated (migration 008).
- Forgot password via Resend confirmed working. Uses `lumina@maderedi.com` (verified domain). Migration 009 adds `password_reset_codes` table.
- RC token expiration fixed: singleton platform in poller, `refreshSuccess`/`refreshError` events, `refresh_token_expire_time` persisted (migration 010).
- Calls pages converted to client components — auth token sent correctly, calls visible.

**What is NOT wired yet:**
- RC poller and AgencyZoom routes still hardcode `id_organization: "default"` — being fixed in Tasks #10 + #11.
- No Stripe wiring yet. End state: per-seat billing where each enabled user in an org = 1 seat on the org's subscription.

### Ownership Model

| Data | Scoped by | Notes |
|---|---|---|
| Calls, leads, research reports, proposals | `id_organization` | Shared across the whole org |
| Who performed an action | `created_by` (IdUser) | Attribution / audit trail |
| RingCentral / AZ connection | One per org | Managed by org admin |
| Salesforce session files | One per user (`sessions/{userId}.json`) | Never shared across users |

### Auth Middleware Plan

A single Express middleware `requireAuth` in `backend/middleware/auth.js`:

```js
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user; // { IdUser, IdOrganization, Role, Email }
  next();
}
```

Apply to all workspace routes. Each route then uses `req.user.IdOrganization` for DB filters and `req.user.IdUser` for `created_by`.

### New Tables — Schema Requirements

Every new table must include from day one:
- `id_organization TEXT NOT NULL` — org isolation
- `created_by TEXT NOT NULL` — user attribution (IdUser)

This applies to `research_reports` and `proposals`. Do not add new tables without these columns.

### RingCentral Multi-Tenancy (Tasks #10 + #11 — in progress)

RC uses a two-level model:
- **Org level (Task #10):** One RC OAuth connection per Lumina org. Admin connects their RC account once from Settings. The OAuth `state` param carries the org's `IdOrganization`. Tokens stored in `ringcentral_connections` keyed by `id_organization`. Poller runs one instance per connected org.
- **User level (Task #11):** Map RC extensions to Lumina users so each call is tagged with the agent who handled it. All org members see all calls, but each user's calls are identifiable. RC extensions fetched via `/restapi/v1.0/account/~/extension`, stored in `rc_user_extensions` table. Admin maps extensions to users in Settings.

**Task #10 implementation plan:**
1. `requireAuth` on `/api/ringcentral/status` and `/api/ringcentral/auth` — use `req.user.IdOrganization` as state key
2. Settings page sends auth token when checking RC status + initiating OAuth
3. `/api/ringcentral/callback` reads `state` as `IdOrganization` (already does this, just need to wire the auth)
4. Poller: `startCallLogPoller()` → `startAllOrgsPollers()` — queries all rows in `ringcentral_connections`, starts one poller per org
5. Each poller instance is a closure over its `orgId` — inserts calls with `id_organization: orgId`
6. `resetAndRestartPoller(orgId)` — stops/restarts just that org's poller after OAuth reconnect

**Task #11 implementation plan:**
1. Migration: `rc_user_extensions` table — `(id_organization, id_user, rc_extension_id, rc_extension_number, rc_display_name, created_at)`
2. New route `GET /api/ringcentral/extensions` — fetches live extensions from RC API for the org, returns list with any existing mapping
3. New route `POST /api/ringcentral/extensions/map` — saves a mapping (extension_id → user_id)
4. Settings page UI: "Map RC Extensions" section (visible to Owner/Admin) — lists extensions, dropdown to assign each to a Lumina user
5. When inserting a call into `call_recordings`, look up the answering extension in `rc_user_extensions`, store `handled_by_user_id`
6. Calls list: add "My calls" filter tab (filters by `handled_by_user_id = req.user.IdUser`)
7. Call detail: shows "Handled by: [Name]" field

**New column on `call_recordings`:** `handled_by_user_id TEXT` — nullable. Migration 011.

### AgencyZoom Auth Model (Task #9 — deferred)

AZ actions (create lead, update record) will be taken as the authenticated Lumina user. Deferred until RC tasks complete — requires per-user AZ credentials or OAuth.

### Build Order for Auth Hardening

1. ✅ `requireAuth` middleware — `backend/middleware/auth.js`
2. ✅ Wire middleware to `/api/calls`, `/api/proposals`, `/api/property/cad|maps|realtor`, `/api/research-reports`
3. ✅ `research_reports` migration + backend routes + frontend wired (localStorage replaced)
4. ✅ Dev bypass token (`dev-bypass-token`) — layout sets it, `getUserFromToken` recognises it in non-production. Bypass org is `"default"` so dev users see RC call data.
5. ✅ **`organizations`, `users`, `joincodes` migrations** — `supabase/migrations/008_auth_tables.sql` run in Supabase Dashboard
6. ✅ **Real signup + login confirmed working.** `auth.js` uses `supabaseAdmin` for all table ops, `supabaseAuth` (anon client) for `signInWithPassword` only.
7. ✅ **Forgot password via Resend** — `lumina@maderedi.com` (verified `maderedi.com` domain). Migration 009 (`password_reset_codes`).
8. ✅ **RC token expiration fixed** — singleton poller platform, `refreshSuccess`/`refreshError` events, migration 010 (`refresh_token_expire_time` column).
9. ◻ **RC multi-tenant OAuth per org (Task #10)** — fix `STATE_KEY = "default"` hardcode, one poller per org
10. ◻ **RC extension → Lumina user mapping (Task #11)** — `rc_user_extensions` table, Settings UI, `handled_by_user_id` on calls
11. ◻ **AZ multi-user auth model (Task #9)** — deferred until RC tasks complete
12. ◻ **Stripe wiring** — per-seat billing, deferred

---

## Early Customers / Test Accounts

- **Alex Ridley** — Farmers Insurance, Texas (primary design partner, 8 agents)
  First test property: 9808 Coolidge Dr, McKinney TX 75070
- **Jake Ridley** — same agency group as Alex. Credentials in `backend/.env` — used for Salesforce login automation.
- **Jeremy Johnson** — separate Farmers agency
- **CG Insurance** — separate Farmers agency. Credentials in `backend/.env`.

---

## Environment Variables Needed for Proposal Pipeline

Add these to `backend/.env.development`:

```bash
# Salesforce / APEX Agent
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=
SF_PASSWORD=
SF_SESSION_DIR=./sessions

# Gemini (Computer Use)
GEMINI_API_KEY=

# ATTOM Data API (property / CAD research)
ATTOM_API_KEY=

# Google Maps (stub for now — key ready, no calls yet)
GOOGLE_MAPS_API_KEY=

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379
```
