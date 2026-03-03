# SaaS Template

A **clone-and-go SaaS boilerplate**. This repo is a disconnected starter: you can clone it and run it locally without any third-party accounts. Connect **Supabase**, **Stripe**, **Resend**, and **Railway** when you’re ready.

## Project structure

```
├── frontend/     # Next.js frontend
├── backend/      # Express.js API
├── package.json  # Root monorepo (npm workspaces)
```

## Prerequisites

- Node.js (v18+ or compatible)
- npm

## Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/elienabushosi/Saas-Template.git
   cd Saas-Template
   ```

2. **Install dependencies**

   ```bash
   npm install
   npm run install:all
   ```

3. **Environment (required to run)**

   - **Backend:** Copy `backend/env.example` to `backend/.env.development`
   - **Frontend:** Copy `frontend/env.example` to `frontend/.env.development`

   Leave the placeholder values as-is to run locally without connecting services. The app will start; auth, billing, and email will only work after you add real keys. See **Connecting services** below.

## Development

- **Frontend only:** `npm run dev` or `npm run dev:frontend`
- **Backend only:** `npm run dev:backend`
- **Both:** `npm run dev:all`

- Frontend: **http://localhost:3000**
- Backend: **http://localhost:3002** (see `backend/env.example`)

## Connecting services

All of these are **disconnected by default**. Use the env files and this checklist when you’re ready to connect:

| Service   | What to do |
|----------|-------------|
| **Env files** | `backend/env.example`, `frontend/env.example` – copy to `.env.development` / `.env.production` and replace placeholders |
| **Checklist** | See **CHECKLIST-SAAS-BOILERPLATE.md** for step-by-step instructions to connect Supabase, Stripe, Resend, and deployment |

- **Supabase:** Create a project, run migrations (e.g. `backend/schema.sql`, `backend/migration-*.sql`), then set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env.development`.
- **Stripe:** Use test keys and test price IDs in dev; set live keys and live price IDs in production env.
- **Resend:** Set `RESEND_API_KEY` (and optionally `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`) when you want to send email.
- **Railway / deploy:** This repo does **not** include a connected Railway (or other) project. You deploy the backend and frontend yourself and set `NEXT_PUBLIC_API_URL` in the frontend to your deployed backend URL (e.g. `https://your-app.up.railway.app`).

## Build

```bash
npm run build
```

Builds the frontend for production.

## Workspaces

- `frontend` – Next.js app  
- `backend` – Express API

## More documentation

- **LOCAL-SETUP.md** – Step-by-step local setup (env, install, run, verify).
- **README-DEV-PROD-SETUP.md** – How dev vs production env and scripts work.
- **README-Repo-and-Commits.md** – Repo layout and commit workflow.
- **CHECKLIST-SAAS-BOILERPLATE.md** – How to connect Supabase, Stripe, Resend, and deploy.
