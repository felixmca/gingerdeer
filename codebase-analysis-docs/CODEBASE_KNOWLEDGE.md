# Juice for Teams — Codebase Knowledge (Master Document)

**INDEX_VERSION:** 2.0  
**Repo:** `juice-for-teams` (package name) — workspace folder named "Juice"; code is TypeScript/Next.js.  
**Last fully analyzed:** 2026-04-15  
**Root path:** `/mnt/c/Users/felix/Desktop/Python Projects/Juice`

> This document is written so any LLM or engineer with no repo access can understand the full system. All paths are relative to the repo root.

---

## 1. What the application is

**Juice for Teams** is a B2B SaaS MVP targeting HR/People Ops teams who want to offer ginger juice shots and bottles as an employee perk. It is at the **lead-capture + early-auth stage** — no Stripe/payment, no real subscription fulfilment yet.

### User journeys

| User type | Journey |
|-----------|---------|
| **Anonymous visitor** | Lands on `/`, opens funnel modal, submits lead → gets quote email, redirected to sign up |
| **Authenticated user** | Logs in → dashboard → configures recurring subscription or places one-off order |
| **Admin** | Visits `/admin` → sees all leads table |

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router) |
| UI | **React 19**, TypeScript |
| Backend data | **Supabase** (auth + Postgres) via `@supabase/ssr` |
| Email | **Resend** (`resend` npm package) |
| Styling | **Plain CSS** (globals.css, ~3400 lines) — no Tailwind |
| Fonts | `next/font/google`: **Fraunces** (serif, headlines) + **Outfit** (sans, body/UI) |
| Deployment | Vercel (inferred from env var docs) |

---

## 3. Directory structure

```
app/
  layout.tsx                     # Root layout: fonts, global metadata
  page.tsx                       # / → <LandingPage />
  globals.css                    # ALL styles (CSS variables, layout, modal, dashboard, settings, etc.)
  admin/
    page.tsx                     # /admin — leads table, admin-only server page
  api/
    account/
      route.ts                   # PATCH /api/account — update display name
    address/
      route.ts                   # GET + POST /api/address
      [id]/
        route.ts                 # PATCH + DELETE /api/address/[id]
    lead/
      route.ts                   # POST /api/lead
      [id]/
        route.ts                 # PATCH /api/lead/[id]
    subscription/
      route.ts                   # GET + POST /api/subscription
      [id]/
        route.ts                 # PATCH /api/subscription/[id]
  auth/
    callback/
      route.ts                   # GET /auth/callback — OAuth code exchange + lead linking
    login/
      page.tsx                   # /auth/login — Google OAuth + email/password
    signout/
      route.ts                   # GET /auth/signout — signs out, redirects to /
  dashboard/
    layout.tsx                   # Auth guard + sidebar + topbar shell
    page.tsx                     # /dashboard — product bento + quick links
    feedback/
      page.tsx                   # Placeholder (coming soon)
    juice-types/
      page.tsx                   # /dashboard/juice-types → DbJuiceTypesPage
    one-off/
      page.tsx                   # /dashboard/one-off → DbOneOffPage
    orders/
      page.tsx                   # /dashboard/orders → DbOrdersPage
    reviews/
      page.tsx                   # Placeholder (coming soon)
    settings/
      page.tsx                   # /dashboard/settings → DbSettingsPage (server-fetches user, passes down)
    subscriptions/
      page.tsx                   # /dashboard/subscriptions → DbSubscriptionPage
  juice-types/
    page.tsx                     # /juice-types — public product catalog page

components/
  landing-page.tsx               # Full marketing landing page (client); opens FunnelModal
  funnel-modal.tsx               # 4-step lead funnel (client); anon + logged-in paths
  db-sidebar-nav.tsx             # Dashboard sidebar nav (client; reads pathname, localStorage collapse)
  db-orders-page.tsx             # Orders page UI (client)
  db-subscription-page.tsx       # Subscriptions list + filter + new sub modal (client)
  db-subscription-modal.tsx      # "New subscription" modal — re-uses funnel logic (client)
  db-subscription-detail-modal.tsx  # Subscription detail + status controls (client)
  db-one-off-page.tsx            # One-off orders list + new order trigger (client)
  db-one-off-modal.tsx           # One-off order creation modal — 3 steps (client)
  db-juice-types-page.tsx        # Product catalog component (client)
  db-settings-page.tsx           # Settings: Account + Addresses tabs (client)
  db-product-carousel.tsx        # Product carousel component (client)

lib/
  funnel-logic.ts                # Pure math: computePlan(), pricing constants, INGREDIENT_META
  subscription-meta.ts           # Types + display helpers for subscriptions (SubRow, SLUG_META, etc.)
  address.ts                     # Types + formatting helpers for addresses (AddressRow, addressBlock, etc.)
  email.ts                       # Resend email templates: sendStep1Email, sendQuoteEmail
  supabase/
    client.ts                    # Browser Supabase client (anon key)
    server.ts                    # Server Supabase client (anon key + cookies)
    middleware.ts                # updateSession() for edge middleware
    service.ts                   # Service-role client (server-only, bypasses RLS)

middleware.ts                    # Edge middleware entry point (delegates to updateSession)
supabase/
  schema.sql                     # Authoritative DDL + RLS + grants (run manually in Supabase SQL Editor)
codebase-analysis-docs/          # Documentation (this folder)
  CODEBASE_KNOWLEDGE.md
  assets/
    architecture.mmd
    schema-er.mmd
```

---

## 4. Database schema (complete & authoritative)

All tables are in the `public` schema. Run `supabase/schema.sql` in Supabase SQL Editor to (re-)create everything.

### 4.1 `public.leads`

Stores funnel submissions. Both anonymous and authenticated paths write here.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| created_at | timestamptz | not null, default now() | |
| email | text | not null | |
| company | text | not null | |
| role | text | nullable | e.g. "HR Manager" |
| ingredients | text[] | not null, default '{}' | Array of ingredient slugs |
| frequency | text | nullable | 'weekly' \| 'biweekly' \| 'monthly' |
| quantity_tier | text | nullable | Multiplier string: '0.5' \| '1.0' \| '1.5' \| '2.0' |
| team_size | int | nullable | |
| shots_per_drop | int | not null, default 0 | 100ml shots per delivery |
| bottles_per_drop | int | not null, default 0 | 1L bottles per delivery |
| shots_per_month | int | not null, default 0 | |
| bottles_per_month | int | not null, default 0 | |
| price_per_drop_ex_vat | numeric(10,2) | nullable | |
| price_per_month_ex_vat | numeric(10,2) | nullable | |
| vat_per_month | numeric(10,2) | nullable | |
| total_per_month_inc_vat | numeric(10,2) | nullable | |
| signup_complete | boolean | not null, default false | Set to true when user creates account |
| user_id | uuid | nullable, FK → auth.users(id), ON DELETE SET NULL | Linked after sign-up |

**RLS policies:**
- `leads_insert_anon` — FOR INSERT TO anon WITH CHECK (true) — anyone can insert
- `leads_select_owner` — FOR SELECT TO authenticated USING (user_id = auth.uid())
- `leads_update_owner` — FOR UPDATE TO authenticated USING (user_id = auth.uid())

**Grants:** anon: INSERT; authenticated: SELECT, UPDATE

---

### 4.2 `public.ingredients`

Product catalogue. Read-only for clients; managed via Supabase dashboard or service role.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| slug | text | UNIQUE — matches keys in leads.ingredients[] and app code |
| name | text | e.g. "All-in-one" |
| format | text | CHECK in ('shot', 'share') |
| size_ml | int | 100 for shots, 1000 for share |
| servings_per_unit | int | 1 for shots, 10 for 1L bottles |
| price_ex_vat | numeric(10,2) | |
| price_per_serving_ex_vat | numeric(10,2) | GENERATED: price_ex_vat / servings_per_unit |
| unit_label | text | e.g. "100ml shot" |
| sort_order | int | |
| available | boolean | default true |
| created_at | timestamptz | |

**Seed data (8 rows):**

| slug | name | format | size_ml | servings | price_ex_vat |
|------|------|--------|---------|----------|--------------|
| allinone_shot | All-in-one | shot | 100 | 1 | £3.50 |
| allinone_share | All-in-one | share | 1000 | 10 | £25.00 |
| lemon_ginger_honey_shot | Lemon, Ginger, Honey | shot | 100 | 1 | £3.50 |
| lemon_ginger_honey_share | Lemon, Ginger, Honey | share | 1000 | 10 | £25.00 |
| apple_ginger_shot | Apple Ginger | shot | 100 | 1 | £3.50 |
| apple_ginger_share | Apple Ginger | share | 1000 | 10 | £25.00 |
| turmeric_shot | Turmeric Boost | shot | 100 | 1 | £3.50 |
| turmeric_share | Turmeric Boost | share | 1000 | 10 | £25.00 |

**RLS:** Anyone (including anon) can SELECT WHERE available = true. No writes from clients.

---

### 4.3 `public.subscriptions`

Subscription plans created by authenticated users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| created_at | timestamptz | |
| user_id | uuid | not null, FK → auth.users, ON DELETE CASCADE |
| ingredients | text[] | |
| frequency | text | 'weekly' \| 'biweekly' \| 'monthly' |
| team_size | int | default 1 |
| quantity_tier | text | Multiplier: '0.5' \| '1.0' \| '1.5' \| '2.0' — default '1' |
| shots_per_drop | int | |
| bottles_per_drop | int | |
| shots_per_month | int | |
| bottles_per_month | int | |
| price_per_drop_ex_vat | numeric(10,2) | nullable |
| price_per_month_ex_vat | numeric(10,2) | nullable |
| vat_per_month | numeric(10,2) | nullable |
| total_per_month_inc_vat | numeric(10,2) | nullable |
| status | text | CHECK in ('pending','active','paused','cancelled'), default 'pending' |
| lead_id | uuid | nullable, FK → public.leads, ON DELETE SET NULL |

**RLS:** authenticated can SELECT WHERE user_id = auth.uid(). Inserts are service-role only.  
**Grants:** authenticated: SELECT; service role: full (bypasses RLS).

---

### 4.4 `public.addresses`

Billing and delivery addresses for authenticated users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| created_at | timestamptz | |
| user_id | uuid | not null, FK → auth.users, ON DELETE CASCADE |
| type | text | CHECK in ('billing','delivery') |
| label | text | nullable — optional nickname e.g. "Main Office" |
| line1 | text | not null |
| line2 | text | nullable |
| city | text | not null |
| postcode | text | not null |
| country | text | not null, default 'GB' |
| is_default | boolean | not null, default false; one default per type per user (enforced app-side) |

**Index:** addresses_user_id_idx on (user_id)  
**RLS:** authenticated can SELECT/INSERT/UPDATE/DELETE WHERE user_id = auth.uid()  
**Grants:** authenticated: SELECT, INSERT, UPDATE, DELETE

---

## 5. SQL Navigation Guide

### Browse leads (admin queries)

```sql
-- All leads, newest first
SELECT id, created_at::date, email, company, role, ingredients,
       frequency, team_size, total_per_month_inc_vat, signup_complete
FROM public.leads
ORDER BY created_at DESC;

-- Only converted (has account)
SELECT * FROM public.leads WHERE signup_complete = true ORDER BY created_at DESC;

-- Leads without accounts yet
SELECT * FROM public.leads WHERE signup_complete = false ORDER BY created_at DESC;

-- Revenue estimate from leads
SELECT SUM(total_per_month_inc_vat) AS pipeline_mrr FROM public.leads;

-- Leads linked to a specific user
SELECT l.*, u.email AS auth_email
FROM public.leads l
JOIN auth.users u ON l.user_id = u.id
WHERE u.email = 'someone@company.com';
```

### Browse subscriptions

```sql
-- All subscriptions with user email
SELECT s.id, s.created_at::date, u.email, s.status, s.frequency,
       s.team_size, s.total_per_month_inc_vat
FROM public.subscriptions s
JOIN auth.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;

-- Active subscriptions only
SELECT * FROM public.subscriptions WHERE status = 'active';

-- MRR from active subscriptions
SELECT SUM(total_per_month_inc_vat) AS mrr
FROM public.subscriptions
WHERE status = 'active';
```

### Browse addresses

```sql
-- All addresses for a user
SELECT * FROM public.addresses WHERE user_id = '<user-uuid>' ORDER BY type, is_default DESC;

-- Default delivery addresses
SELECT a.*, u.email
FROM public.addresses a
JOIN auth.users u ON a.user_id = u.id
WHERE a.type = 'delivery' AND a.is_default = true;
```

### User lookup (auth.users — service role only)

```sql
-- List all users
SELECT id, email, created_at, last_sign_in_at, raw_user_meta_data->>'full_name' AS name
FROM auth.users
ORDER BY created_at DESC;

-- Find user by email
SELECT id, email, created_at FROM auth.users WHERE email = 'someone@company.com';
```

### Product catalogue

```sql
-- All available products
SELECT slug, name, format, size_ml, price_ex_vat, price_per_serving_ex_vat
FROM public.ingredients
WHERE available = true
ORDER BY sort_order;
```

---

## 6. API Routes (complete reference)

All routes live under `app/api/`. Auth is validated server-side via Supabase SSR (cookie session). DB writes use the service role client to bypass RLS.

### Lead routes

#### `POST /api/lead`
Create a new lead (step 1 of funnel, or full fallback on step 4 if no leadId).

**Request body:**
```json
{
  "email": "hr@company.com",
  "company": "Acme Inc.",
  "role": "HR Manager",
  // Optional — included when isFull (step 4 fallback):
  "ingredients": ["allinone_shot"],
  "frequency": "monthly",
  "quantity_tier": "1.0",
  "team_size": 50,
  "shots_per_drop": 50,
  "bottles_per_drop": 0,
  "shots_per_month": 50,
  "bottles_per_month": 0,
  "price_per_drop_ex_vat": 175.00,
  "price_per_month_ex_vat": 175.00,
  "vat_per_month": 35.00,
  "total_per_month_inc_vat": 210.00
}
```
**Response:** `{ "leadId": "<uuid>" }`  
**Side effects:** Sends step1 email (partial) or quote email (full) via Resend.

---

#### `PATCH /api/lead/[id]`
Update lead with full plan (step 4, when leadId exists from step 1).

**Request body:** Same "full" fields as above (no email/company — fetched from DB).  
**Response:** `{ "ok": true }`  
**Side effects:** Sends quote email.

---

### Subscription routes

#### `GET /api/subscription`
Returns all subscriptions for the authenticated user.

**Auth:** Required  
**Response:** `{ "subscriptions": SubRow[] }`

---

#### `POST /api/subscription`
Creates a new pending subscription for the authenticated user (called from funnel when logged in).

**Auth:** Required  
**Request body:** Same plan fields as lead (no email/company), plus optional `lead_id`.  
**Response:** `{ "subscription": SubRow }`

---

#### `PATCH /api/subscription/[id]`
Updates a subscription owned by the authenticated user.

**Auth:** Required; ownership verified  
**Allowed fields:** `status`, `ingredients`, `frequency`, `team_size`, `quantity_tier`, `shots_per_drop`, `bottles_per_drop`, `shots_per_month`, `bottles_per_month`, `price_per_drop_ex_vat`, `price_per_month_ex_vat`, `vat_per_month`, `total_per_month_inc_vat`  
**Response:** `{ "subscription": SubRow }`

---

### Address routes

#### `GET /api/address?type=delivery|billing`
Returns saved addresses for the authenticated user.

**Auth:** Required  
**Query params:** `type` (optional — if omitted, returns all)  
**Response:** `{ "addresses": AddressRow[] }` — sorted: default first, then by created_at asc

---

#### `POST /api/address`
Creates a new address.

**Auth:** Required  
**Request body:**
```json
{
  "type": "delivery",
  "label": "Main Office",
  "line1": "22 Tech Street",
  "line2": "Floor 3",
  "city": "London",
  "postcode": "EC1A 1BB",
  "country": "GB",
  "is_default": true
}
```
**Behavior:** If `is_default: true`, unsets previous default of the same type.  
**Response:** `{ "address": AddressRow }`

---

#### `PATCH /api/address/[id]`
Updates an address (ownership checked).

**Auth:** Required  
**Allowed fields:** `label`, `line1`, `line2`, `city`, `postcode`, `country`, `is_default`  
**Response:** `{ "address": AddressRow }`

---

#### `DELETE /api/address/[id]`
Deletes an address (ownership checked).

**Auth:** Required  
**Response:** `{ "ok": true }`

---

### Account route

#### `PATCH /api/account`
Updates the authenticated user's display name (`user_metadata.full_name`).

**Auth:** Required  
**Request body:** `{ "display_name": "Felix McAuliffe" }`  
**Response:** `{ "ok": true }`

---

### Auth routes

#### `GET /auth/callback`
Supabase OAuth callback. Exchanges code for session, auto-links lead by email, redirects to `/dashboard` (or `?next=` param).

#### `GET /auth/signout`
Signs out the user via Supabase, redirects to `/`.

---

## 7. Authentication architecture

```
lib/supabase/client.ts   — createClient()             → browser, anon key, no cookies
lib/supabase/server.ts   — createClient()             → server components/routes, anon key + cookies
lib/supabase/middleware.ts — updateSession()           → edge, refreshes auth cookies on every request
lib/supabase/service.ts  — createServiceClient()      → server-only, SERVICE_ROLE key, bypasses RLS
```

**Pattern in API routes:**
1. `createClient()` (server) → `supabase.auth.getUser()` — validate session
2. `createServiceClient()` (service) → perform actual DB operation

**Admin check** (`/admin/page.tsx`):
```typescript
function isAdmin(email: string | undefined): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return adminEmails.includes(email?.toLowerCase() ?? "");
}
```

**Lead auto-linking** happens in two places:
1. `/auth/callback` route — after OAuth/email confirmation
2. `dashboard/layout.tsx` — on every dashboard load as a safety net

---

## 8. Frontend architecture

### Client vs Server components

| Component | Type | Why |
|-----------|------|-----|
| `app/layout.tsx` | Server | Static fonts/metadata |
| `app/page.tsx` | Server (delegates) | Thin wrapper |
| `app/dashboard/layout.tsx` | **Server** | Auth guard, lead linking, passes user data to children |
| `app/dashboard/settings/page.tsx` | **Server** | Fetches user metadata to pass as props |
| `components/landing-page.tsx` | **Client** | Manages funnel open state |
| `components/funnel-modal.tsx` | **Client** | Multi-step form, API calls |
| `components/db-sidebar-nav.tsx` | **Client** | Pathname active state, localStorage collapse |
| `components/db-subscription-page.tsx` | **Client** | Fetches subscriptions, filters, modals |
| `components/db-settings-page.tsx` | **Client** | Tab state, address CRUD |
| `components/db-one-off-modal.tsx` | **Client** | Fetches saved addresses, optional save |
| `app/admin/page.tsx` | **Server** | Auth+admin check, fetches all leads |

### Funnel modal — two paths

**Anonymous user:**
1. Step 1 → POST /api/lead → get leadId
2. Steps 2–4 → local state
3. Step 4 submit → if leadId: PATCH /api/lead/[id]; else: POST /api/lead (full)
4. Success → "complete account sign up" CTA → /auth/login

**Logged-in user (`loggedIn` prop = true):**
1. Step 1 is skipped (email/company prefilled, jumps to step 2)
2. Steps 2–4 → local state
3. Step 4 submit → POST /api/subscription (creates pending subscription)
4. Success → "View subscription" CTA → /dashboard/subscriptions

### One-off orders (important caveat)

`DbOneOffPage` / `DbOneOffModal` are **frontend-only**. Orders live in React state only and are lost on refresh. The modal does:
- Fetch `GET /api/address?type=delivery` to populate address picker
- Optionally POST to `/api/address` to save a new address
- **No order is persisted to DB** — this is a UI scaffold for future implementation.

---

## 9. Pricing and product logic

All in `lib/funnel-logic.ts`:

```typescript
SHOT_PRICE_EX_VAT  = £3.50   // per 100ml shot
BOTTLE_PRICE_EX_VAT = £25.00  // per 1L share bottle
VAT_RATE = 0.20 (20%)

MULT_STEPS = [0.5, 1.0, 1.5, 2.0]  // per-person quantity multipliers
// These are stored as strings in DB (quantity_tier column)

FREQ_DELIVERIES_PER_MONTH = {
  weekly:   52/12  ≈ 4.33
  biweekly: 26/12  ≈ 2.17
  monthly:  1
}

computePlan(ingredientKeys, multiplier, team, freq) → Plan {
  shotsPerDrop   = round(team × shotsPerPerson × multiplier)
  bottlesPerDrop = round(team × bottlesPerPerson × multiplier)
  shotsMonth     = round(shotsPerDrop × deliveriesPerMonth)
  bottlesMonth   = round(bottlesPerDrop × deliveriesPerMonth)
  pricePerDropExVat   = (shots × 3.50) + (bottles × 25.00)
  pricePerMonthExVat  = pricePerDrop × deliveriesPerMonth
  vatPerMonth         = pricePerMonthExVat × 0.20
  totalPerMonthIncVat = pricePerMonthExVat + vatPerMonth
}
```

**Ingredient meta** (shots/bottles per person per ingredient):
- `*_shot` ingredients → 1 shot, 0 bottles per person
- `*_share` ingredients → 0 shots, 0.1 bottles per person (1 bottle serves 10)

---

## 10. Email templates (`lib/email.ts`)

| Function | Trigger | Content |
|----------|---------|---------|
| `sendStep1Email` | POST /api/lead (partial) | "Finish setting up your subscription" — links to /auth/login |
| `sendQuoteEmail` | POST /api/lead (full) or PATCH /api/lead/[id] | Full pricing table with blend, frequency, team, totals |

From address: `RESEND_FROM_EMAIL` env var (default: `onboarding@resend.dev`)

---

## 11. Environment variables

| Variable | Server/Client | Required | Notes |
|----------|---------------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Both | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Both | Yes | Or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Never expose to browser |
| `RESEND_API_KEY` | Server only | For email | |
| `RESEND_FROM_EMAIL` | Server only | For email | Defaults to sandbox address |
| `NEXT_PUBLIC_APP_URL` | Both | For email CTAs | No trailing slash, e.g. `https://juice.vercel.app` |
| `ADMIN_EMAILS` | Server only | For /admin | Comma-separated email list |

---

## 12. Dashboard navigation map

```
/dashboard                    — Home: product bento + quick links
  /dashboard/orders           — Orders page (UI scaffold, DbOrdersPage)
  /dashboard/subscriptions    — Subscription list + filters + modals
  /dashboard/one-off          — One-off orders (frontend-only, no DB persistence)
  /dashboard/juice-types      — Product catalog
  /dashboard/reviews          — Placeholder
  /dashboard/feedback         — Placeholder
  /dashboard/settings         — Account + Addresses tabs
    Account tab:  display name + read-only email
    Addresses tab: CRUD for billing + delivery addresses, set-default
```

Sidebar collapse state persisted in `localStorage` key `db-sidebar-collapsed`.

---

## 13. Nuances and gotchas

1. **`quantity_tier` is a multiplier string, not a label.** Stored as `"0.5"`, `"1.0"`, `"1.5"`, `"2.0"` — not `"light"`, `"standard"`, `"generous"`. Old CODEBASE_KNOWLEDGE was wrong about this.

2. **One-off orders have no DB.** State is React-only. The addresses fetched and optionally saved are real DB operations, but the order itself is not persisted.

3. **Lead auto-linking runs twice.** Once at `/auth/callback` and once at `dashboard/layout.tsx`. The layout check handles cases where the callback was OAuth-only without the funnel (e.g. user signed up directly).

4. **Admin page is standalone** (not inside dashboard layout). Has its own header. Protected server-side via `isAdmin()` + redirect.

5. **Service role client for every API write.** API routes always: (1) verify user via cookie client, (2) do DB op via service role. This pattern lets us bypass RLS cleanly while still enforcing auth.

6. **`password supabase.txt`** exists in repo root. Contains sensitive credentials — rotate if ever committed to git. Store secrets in `.env.local` only.

7. **One-off modal fetches addresses fresh on every open.** The `useEffect` in `DbOneOffModal` has `[open]` as dependency.

8. **Subscription `status` field** exists for lifecycle management but is set/changed manually. No automated status transitions exist yet.

9. **Ingredient slugs must match** across: `INGREDIENT_OPTIONS` in funnel-modal, `INGREDIENT_META` in funnel-logic, `SLUG_META` in subscription-meta, and the `ingredients` table in Supabase.

10. **Step4 double-click guard.** The funnel modal uses `requestAnimationFrame` + `step4Ready` state to prevent the "Continue" button click from firing the "Submit" button at the same DOM position.

---

## 14. Key TypeScript types

```typescript
// lib/funnel-logic.ts
type Frequency = "weekly" | "biweekly" | "monthly" | null;
type MultStep = 0.5 | 1.0 | 1.5 | 2.0;
interface Plan { keys, labels, shotsPerDrop, bottlesPerDrop, shotsMonth, bottlesMonth,
                 team, tier, freq, pricePerDropExVat, pricePerMonthExVat, vatPerMonth, totalPerMonthIncVat }

// lib/subscription-meta.ts
type SubStatus = "pending" | "active" | "paused" | "cancelled";
interface SubRow { id, created_at, ingredients, frequency, team_size, quantity_tier,
                   shots_per_drop, bottles_per_drop, shots_per_month, bottles_per_month,
                   price_per_drop_ex_vat, price_per_month_ex_vat, vat_per_month,
                   total_per_month_inc_vat, status }

// lib/address.ts
interface AddressRow { id, created_at, user_id, type, label, line1, line2, city, postcode, country, is_default }

// components/db-one-off-modal.tsx
interface OneOffOrder { id, drink, format, qty, deliveryDate, address, notes, status }
```

---

## 15. What's not built yet (as of 2026-04-15)

| Feature | Status |
|---------|--------|
| Payment / Stripe | Not started |
| Real order fulfilment | Not started |
| Email for subscriptions | Not started (only lead funnel has email) |
| DB persistence for one-off orders | Not started (UI scaffold only) |
| Reviews / Feedback pages | Placeholders only |
| Orders page content | Scaffold only |
| Volume discounts | Not started (pricing is linear) |
| Rate limiting on /api/lead | Not started |
| CAPTCHA | Not started |

---

## 16. Supabase setup checklist (for new environments)

1. Run `supabase/schema.sql` in SQL Editor (full file — idempotent)
2. Authentication → URL Configuration → add redirect URLs:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://your-domain.com/auth/callback` (prod)
3. For Google OAuth: Google Cloud Console → Authorized redirect URIs → add `https://<project>.supabase.co/auth/v1/callback`
4. Copy all env vars from `.env.example` to `.env.local` (or Vercel project settings)
5. Set `ADMIN_EMAILS` to include your email address

---

*End of CODEBASE_KNOWLEDGE.md v2.0*
