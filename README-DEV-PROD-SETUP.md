# Development vs Production (SaaS Template)

This document explains how the SaaS Template switches between development and production environments.

## Overview

The project uses environment-specific configuration files (`.env.development` and `.env.production`) that are loaded based on `NODE_ENV`. Copy from `env.example` in each of `backend/` and `frontend/` to create your `.env.development` and `.env.production`; do not commit these files (they are gitignored).

## File structure

```
SaaS Template/
├── backend/
│   ├── env.example           # Copy to .env.development / .env.production
│   ├── .env.development      # Your dev vars (gitignored)
│   ├── .env.production       # Your prod vars (gitignored)
│   ├── .env                  # (Optional) Local overrides (gitignored)
│   └── lib/
│       └── supabase.js       # Loads .env.${NODE_ENV}
├── frontend/
│   ├── env.example           # Copy to .env.development / .env.production
│   ├── .env.development      # Your dev vars (gitignored)
│   ├── .env.production       # Your prod vars (gitignored)
│   ├── .env.local            # (Optional) Local overrides (gitignored)
│   └── (Next.js loads .env.* by NODE_ENV)
└── package.json              # Root scripts for dev/prod
```

## How it works

### Backend

- **Environment:** `NODE_ENV` (default `development`) determines which file is loaded.
- **Files:** `backend/lib/supabase.js` (and dotenv) load `.env.${NODE_ENV}` from `backend/`, then optional `.env` for overrides.
- **Port:** Backend runs on **3002** (set in `env.example` / your `.env.development`).

### Frontend

- Next.js loads `.env.development` when `NODE_ENV=development`, `.env.production` when building/running for production.
- Use `NEXT_PUBLIC_API_URL` for the backend URL (e.g. `http://localhost:3002` in dev, your deployed API URL in prod).

## Environment variables

### Backend (`backend/.env.development` and `backend/.env.production`)

| Variable                     | Development              | Production                    |
|-----------------------------|--------------------------|-------------------------------|
| SUPABASE_URL / keys         | Placeholder or your keys | Your Supabase project        |
| STRIPE_*                    | Test keys or placeholder | Live keys when going live    |
| RESEND_API_KEY              | Optional (unset = no email) | Set for production email  |
| FRONTEND_URL                | `http://localhost:3000`  | `https://yourdomain.com`     |
| PORT                        | `3002`                   | `3002` (or host default)     |
| GEOSERVICE_API_KEY          | Optional                 | Optional                      |

### Frontend (`frontend/.env.development` and `frontend/.env.production`)

| Variable                         | Development              | Production              |
|----------------------------------|--------------------------|-------------------------|
| NEXT_PUBLIC_API_URL              | `http://localhost:3002`  | `https://your-api-url`  |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  | Optional                 | Optional                 |
| NEXT_PUBLIC_STRIPE_*             | Placeholder or test IDs  | Live product/price IDs  |

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## NPM scripts

From **repo root**:

```bash
# Development
npm run dev              # Run both frontend & backend (dev)
npm run dev:frontend     # Frontend only (port 3000)
npm run dev:backend      # Backend only (port 3002)

# Production (local run with prod env)
npm run prod             # Both in prod mode
npm run prod:frontend
npm run prod:backend

# Build frontend for production
npm run build            # next build
```

Backend scripts set `NODE_ENV=development` or `NODE_ENV=production`; frontend uses Next.js defaults.

## Setting up environments

1. **Create env files** (from examples):
   - `backend/.env.development`, `backend/.env.production`
   - `frontend/.env.development`, `frontend/.env.production`

2. **Development:** Start with placeholders from `env.example` so the app runs; replace with real keys when you connect Supabase, Stripe, Resend (see **CHECKLIST-SAAS-BOILERPLATE.md**).

3. **Production (when you deploy):**
   - Set `FRONTEND_URL` and backend vars in your backend host (e.g. Railway).
   - Set `NEXT_PUBLIC_API_URL` and frontend vars in your frontend host (e.g. Vercel).

## Security

- **Do not commit** `.env`, `.env.development`, `.env.production`, or `.env.local` – they are in `.gitignore`.
- **Do commit** `backend/env.example` and `frontend/env.example` (placeholders only, no secrets).
- For production, set real secrets in your hosting platform’s environment (Vercel, Railway, etc.), not in committed files.

## Troubleshooting

- **Backend wrong env:** Ensure `NODE_ENV` is set by the npm script and the correct `.env.development` / `.env.production` exists in `backend/`.
- **Frontend wrong API URL:** Check `NEXT_PUBLIC_API_URL` in the correct `.env` file; restart the Next.js dev server after changes.
- **Env changes not applied:** Restart the backend and/or frontend after editing `.env` files.

## Summary

- **Development:** `npm run dev` → backend and frontend use `.env.development` → API at `http://localhost:3002`.
- **Production:** Use `.env.production` and set the same vars in your deploy host; set `NEXT_PUBLIC_API_URL` to your deployed backend URL.
