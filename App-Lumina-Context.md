# Lumina

## What is Lumina?

Lumina is a workflow automation tool for insurance agents. It eliminates manual data entry by listening to agent phone calls, transcribing them, extracting structured data, and automatically populating the relevant systems — from CRM entry all the way through to proposal generation.

The first production use case targets Farmers Insurance agents using RingCentral as their phone provider, Agency Zoom as their CRM, and Salesforce (APEX) with Alta for quoting.

---

## Architecture Overview

The full pipeline moves left to right across two agents:

```
Client Call
    → RingCentral
        → Lumina (Voice Agent)        — pull, store, post call data
            → Agency Zoom (via API)   — lead creation
                → Lumina (Browser Agent)
                    → Salesforce APEX      — lead entry + property details
                        → Alta             — proposal generation
                            → PDF output   — Standard / Enhanced / Premier quote
```

We are building this pipeline incrementally, left to right. Do not build ahead of the current phase.

---

## Multi-Tenancy Model

Lumina is a multi-tenant platform organized by agency. Each agency is an independent organization (tenant). Users belong to an org, and all call data, leads, transcripts, and automation activity are scoped to that org.

**Key rules:**

- All RingCentral OAuth tokens, webhooks, and call data are scoped to the organization, not the individual user
- When a user connects RingCentral, that connection belongs to their org
- Multiple users within the same org share the same pipeline and data
- No data is shared or visible across organizations

### Tenant Structure

```
Organization (Tenant)
    └── Users (agents who log in)
    └── RingCentral connection (org-level OAuth token)
    └── Call records + transcripts
    └── Leads + extracted data
    └── Agency Zoom connection
```

### Current Customers

| Org Name                 | Users                    | Tenant # |
| ------------------------ | ------------------------ | -------- |
| Ridley Insurance         | Alex Ridley, Jake Ridley | 1        |
| Jeremy Johnson Insurance | Jeremy Johnson           | 2        |
| Cntya G. Insurance       | CG                       | 3        |

> Note: Alex and Jake are both agents under the same org (Ridley Insurance). They share one RingCentral connection and one Agency Zoom connection at the org level.

---

## Build Order

### ✅ Phase 1 — Voice Agent (RingCentral → Lumina → Agency Zoom)

Complete. Call recordings are captured via RingCentral webhook, transcribed with speaker diarization (Deepgram), structured lead fields extracted by Claude AI, and leads created in Agency Zoom via API.

### ✅ Phase 2 — Browser Agent: APEX Login + Session Persistence

Complete. Playwright automates the Farmers Insurance Okta SAML login flow (`eagentsaml.farmersinsurance.com`). SMS MFA is handled as a human-in-the-loop gate — the agent enters the code in the Lumina UI. After MFA, the 30-day trust checkbox is checked and the browser session is saved per agent so login is skipped for 30 days.

### ✅ Phase 3 — Property Research (CAD + Google Maps + Realtor.com)

Complete. The Research Agent UI walks through three data sources:
- **CAD** — ATTOM Data API (year built, sq ft, garage, foundation, roof cover, last sale)
- **Google Maps** — satellite + street view imagery analyzed by Gemini vision (roof style, pool, solar panels)
- **Realtor.com** — RealtyAPI (Zillow data: flooring, bathrooms, valuation, schools; Gemini interior photo analysis for active listings)

Research results are displayed step-by-step with human confirmation between each source.

### 🔜 Phase 4 — Proposal Generation (APEX → Alta → 360 → PDF)

In progress. The pipeline is wired end-to-end:
- "Fill using AI" on the Research Agent triggers the APEX browser agent
- Playwright browser pops up and logs into Salesforce via Okta
- Gemini Computer Use loop fills Alta (dwelling features) and 360 (replacement cost)
- **Remaining:** Real Alta + 360 Salesforce URLs needed (requires Playwright codegen session with agent credentials); currently navigating to stub placeholders

---

## Phase 1 — Voice Agent (Complete)

### What it does

After every inbound or outbound agent call, Lumina automatically:

1. Detects the call has ended (via RingCentral webhook)
2. Downloads the call recording
3. Transcribes the audio to text (speech-to-text + speaker diarization)
4. Extracts structured fields using Claude API (customer ID, AI summary, conversation transcript)
5. Creates a lead in Agency Zoom via API with the extracted data

### Data pulled from the call

| Field                   | Description                                  |
| ----------------------- | -------------------------------------------- |
| Customer ID             | Identifier for the caller                    |
| AI Summary              | Claude-generated summary of the conversation |
| Conversation Transcript | Full speaker-diarized transcript             |

### What gets posted to Agency Zoom

- Create a new lead
- Attach AI summary
- Attach full conversation transcript

---

## Phase 2 — Browser Agent: APEX Login (Complete)

Once the lead exists in Agency Zoom, the Browser Agent takes over and fills in Salesforce APEX.

**Task 1 — Find & Fill (Lead Entry):**

- Lead entry
- Customer details
- Property details
- Meeting notes

---

## Phase 3 — Property Research (Complete)

Before or during APEX entry, Lumina will research the property using browser automation and data extraction across:

- **Google Maps** — aerial view, property location confirmation
- **County Appraisal District website** — official property record, assessed value, lot size, year built
- **Zillow / Redfin** — property details, construction type, square footage, roof type

This data feeds directly into the APEX form fields, eliminating the manual lookup agents currently do across multiple tabs.

---

## Phase 4 — Proposal Generation (In Progress)

**Task 2 — Fill (Proposal Creation):**

Once lead data is in APEX, the Browser Agent moves into Alta (embedded inside Salesforce — no separate login required) to generate the quote.

Steps:

1. Pull property data from CAD (County Appraisal District), Maps, Zillow/Redfin
2. Fill out the Alta / 360 Valuation form
3. Handle address validation and common form errors automatically
4. Generate quote options: **Standard**, **Enhanced**, **Premier**
5. Save as PDF
6. Prepare for delivery to customer

---

## RingCentral Integration Setup (Phase 1)

### Step 1 — Install the RingCentral SDK

```bash
npm install @ringcentral/sdk --save
```

Confirm successful install:

```
added 8 packages, and audited 9 packages in 1s
```

### Step 2 — Create a Developer App

1. Go to [developers.ringcentral.com](https://developers.ringcentral.com)
2. Sign in → **My Apps → Create App**
3. Select **REST API App**
4. Save your **Client ID** and **Client Secret**

### Step 3 — Set API Permission Scopes

- `Read Call Log`
- `Read Call Recording`
- `Webhook Subscriptions`

### Step 4 — Enable Automatic Call Recording (ACR)

In the RingCentral Admin Portal:

1. Go to **Phone System → Auto-Receptionist → General Settings**
2. Click **Call Recording**
3. Toggle **Enable Automatic Call Recording** to on
4. Under **Extensions to Record**, select the relevant extensions and check **Inbound**
5. Set **Announcement on Start** (compliance requirement)
6. Save

> Recordings are stored for 90 days. Lumina pulls recordings immediately after each call via API so this limit does not affect the pipeline.

### Step 5 — OAuth Connect Flow (Org-Scoped)

Each organization connects their RingCentral account to Lumina once via OAuth. The token is stored at the org level and shared across all users in that org.

1. Admin clicks "Connect RingCentral" inside Lumina
2. Redirected to RingCentral approval screen
3. Admin approves scopes
4. RingCentral returns an access token
5. Token is stored against the organization record
6. All subsequent webhook events and recording downloads for that org use this token

### Step 6 — Webhook Listener

Subscribe to the telephony sessions event:

```
/restapi/v1.0/account/~/extension/~/telephony/sessions
```

Fires when a call ends. Payload contains the `telephonySessionId`. Lumina routes the event to the correct org based on the token it was received on.

**Webhook requirements:**

- Publicly accessible endpoint (use ngrok locally)
- TLS 1.2+
- Respond within 3000ms with HTTP 200
- Return valid `Validation-Token` header on setup

### Step 7 — Download the Call Recording

```
GET /restapi/v1.0/account/~/call-log?recordingType=All
```

Response includes `recording.contentUri` — the audio file URL hosted on `media.ringcentral.com`.

### Step 8 — Transcribe with RingCentral AI API

Send audio to RingCentral's speech-to-text endpoint with:

- `source: CallCenter` — optimized for 2-3 speaker phone calls
- `enableSpeakerDiarization: true` — separates agent and customer voices
- `enableVoiceActivityDetection: true` — strips silence and noise

API is async — returns a `jobId`. Use callback webhook to receive transcript on completion.

### Step 9 — Extract Structured Fields with Claude API

Pass the transcript to Claude API with a structured extraction prompt targeting Agency Zoom fields:

- Customer full name
- Phone number
- Property address
- Coverage type requested
- Current insurer
- Policy expiration date
- Home details (year built, sq footage, construction type, roof type)
- AI-generated call summary

Claude returns a structured JSON object. All extracted data is tagged with the org ID before storage.

### Step 10 — Post to Agency Zoom

Use the Agency Zoom API to:

- Create a new lead
- Attach the AI summary
- Attach the full conversation transcript

Fall back to Playwright browser automation if the API is unavailable or insufficient.

---

## Tech Stack

| Layer              | Tool                                                   |
| ------------------ | ------------------------------------------------------ |
| Phone provider     | RingCentral (RingEX)                                   |
| Call event trigger | RingCentral Webhooks                                   |
| Transcription      | RingCentral AI API                                     |
| Data extraction    | Claude API (Anthropic)                                 |
| CRM                | Agency Zoom (Vertafore)                                |
| CRM fill           | Agency Zoom API → Playwright fallback                  |
| Quoting platform   | Salesforce APEX + Alta (embedded)                      |
| Property research  | Google Maps, County Appraisal District, Zillow, Redfin |
| Browser automation | Playwright                                             |
| Auth               | OAuth 2.0 (RingCentral) — org-scoped                   |
| PDF generation     | Alta / 360 Valuation (in-platform)                     |

---

## Development Environment

### Test Account Strategy

Use a separate RingCentral account during development to keep test traffic isolated from production org accounts. Once the pipeline is verified end-to-end, each org connects their live account via the OAuth flow.

### Local Webhook Testing

```bash
ngrok http 3000
```

Use the generated `https://` URL as the webhook endpoint when registering the RingCentral subscription.
