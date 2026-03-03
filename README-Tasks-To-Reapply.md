## Tasks to Reapply After Reset

This file summarizes the edits we made during the last session so they can be systematically re‑applied if needed. Treat these as a checklist.

### 1. Docs, repo, and env setup

- **Docs cleanup and template context**
  - Update `README.md` to describe this as a generic SaaS Template rather than the original Clermont product.
  - Update `README-DEV-PROD-SETUP.md` with:
    - How to run frontend and backend locally.
    - How to connect or *not* connect Supabase, Stripe, Resend, Railway (placeholders are fine).
  - Update `README-Repo-and-Commits.md` to:
    - Describe the new repo history.
    - Document the expected commit style and branching.
  - Remove/ignore Clermont‑specific docs and migration READMEs that don’t apply to the template.

- **Env files**
  - Ensure `frontend/.env.development`:
    - Uses placeholder values for API URL, Stripe IDs, Google Maps key, etc.
    - Includes `NEXT_PUBLIC_BYPASS_AUTH=1` for local dev.
  - Ensure `frontend/env.example` documents all required `NEXT_PUBLIC_*` vars and the auth bypass flag.

### 2. Auth bypass for local development

- **Workspace layout (`frontend/app/(workspace)/layout.tsx`)**
  - Add a development‑only bypass before any token checks:
    - Compute `isDevBypassAuth` as:
      - `process.env.NODE_ENV === "development"` and
      - `process.env.NEXT_PUBLIC_BYPASS_AUTH === "1"`.
    - When `isDevBypassAuth` is true:
      - Set `userData` to a dummy user/organization (e.g. “Dev User”, “Dev Organization”).
      - Set `isAuthenticated` to `true` and `isChecking` to `false`.
      - `return` early from `checkAuth`.
  - Keep the existing production path:
    - If no token: redirect to `/login`.
    - If token invalid: clear token, redirect to `/login`.
    - Otherwise: call `getCurrentUser()` and populate `userData`.

### 3. Landing / marketing site boilerplate

- **Global layout & styling**
  - In `frontend/app/layout.tsx` and shared landing components:
    - Replace “Clermont”/product‑specific copy with boilerplate:
      - Hero: “Accomplish anything with Company Name” and a generic supporting sentence.
      - CTA button text like “Try For Free”.
    - Update pricing anchor link to use `#pricing` and ensure scrolling is smooth (e.g. `scroll-behavior: smooth` in `globals.css`).

- **Sections & components**
  - Replace feature/benefit copy with generic values:
    - Use placeholders like “Value Proposition 1/2/3” and “VP Description 1/2/3”.
  - Replace pricing card feature lists with generic “Feature 1/2/3”.
  - Replace FAQ questions/answers with:
    - `FAQ Question 1–5` and `FAQ Answer 1–5` plus short placeholder descriptions.
  - Update footer:
    - Company name → `Company Name`.
    - Tagline → `Tagline or short description for your product.`.

### 4. Address input simplification

- **`frontend/components/address-autocomplete.tsx`**
  - Ensure this is a plain text input (no Google Maps integration):
    - On blur / Enter, call `onAddressSelect` with a minimal payload:
      - `formatted_address` as the typed value.
      - Empty or placeholder fields for anything map‑specific.
  - Remove or neutralize any New York–specific borough checks or zoning hints.

### 5. Workspace route & page simplifications

- **Routing changes**
  - Remove the old `report-options` route.
  - Add an `information-gather` route and wire any links that previously pointed to `report-options` to `/information-gather`.
  - Remove the old `signupsearch` route.
  - Add a `signupbytrying` route and wire the flow:
    - `/information-gather` → Continue → `/signupbytrying`.

- **Information gather page (`frontend/app/information-gather/page.tsx`)**
  - Use neutral boilerplate:
    - Heading: “Page Description”.
    - Three choices labeled `Option 1`, `Option 2`, `Option 3`.
    - A primary button that continues to `/signupbytrying`.

- **Signup by trying page (`frontend/app/signupbytrying/page.tsx`)**
  - Create a signup form with:
    - Email, password, and confirm password fields.
    - Eye/visibility toggle icons on password and confirm‑password fields.
    - Validation that password and confirm password match (with a user‑visible error).

- **Simplify workspace content pages**
  - `frontend/app/(workspace)/home/page.tsx`
  - `frontend/app/(workspace)/search-address/page.tsx`
  - `frontend/app/(workspace)/reports/page.tsx`
  - For each, replace complex Clermont UI with:
    - A simple heading explaining that this is a placeholder.
    - Short TODO comments indicating:
      - Add proper auth token handling.
      - Fetch real data from backend/DB.
      - Replace view using Shadcn UI components (tables, filters, etc.).

- **Remove Land Assemblage workspace page**
  - Delete `frontend/app/(workspace)/land-assemblage/page.tsx`.
  - Remove the “Land Assemblage” item from:
    - The workspace sidebar.
    - Any `getPageTitle` logic that returns “Land Assemblage”.

### 6. Demo dashboard list page (`demo-report-list`)

- **Route & layout**
  - Ensure `/demo-report-list` is accessible from the workspace sidebar.
  - Update `getPageTitle` in `(workspace)/layout.tsx` so:
    - `/demo-report-list` → “Sample Dashboard” (or similar neutral title).

- **Boilerplate metrics**
  - In `frontend/app/(workspace)/demo-report-list/page.tsx`:
    - Change the greeting section to a neutral heading like `Sample Dashboard` instead of “Hi Elie”.
    - Replace “Report Dashboard” and “Insights” with a single “Metrics” section containing three cards:
      - `Metric 1`, `Metric 2`, `Metric 3`.
      - Each shows a placeholder value (e.g. `—`) and short helper text like “Placeholder value”.

- **Items table section**
  - Section title: change `Sample Reports` → `Items`.
  - Table column headings:
    - `Address` → `List`.
    - Remove the `Zoning` column entirely (header + cell).
  - Dummy data:
    - Use boilerplate items and people:
      - `Item 1`, `Item 2`, `Item 3`, … for the `address`/list field.
      - `Person 1`, `Person 2`, `Person 3`, … for the `clientName`.
    - Keep `status`, `createdAt`, and the `View Report` button behavior.
  - Clean up icon imports:
    - Remove any unused icons like `MapPin`, `Building2`, `Sparkles` if no longer referenced.

### 7. Demo detail report page (`demo-report/[id]`)

- **Header & navigation**
  - In `frontend/app/(workspace)/demo-report/[id]/page.tsx`:
    - Change the main title from “Property Zoning Report” → `Sample Item Report`.
    - Change the back button text from “Back to Your Reports” → `Back to Items`, keeping the same route (`/demo-report-list`).
    - Keep existing icons and the share button behavior.

- **Boilerplate data object**
  - Replace the `propertyData` object with fully generic values:
    - `address` → `Item 1`.
    - All nested fields (`lotDetails`, `zoning`, `zoningDetails`, `buildingInfo`, `landUse`, etc.) use neutral placeholders:
      - `Sample value 1/2/3…`
      - `Sample classification`, `Sample designation`, etc.
      - Short boilerplate descriptions instead of zoning jargon.
    - `allowedUses`, `restrictedUses`, and `feasibleOptions`:
      - Rename entries to `Example allowed use X`, `Example restricted use X`, and `Scenario 1/2/3` with short neutral descriptions and considerations.

- **Section titles and labels**
  - Rename cards:
    - “Property Location” → `Item Overview`.
    - “Lot Details” → `Item Details`.
    - “Zoning Classification” → `Section A`.
    - “Building Lot Information” → `Section B`.
    - “Land Use Designation” → `Section C`.
    - “Zoning Constraints & Requirements” → `Section D`.
    - “Allowed Uses” → `Highlights`.
    - “Restricted Uses” → `Limitations`.
    - “Feasible Development Options” → `Scenarios`.
  - For Sections B, C, and D, change field‑level labels to boilerplate:
    - Use `Label 1`, `Label 2`, `Label 3`, etc. instead of “Year Built”, “Number of Units”, “Designation”, etc.
    - Where a group of fields exists (e.g. front/side/rear), use `Sub-label 1/2/3`.
    - Helper paragraphs should be generic, e.g. “Sample description for this field.”

### 8. Login page & auth UI polish

- **Login page (`frontend/app/login/page.tsx`)**
  - Update heading/copy to generic wording:
    - Title: `Login`.
    - Generic subtext about accessing your account.
  - Optionally add the logo above the heading for nicer visual hierarchy.

---

Once you start reapplying these tasks, it’s a good idea to:

1. Work through this list top‑to‑bottom and check off items as you go.
2. Create a commit after each logical group (e.g. “Boilerplate demo dashboard”, “Boilerplate demo detail report”, “Auth bypass for dev”) so this work is saved in git history.

