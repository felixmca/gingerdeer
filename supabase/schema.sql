-- Run in Supabase → SQL Editor (new query), then Run.
-- Stores funnel submissions from the Juice landing page.
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS column guards.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  company text not null,
  role text,
  ingredients text[] not null default '{}',
  -- nullable: not known until step 3 / step 4
  frequency text,
  quantity_tier text,
  team_size int,
  shots_per_drop int not null default 0,
  bottles_per_drop int not null default 0,
  shots_per_month int not null default 0,
  bottles_per_month int not null default 0,
  -- pricing (ex-VAT and inc-VAT, stored at submission time)
  price_per_drop_ex_vat numeric(10,2),
  price_per_month_ex_vat numeric(10,2),
  vat_per_month numeric(10,2),
  total_per_month_inc_vat numeric(10,2),
  -- account linking
  signup_complete boolean not null default false,
  user_id uuid references auth.users(id) on delete set null
);

comment on table public.leads is 'B2B juice funnel signups (anon insert from web app).';

-- Add new columns to existing tables (safe on re-run via DO block)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='signup_complete') then
    alter table public.leads add column signup_complete boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='user_id') then
    alter table public.leads add column user_id uuid references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='price_per_drop_ex_vat') then
    alter table public.leads add column price_per_drop_ex_vat numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='price_per_month_ex_vat') then
    alter table public.leads add column price_per_month_ex_vat numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='vat_per_month') then
    alter table public.leads add column vat_per_month numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='total_per_month_inc_vat') then
    alter table public.leads add column total_per_month_inc_vat numeric(10,2);
  end if;
  -- make frequency / quantity_tier / team_size nullable on existing tables
  begin
    alter table public.leads alter column frequency drop not null;
  exception when others then null;
  end;
  begin
    alter table public.leads alter column quantity_tier drop not null;
  exception when others then null;
  end;
  begin
    alter table public.leads alter column team_size drop not null;
  exception when others then null;
  end;
end $$;

-- Row-level security
alter table public.leads enable row level security;

-- Anonymous visitors can insert their own signup row
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon"
  on public.leads
  for insert
  to anon
  with check (true);

-- Authenticated users can read their own linked leads
drop policy if exists "leads_select_owner" on public.leads;
create policy "leads_select_owner"
  on public.leads
  for select
  to authenticated
  using (user_id = auth.uid());

-- Authenticated users can update their own linked leads (e.g. profile edits)
drop policy if exists "leads_update_owner" on public.leads;
create policy "leads_update_owner"
  on public.leads
  for update
  to authenticated
  using (user_id = auth.uid());

-- Grant permissions
grant usage on schema public to anon;
grant insert on table public.leads to anon;
grant usage on schema public to authenticated;
grant select, update on table public.leads to authenticated;

/* =========================================================
   Ingredients reference table
   =========================================================
   Central catalogue of every juice SKU. Each row is one
   purchasable unit (e.g. "All-in-one 100ml shot").
   slug matches the ingredient keys used throughout the app.
   ========================================================= */
create table if not exists public.ingredients (
  id                       uuid          primary key default gen_random_uuid(),
  slug                     text          unique not null,
  name                     text          not null,
  -- 'shot'  = individual 100ml bottle (1 serving per unit)
  -- 'share' = 1L share bottle         (10 servings per unit)
  format                   text          not null check (format in ('shot', 'share')),
  size_ml                  integer       not null,
  servings_per_unit        integer       not null default 1,
  price_ex_vat             numeric(10,2) not null,
  -- computed: price per single serving ex. VAT
  price_per_serving_ex_vat numeric(10,2) generated always as (price_ex_vat / servings_per_unit) stored,
  unit_label               text          not null default 'unit',
  -- optional metadata for UI display
  sort_order               integer       not null default 0,
  available                boolean       not null default true,
  created_at               timestamptz   not null default now()
);

comment on table  public.ingredients                         is 'Juice product catalogue — one row per purchasable SKU.';
comment on column public.ingredients.slug                    is 'Matches ingredient keys in leads.ingredients[] and app code.';
comment on column public.ingredients.format                  is 'shot = 100ml individual bottle; share = 1L bottle (10 servings).';
comment on column public.ingredients.servings_per_unit       is 'Number of 100ml servings in this unit (1 for shot, 10 for 1L share).';
comment on column public.ingredients.price_per_serving_ex_vat is 'Derived: price_ex_vat / servings_per_unit. Stored for query convenience.';

-- ── Seed data ───────────────────────────────────────────
insert into public.ingredients
  (slug, name, format, size_ml, servings_per_unit, price_ex_vat, unit_label, sort_order)
values
  ('allinone_shot',             'All-in-one',           'shot',  100,  1,  3.50,  '100ml shot',        10),
  ('allinone_share',            'All-in-one',           'share', 1000, 10, 25.00, '1L share bottle',   11),
  ('lemon_ginger_honey_shot',   'Lemon, Ginger, Honey', 'shot',  100,  1,  3.50,  '100ml shot',        20),
  ('lemon_ginger_honey_share',  'Lemon, Ginger, Honey', 'share', 1000, 10, 25.00, '1L share bottle',   21),
  ('apple_ginger_shot',         'Apple Ginger',         'shot',  100,  1,  3.50,  '100ml shot',        30),
  ('apple_ginger_share',        'Apple Ginger',         'share', 1000, 10, 25.00, '1L share bottle',   31),
  ('turmeric_shot',             'Turmeric Boost',       'shot',  100,  1,  3.50,  '100ml shot',        40),
  ('turmeric_share',            'Turmeric Boost',       'share', 1000, 10, 25.00, '1L share bottle',   41)
on conflict (slug) do nothing;

-- ── Row-level security ────────────────────────────────────
alter table public.ingredients enable row level security;

-- Anyone (incl. anonymous visitors browsing /juice-types) can read the catalogue
drop policy if exists "ingredients_select_public" on public.ingredients;
create policy "ingredients_select_public"
  on public.ingredients
  for select
  using (available = true);

-- No client-side writes — managed via Supabase dashboard or service role only
grant select on table public.ingredients to anon;
grant select on table public.ingredients to authenticated;

/* =========================================================
   Subscriptions table
   =========================================================
   Stores subscription plans for authenticated users.
   Created when a logged-in user completes the funnel.
   ========================================================= */
create table if not exists public.subscriptions (
  id                       uuid          primary key default gen_random_uuid(),
  created_at               timestamptz   not null default now(),
  user_id                  uuid          not null references auth.users(id) on delete cascade,
  -- What they ordered
  ingredients              text[]        not null default '{}',
  frequency                text          not null,
  team_size                int           not null default 1,
  quantity_tier            text          not null default '1',
  -- Quantities per delivery
  shots_per_drop           int           not null default 0,
  bottles_per_drop         int           not null default 0,
  shots_per_month          int           not null default 0,
  bottles_per_month        int           not null default 0,
  -- Pricing (stored at submission time, ex-VAT and inc-VAT)
  price_per_drop_ex_vat    numeric(10,2),
  price_per_month_ex_vat   numeric(10,2),
  vat_per_month            numeric(10,2),
  total_per_month_inc_vat  numeric(10,2),
  -- Lifecycle
  status                   text          not null default 'pending'
                             check (status in ('pending', 'active', 'paused', 'cancelled')),
  -- Optional link back to the anonymous lead that started the journey
  lead_id                  uuid          references public.leads(id) on delete set null
);

comment on table public.subscriptions is 'Juice subscription plans created by authenticated users via the funnel.';

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_owner" on public.subscriptions;
create policy "subscriptions_select_owner"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "subscriptions_insert_service" on public.subscriptions;
-- Inserts are done server-side via the service role — no direct client insert needed.

-- Grant read access so the client can load subscriptions
grant select on table public.subscriptions to authenticated;
-- Service role has full access by default (bypasses RLS)

/* =========================================================
   Addresses table
   =========================================================
   Stores billing and delivery addresses for authenticated
   users. Linked to auth.users via user_id.
   type = 'billing' | 'delivery'
   ========================================================= */
create table if not exists public.addresses (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  type       text        not null check (type in ('billing', 'delivery')),
  label      text,
  line1      text        not null,
  line2      text,
  city       text        not null,
  postcode   text        not null,
  country    text        not null default 'GB',
  is_default boolean     not null default false
);

comment on table  public.addresses            is 'Billing and delivery addresses saved by authenticated users.';
comment on column public.addresses.type       is 'billing or delivery.';
comment on column public.addresses.label      is 'Optional nickname, e.g. "Main Office".';
comment on column public.addresses.is_default is 'One default per type per user. Enforced at the application layer.';

-- Index for fast per-user lookups
create index if not exists addresses_user_id_idx on public.addresses(user_id);

-- Row-level security
alter table public.addresses enable row level security;

drop policy if exists "addresses_owner" on public.addresses;
create policy "addresses_owner"
  on public.addresses
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Authenticated users can fully manage their own addresses
grant select, insert, update, delete on table public.addresses to authenticated;
-- Service role manages addresses on behalf of users (API routes)
-- (service role bypasses RLS automatically)

/* =========================================================
   CRM extensions — run this block to enable the admin CRM.
   All statements are idempotent (safe to re-run).
   =========================================================

   1. Extend public.leads with CRM tracking columns
   2. public.lead_notes   — activity log / notes per lead
   3. public.email_logs   — record of every email sent
   4. public.email_campaigns — bulk email campaigns
   ========================================================= */

-- ── 1. Extend leads with CRM columns ─────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='crm_status') then
    alter table public.leads add column crm_status text not null default 'new'
      check (crm_status in ('new','contacted','qualified','proposal','converted','lost'));
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='crm_source') then
    alter table public.leads add column crm_source text
      check (crm_source in ('landing_page','cold_outreach','referral','event','other'));
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='assigned_to') then
    alter table public.leads add column assigned_to uuid references auth.users(id) on delete set null;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='leads' and column_name='last_contacted_at') then
    alter table public.leads add column last_contacted_at timestamptz;
  end if;
end $$;

-- ── 2. Lead notes (CRM activity log) ─────────────────────
create table if not exists public.lead_notes (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  author_id   uuid        not null references auth.users(id) on delete cascade,
  note        text        not null,
  note_type   text        not null default 'note'
              check (note_type in ('note','call','email','status_change'))
);

comment on table public.lead_notes is 'CRM activity log — notes and touchpoints on leads.';

create index if not exists lead_notes_lead_id_idx on public.lead_notes(lead_id);
create index if not exists lead_notes_created_at_idx on public.lead_notes(created_at desc);

alter table public.lead_notes enable row level security;

drop policy if exists "lead_notes_service_only" on public.lead_notes;
create policy "lead_notes_service_only"
  on public.lead_notes
  using (false);
-- Service role bypasses RLS — all access is via /api/admin routes

grant select on table public.lead_notes to authenticated;

-- ── 3. Email logs ──────────────────────────────────────────
create table if not exists public.email_logs (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  to_email       text        not null,
  to_user_id     uuid        references auth.users(id) on delete set null,
  to_lead_id     uuid        references public.leads(id) on delete set null,
  subject        text        not null,
  template_name  text        not null,
  campaign_id    uuid,       -- FK added after email_campaigns table exists
  status         text        not null default 'sent'
                 check (status in ('sent','failed')),
  metadata       jsonb       not null default '{}'
);

comment on table public.email_logs is 'Record of every email sent by the system (automated + admin campaigns).';

create index if not exists email_logs_to_email_idx   on public.email_logs(to_email);
create index if not exists email_logs_to_lead_id_idx  on public.email_logs(to_lead_id);
create index if not exists email_logs_created_at_idx  on public.email_logs(created_at desc);
create index if not exists email_logs_template_idx    on public.email_logs(template_name);

alter table public.email_logs enable row level security;

drop policy if exists "email_logs_service_only" on public.email_logs;
create policy "email_logs_service_only"
  on public.email_logs
  using (false);

grant select on table public.email_logs to authenticated;

-- ── 4. Email campaigns ────────────────────────────────────
create table if not exists public.email_campaigns (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text        not null,
  subject          text        not null,
  body_html        text        not null default '',
  target           text        not null default 'unconverted_leads'
                   check (target in ('all_leads','unconverted_leads','active_users','pending_subs','custom')),
  status           text        not null default 'draft'
                   check (status in ('draft','sent')),
  sent_at          timestamptz,
  sent_by          uuid        references auth.users(id) on delete set null,
  recipient_count  int         not null default 0
);

comment on table public.email_campaigns is 'Admin-composed bulk email campaigns.';

alter table public.email_campaigns enable row level security;

drop policy if exists "email_campaigns_service_only" on public.email_campaigns;
create policy "email_campaigns_service_only"
  on public.email_campaigns
  using (false);

grant select on table public.email_campaigns to authenticated;

-- Add FK from email_logs → email_campaigns now that campaigns table exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'email_logs_campaign_id_fkey'
      and table_name = 'email_logs'
  ) then
    alter table public.email_logs
      add constraint email_logs_campaign_id_fkey
      foreign key (campaign_id) references public.email_campaigns(id) on delete set null;
  end if;
end $$;

/* =========================================================
   Admin AI Query helper function
   =========================================================
   Allows the /admin/query AI interface to execute arbitrary
   SELECT queries. Called exclusively via the service role
   from /api/admin/query — never exposed to the browser.

   Run this block once in Supabase SQL Editor to enable the
   AI Query feature at /admin/query.
   ========================================================= */
create or replace function public.admin_exec_query(query_text text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result json;
  trimmed text;
begin
  trimmed := lower(trim(query_text));
  -- Only allow SELECT and WITH (CTEs) queries
  if trimmed not like 'select%' and trimmed not like 'with%' then
    raise exception 'Only SELECT queries are allowed';
  end if;
  execute 'select json_agg(row_to_json(t)) from (' || query_text || ') t'
  into result;
  return coalesce(result, '[]'::json);
end;
$$;

/* =========================================================
   Stripe integration — run this block in Supabase SQL Editor
   to enable payment processing.
   =========================================================

   1. Extend subscriptions with Stripe tracking columns
   2. public.orders — one-off purchase records
   ========================================================= */

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='stripe_subscription_id') then
    alter table public.subscriptions add column stripe_subscription_id text;
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='stripe_customer_id') then
    alter table public.subscriptions add column stripe_customer_id text;
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='stripe_checkout_session_id') then
    alter table public.subscriptions add column stripe_checkout_session_id text;
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='current_period_end') then
    alter table public.subscriptions add column current_period_end timestamptz;
  end if;
end $$;

-- ── One-off orders ─────────────────────────────────────────
create table if not exists public.orders (
  id                         uuid        primary key default gen_random_uuid(),
  created_at                 timestamptz not null default now(),
  user_id                    uuid        not null references auth.users(id) on delete cascade,
  -- Cart snapshot (array of {slug, name, format, unitLabel, priceExVat, quantity})
  items                      jsonb       not null default '[]',
  -- Totals (stored at order time, inc VAT)
  subtotal_ex_vat            numeric(10,2),
  vat                        numeric(10,2),
  total_inc_vat              numeric(10,2),
  -- Stripe
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  -- Lifecycle
  status                     text        not null default 'pending'
                             check (status in ('pending','paid','failed','refunded')),
  -- Optional delivery info
  delivery_address_id        uuid        references public.addresses(id) on delete set null,
  notes                      text
);

comment on table public.orders is 'One-off juice purchase orders (separate from recurring subscriptions).';

create index if not exists orders_user_id_idx    on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

alter table public.orders enable row level security;

drop policy if exists "orders_select_owner" on public.orders;
create policy "orders_select_owner"
  on public.orders
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.orders to authenticated;

comment on function public.admin_exec_query(text) is
  'Admin-only helper: executes a read-only SQL query and returns results as JSON. '
  'Called exclusively from the service role via /api/admin/query.';
