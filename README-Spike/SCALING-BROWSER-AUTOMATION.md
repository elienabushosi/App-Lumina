# Scaling Browser Automation (Playwright + Gemini / APEX)

Planning notes for taking the proposal pipeline browser automation from dev to production at scale.

---

## Current State (dev)

- One Playwright browser, one job at a time
- Sessions saved as local JSON files: `sessions/{userId}.json`
- Browser automation runs on the same process as the Express API server
- BullMQ queue is in place but concurrency is unconfigured
- MFA is a human-in-the-loop gate (blocks worker for up to 5 minutes)

This works fine in dev. Breaks progressively as you scale.

---

## Where It Breaks

### ~10 agencies
- **Sessions on disk** — any redeployment or new container instance loses all session files. Every agent must MFA again.
- **Browser on API server** — Playwright uses ~150–200MB RAM per instance. Competes with Express under load.
- **Unconfigured concurrency** — jobs can pile up or run unbounded.

### 100s of agencies
- **Memory** — 100 concurrent browsers ≈ 15–20GB RAM. Cannot run on a single server.
- **Worker blocking** — if 100 users hit MFA simultaneously, 100 workers are blocked indefinitely.
- **Session portability** — local JSON files don't work with horizontal scaling. Any worker must be able to restore any user's session.

---

## Target Architecture at Scale

### 1. Separate worker fleet from API server
Browser automation jobs run in dedicated worker containers, not alongside Express.
BullMQ already supports this — workers are separate Node processes pulling from the same Redis queue.

```
API Server (Express)         Worker Fleet
─────────────────────        ──────────────────────────────
POST /api/proposals   ──→    BullMQ Queue (Redis)
GET  /api/proposals/:id       ↓
                             Worker 1 (Playwright × 3 concurrent)
                             Worker 2 (Playwright × 3 concurrent)
                             Worker N ...
```

### 2. Move sessions to cloud storage
Replace `sessions/{userId}.json` on disk with a `salesforce_sessions` table in Supabase (or S3).
Keyed by `userId`. Any worker on any machine can restore any user's session.

```sql
create table salesforce_sessions (
  id_user      text primary key,
  session_json jsonb not null,
  updated_at   timestamptz not null default now()
);
```

On save:  `context.storageState()` → JSON → upsert into DB
On restore: read from DB → write temp file → `newContext({ storageState: tmpPath })`

### 3. Configure BullMQ concurrency
Set a per-worker concurrency limit so you don't accidentally run 50 browsers on one server:

```js
const worker = new Worker('proposals', handler, { concurrency: 3 });
```

Then scale horizontally — 10 workers × 3 concurrent = 30 simultaneous automations.

### 4. Fix MFA blocking
Today MFA parks the job thread for up to 5 minutes. At scale this starves the worker pool.

Better pattern:
- When MFA is detected, save job state and move it to a `waiting_mfa` queue
- Free the worker immediately
- When human submits the code, resume the job (re-hydrate state, continue from MFA step)

BullMQ supports job delays and re-queuing natively.

### 5. Container-per-worker (at true scale)
Spin up ephemeral containers per job via AWS ECS, Fly.io, or similar:
- Each container gets a fresh Playwright install
- Runs one job, saves session back to DB/S3, terminates
- No shared state between jobs

---

## Salesforce-Specific Notes

- SF rate-limits per session, not per IP — 100 separate user sessions is fine
- The risk is 100 users all triggering MFA simultaneously and blocking workers
- Session persistence (30-day cookies) is the primary mitigation — most runs skip MFA entirely
- Never share sessions across users — one session file per `userId`

---

## Recommended Build Order (when scale becomes real)

1. **Move sessions to Supabase** — small change, huge portability impact. Do this before first real customer.
2. **Set `concurrency: 2–3`** on the BullMQ worker — prevents accidental runaway.
3. **Split worker process from API server** — separate Dockerfile/deployment target.
4. **Fix MFA blocking** — move to a waiting queue instead of sleeping in the worker.
5. **Container-per-job** — only needed at 50+ concurrent agencies.
