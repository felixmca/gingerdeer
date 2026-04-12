# Juice for Teams (Gingerdeer)

B2B web app for **Juice for Teams**: a marketing site and **multi-step subscription funnel** aimed at People Ops / HR buyers who want **recurring ginger juice and shots** as an employee perk. The experience includes a **live delivery calculator** (shots and bottles per drop / month), optional **Supabase** persistence, **authenticated customer dashboards**, **admin tools**, transactional **email via Resend**, and a richer **product catalogue** backed by Postgres.

---

## Features

| Area | What it does |
|------|----------------|
| **Landing & funnel** | Full-page story (`components/landing-page.tsx`) with CTAs that open a **4-step modal**: work contact → ingredient mix → delivery cadence → team size & intensity, plus a **delivery calculator** (`lib/funnel-logic.ts`, `components/funnel-modal.tsx`). |
| **Lead capture** | Submissions can be stored in **`public.leads`** (anonymous insert with RLS). Rows support pricing fields, signup completion, and optional link to **`auth.users`**. |
| **Auth** | Supabase Auth with login (`app/auth/login`), OAuth callback (`app/auth/callback`), and sign-out (`app/auth/signout`). Middleware refreshes the session on navigation. |
| **Customer dashboard** | Post-login area under `app/dashboard/*` (subscriptions, orders, juice types, one-off purchases, reviews, feedback, settings). |
| **Public catalogue** | `app/juice-types` and related components can read **`public.ingredients`** (public read for available SKUs). |
| **API routes** | Server routes under `app/api/lead` and `app/api/subscription` for lead/subscription flows with service-role or server logic where appropriate. |
| **Admin** | `app/admin` gated by **`ADMIN_EMAILS`** (server-side env). |
| **Email** | **Resend** for transactional mail (`lib/email.ts`); requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. |

---

## Tech stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Supabase**: `@supabase/supabase-js`, `@supabase/ssr` (browser client, server client, middleware session refresh)
- **Resend** for outbound email
- **Global CSS** (design tokens in `app/globals.css`), **next/font** (Fraunces, Source Sans 3)

Internal documentation for navigators and LLMs: `codebase-analysis-docs/CODEBASE_KNOWLEDGE.md` (note: some sections may lag the repo; trust the code and `supabase/schema.sql` for schema truth).

---

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- A **Supabase** project (URL + anon/publishable key; **service role** key for server-only operations)
- Optional: **Resend** account for email
- **Git**

---

## Quick start

```bash
git clone https://github.com/felixmca/gingerdeer.git
cd gingerdeer    # or your local folder name, e.g. Juice
cp .env.example .env.local
```

1. Fill **`.env.local`** (see [Environment variables](#environment-variables)). Never commit this file.
2. In Supabase **SQL Editor**, run **`supabase/schema.sql`** (creates/updates `leads`, `ingredients`, `subscriptions`, RLS, grants, seed data for ingredients).
3. Configure **Auth** redirect URLs in Supabase to match **`NEXT_PUBLIC_APP_URL`** (e.g. `http://localhost:3000` for dev).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

---

## Environment variables

Copy from **`.env.example`**. Typical layout:

| Variable | Scope | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser-safe anon JWT (or use publishable key below) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Alternative to anon key if your dashboard uses the newer name |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses RLS for trusted server operations — **never** expose to the client |
| `RESEND_API_KEY` | Server | Send transactional email |
| `RESEND_FROM_EMAIL` | Server | From address (verified domain or Resend sandbox) |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical site URL (no trailing slash); used in emails and OAuth redirects |
| `ADMIN_EMAILS` | Server | Comma-separated emails allowed to use `/admin` |

**Security:** Only `NEXT_PUBLIC_*` keys are embedded in the browser bundle. Treat **`SUPABASE_SERVICE_ROLE_KEY`** and **`RESEND_API_KEY`** like production secrets.

---

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server (Turbopack/webpack per Next defaults) |
| `npm run build` | Production build |
| `npm start` | Run production server locally |
| `npm run lint` | ESLint (if configured) |

---

## Project structure (high level)

```
app/
  page.tsx                 # Home (landing)
  layout.tsx               # Root layout, fonts, metadata
  globals.css              # Global styles
  auth/                    # Login, callback, sign-out
  dashboard/               # Authenticated customer area
  admin/                   # Admin (email allowlist)
  api/                     # lead, subscription REST handlers
  juice-types/             # Public-facing product browsing
components/
  landing-page.tsx
  funnel-modal.tsx
  db-*.tsx                 # Dashboard / DB-backed UI pieces
lib/
  funnel-logic.ts          # Calculator + ingredient metadata
  email.ts                 # Resend integration
  subscription-meta.ts
  supabase/
    client.ts              # Browser Supabase client
    server.ts              # Server component / route cookies client
    middleware.ts          # Session refresh helper
    service.ts             # Service-role client (server only)
middleware.ts              # Next middleware entry
supabase/
  schema.sql               # DDL, RLS, seeds (run manually in SQL Editor)
codebase-analysis-docs/    # Architecture notes and diagrams
```

---

## Database (Supabase)

- **`public.leads`**: funnel submissions; anon **insert**; authenticated **select/update** when `user_id = auth.uid()`.
- **`public.ingredients`**: product catalogue; public **select** for `available = true`; writes via dashboard or service role.
- **`public.subscriptions`**: plans per user; **select** for owner; inserts typically via API/service role.

After changing **`schema.sql`**, re-run the relevant sections in the SQL Editor or adopt Supabase migrations for team workflows.

---

## Deployment

- **Vercel** (or any Node host): set the same env vars as in **`.env.example`**, with **`NEXT_PUBLIC_APP_URL`** pointing to the production domain.
- Add production URL + `/auth/callback` path in **Supabase Auth → URL configuration**.

---

## Security notes

- **`.env.local`** and any file containing real keys must stay out of Git (see **`.gitignore`**).
- Rotate keys if they are ever committed or leaked.
- Prefer **RLS** for all user-facing tables; use **service role** only on the server for operations that must bypass RLS.
- Review **anon** policies (e.g. open `INSERT` on `leads`) for abuse; consider rate limiting or Edge Functions for production.

---

## License

Private / all rights reserved unless you add an explicit `LICENSE` file.
