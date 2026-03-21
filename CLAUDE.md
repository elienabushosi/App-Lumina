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
npm run dev            # Node with --watch (auto-reload)
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
├── backend/            # Node.js/Express (mixed JS/TS)
│   ├── routes/         # Auth, calls, RingCentral, Agency Zoom, billing, email
│   ├── lib/            # supabase.js, auth-utils.js, shared utilities
│   └── server.js       # Entry point
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

**Proposal creation frontend routes (being built):**
- `/research` — the research workflow (CAD → Maps → Realtor.com → APEX handoff)
- `/research-browser-run` — live APEX automation view (currently a video simulation,
  will be replaced with real Playwright + Gemini automation)

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
1. CAD Research          ← STUB (log + return dummy data)
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

### Current Build Focus

**The APEX agent (step 5) is the ONLY step being fully implemented now.**
Steps 1–3 are stubs that return dummy data from `dummy-research.json`.
Do not implement real CAD scraping, Maps API calls, or Realtor.com scraping
until the APEX agent is complete and tested.

### Stub Pattern

Every stub step must follow this exact pattern:

```typescript
export async function runCADStep(proposalId: string, address: string) {
  logger.info({ proposalId, step: 'cad', status: 'started', address });
  try {
    // TODO: implement real CAD scraper (Playwright + Gemini vision)
    await new Promise(r => setTimeout(r, 800)); // simulate delay, remove later
    const result = dummyResearch.cad;
    logger.info({ proposalId, step: 'cad', status: 'complete' });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'cad', status: 'failed', err });
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
Send to Gemini with goal
      ↓
Gemini returns: click(x,y), type(text), scroll(delta)
      ↓
Playwright executes actions
      ↓
Take new screenshot, repeat until done
```

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
    ↓ (triggers CAD stub)
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

## Build Order

Work strictly in this sequence. Do not skip ahead.

1. Backend skeleton — folder structure, TypeScript config, Express server,
   Winston logger, env validation
2. BullMQ queue + worker setup (Redis backing)
3. ProposalInput types + three trigger adapters (call, apex_lead, agency_zoom)
4. Three stub steps (CAD, Maps, Realtor) following stub pattern above
5. Research aggregator (passthrough to dummy-research.json for now)
6. API endpoints: POST /proposals, GET /proposals/:id, GET /health,
   POST /triggers/call, POST /triggers/apex-lead, POST /triggers/agency-zoom
7. Playwright browser instance + session directory setup
8. Salesforce login flow (`login.ts`)
9. MFA detection + human-in-loop pause (`mfa.ts`)
10. Session persistence + restore (`session.ts`)
11. Gemini Computer Use wrapper (`gemini.ts`)
12. Alta form filler (`alta.ts`)
13. 360 form filler (`360.ts`)
14. Full APEX step orchestrator (`apex.step.ts`)
15. Wire pipeline orchestrator
16. End-to-end test: POST /proposals with dummy input → logs fire → Playwright
    opens Salesforce → begins filling Alta + 360

---

## Key Decisions (Do Not Revisit Without Discussion)

- **Gemini over hardcoded Playwright selectors** for APEX — Shadow DOM + UI
  update fragility makes selectors a maintenance nightmare
- **Stubs first, APEX agent now** — research steps (CAD, Maps, Realtor) are
  explicitly deferred. Do not implement them yet.
- **No single research failure blocks the pipeline** — always produce a report
- **MFA is a human gate** — never automate around Salesforce MFA
- **One session file per agentId** — never share Salesforce sessions
- **Multi-tenant from day one** — all data scoped to `id_organization`
- **Realtor.com for interior images** — not Zillow. Zillow was considered and
  dropped. Realtor.com is the data source for interior photo analysis.
- **Post-MVP: Nearmap** for high-resolution aerial imagery and roof measurements.
  Do not implement now.

---

## Early Customers / Test Accounts

- **Alex Ridley** — Farmers Insurance, Texas (primary design partner, 8 agents)
  First test property: 9808 Coolidge Dr, McKinney TX 75070
- **Jake Ridley** — same agency group as Alex
- **Jeremy Johnson** — separate Farmers agency
- **CG Insurance** — separate Farmers agency
  CG will provide Salesforce credentials for Playwright codegen session

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

# Google Maps (stub for now — key ready, no calls yet)
GOOGLE_MAPS_API_KEY=

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379
```
