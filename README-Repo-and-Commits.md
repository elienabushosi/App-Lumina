# Repository and Commits (SaaS Template)

This document describes the SaaS Template repo layout and how to work with commits.

## Local Repository

**Path:** Your clone folder (e.g. `SaaS Template` or `Saas-Template`)

**Current Branch:** `main`

**Remote:** `origin` → `https://github.com/elienabushosi/Saas-Template.git`

## Remote Repository

**GitHub URL:** `https://github.com/elienabushosi/Saas-Template.git`

**Remote Name:** `origin`

**Default Branch:** `main`

## Project Structure (Overview)

The template is a monorepo with two workspaces:

```
SaaS Template/
├── backend/          # Express API (Supabase, Stripe, Resend)
├── frontend/         # Next.js app
├── shared/           # Shared data (e.g. building-class, land-use)
├── package.json      # Root workspace config
├── README.md
├── CHECKLIST-SAAS-BOILERPLATE.md   # How to connect services
├── backend/env.example
└── frontend/env.example
```

### Backend (`/backend`)

- **Config:** `package.json`, `server.js`, `env.example`
- **Lib:** `lib/supabase.js`, `lib/email.js`, `lib/auth-utils.js`, etc.
- **Routes:** `routes/auth.js`, `routes/billing.js`, `routes/reports.js`, `routes/email.js`, etc.
- **DB:** `schema.sql`, `migration-*.sql`

### Frontend (`/frontend`)

- **App:** `app/` (Next.js App Router), `components/`, `lib/`
- **Config:** `package.json`, `env.example`, `next.config.mjs`, `tsconfig.json`

### Files Ignored by Git

- `node_modules/`
- `frontend/.next/`, `frontend/out/`
- `.env*` (all env files – use `env.example` as reference)
- `.DS_Store`, IDE configs, `*.log`

## How to Commit

### Standard workflow

1. **Check status:** `git status`
2. **Stage:** `git add .` or `git add path/to/file`
3. **Commit:** `git commit -m "Your message"`
4. **Push:** `git push origin main`

### Commit message guidelines

- Use clear, descriptive messages
- Start with a verb (Add, Fix, Update, Refactor, etc.)
- Examples:
  - `Add feature X to billing flow`
  - `Fix auth redirect after login`
  - `Update README for deployment`
  - `Refactor report service`

### Useful commands

```bash
git log --oneline -20
git log --pretty=format:"%h - %an, %ar : %s" -20
git show --stat HEAD
git remote -v
git pull origin main
```

## Branch information

**Default branch:** `main`

Work on `main` or create feature branches as needed; push to `origin/main` when ready.

---

**Repository:** SaaS Template  
**Purpose:** Clone-and-go SaaS boilerplate (Supabase, Stripe, Resend disconnected by default)
