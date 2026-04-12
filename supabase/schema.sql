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
