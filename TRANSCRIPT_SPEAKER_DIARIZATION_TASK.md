# Task: Speaker-Labeled Transcript (Deepgram Diarization)

## Context
We currently transcribe RingCentral call recordings with **Deepgram diarization** enabled and store:

- `call_recordings.transcript` (a single plain string)
- `call_recordings.transcript_words` (word-level objects that include `speaker`, `start`, `end`)

Deepgram diarization is configured in:

- `backend/lib/deepgram.js` (`diarize: "true"`)
- `backend/lib/recording-processor.js` (stores `transcript_words` into Supabase)

However, the **Call Details → Transcript** UI currently renders only `call.transcript` (string), so users don’t see “who spoke when”.

## Goal
Display the transcript in a conversational format that **labels each spoken segment** with:

- Speaker label (ex: `Agent` / `Caller`, or `Speaker 0` / `Speaker 1`)
- Segment text (grouped from `transcript_words`)
- (Optional) timestamps per segment using `start`/`end`

The UI should fall back gracefully:

- If `transcript_words` is missing/null, continue showing `transcript` as-is.

## Current Data / Gaps
1. **Backend API gap:** `GET /api/calls/:id` selects `transcript` but (likely) does not select `transcript_words`.
2. **UI gap:** `frontend/app/(workspace)/calls/[id]/page.tsx` Transcript card renders only `call.transcript`.
3. **Speaker-role mapping:** Deepgram gives numeric speaker ids (e.g. `speaker: 0`, `speaker: 1`), but we need to map those to “Agent vs Caller”.

## Speaker Mapping (Initial Heuristic)
We need an initial rule to map Deepgram’s `speaker` ids to roles. Suggested approach:

1. Default heuristic:
   - `speaker === 0` → `Agent`
   - `speaker === 1` → `Caller`
2. Optional improvement:
   - If roles are ambiguous, we can infer from phone directions or `call.from_name` / `call.to_name`
   - Or later: add an AI-based mapping step (small prompt) using the transcript excerpt.

For now, implement the simplest deterministic mapping and make it configurable so we can refine later.

## Approach

### Step 1: Expose `transcript_words` via the API
Update `backend/routes/calls.js` so `GET /api/calls/:id` returns `transcript_words` (and not just `transcript`).

Acceptance criteria:
- Transcript page has access to `call.transcript_words`
- No breaking changes to existing fields

### Step 2: Convert word-level diarization into “turns”
Create a helper to transform `transcript_words` into an ordered array of segments:

- Iterate through `transcript_words` in order.
- Whenever `speaker` changes, close the current segment and open a new one.
- Segment object shape (suggested):
  - `speakerId: number`
  - `start: number` (optional but useful)
  - `end: number` (optional)
  - `text: string` (join words with spacing rules)

Spacing considerations:
- Deepgram words may include punctuation via `punctuated_word`; we should ensure the join doesn’t produce extra spaces before punctuation.

Where to compute turns:
- Prefer **server-side** (if we want to minimize client work).
- Alternatively, compute client-side with a small utility (acceptable for moderate transcripts).

### Step 3: Render speaker-labeled transcript in the UI
Update `frontend/app/(workspace)/calls/[id]/page.tsx` Transcript card to render turn segments instead of a single string.

UI presentation options (choose one; Shadcn UI compatible):

1. **Conversation list (recommended)**
   - Each turn rendered as a row/bubble
   - Speaker label shown via `Badge`
   - Turn text shown underneath or to the side
   - Use `ScrollArea` to keep transcript height constrained (`max-h-[360px]` style parity)

2. **Accordion per turn**
   - Use `Accordion` so each turn can expand/collapse
   - Speaker label + timestamp in trigger
   - Text in content
   - Useful if turns are long, but more clicks

3. **Two-column layout**
   - One column for Agent, one for Caller
   - More complex because it removes chronological flow

### Step 4: Fallback behavior
If `transcript_words` is null/empty:
- Render `call.transcript` exactly as it does today.

## Libraries / UI Stack Considerations
This repo uses **Shadcn UI** components (Radix-based wrappers) under `frontend/components/ui/*`.

For this task, likely components:
- `ScrollArea` (Transcript container)
- `Badge` (Speaker label: Agent/Caller)
- `Accordion` (optional alternative UI)
- `Card` (optional if we refactor the transcript section)

## Files Likely to Change
- `backend/routes/calls.js`
  - Select `transcript_words` for `GET /api/calls/:id`
- `backend/lib/*` (optional)
  - Add a `buildTranscriptTurns(transcriptWords)` helper
- `frontend/app/(workspace)/calls/[id]/page.tsx`
  - Replace plain transcript string with speaker-labeled rendering
- `frontend/components/*` (optional)
  - New component like `SpeakerLabeledTranscript` for clean separation

## Success Criteria
1. Users see transcript text grouped by speaker turns.
2. Speaker labels are displayed and readable.
3. No regression when `transcript_words` are missing.
4. UI remains performant and scrollable.

## Notes / Open Questions (for later refinement)
- Deepgram may output >2 speaker ids. Decide whether to:
  - label any additional speakers as `Speaker 2`, `Speaker 3`, etc.
  - or merge beyond 2 into caller/agent buckets heuristically.
- Confirm whether `transcript_words` ordering matches natural reading order.
- Validate punctuation spacing rules when joining tokens into segments.

