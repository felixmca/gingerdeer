-- ============================================================
-- Juice for Teams — Order Flow Migration
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ttuufcgmelhfvbfoaiyq/sql/new
-- ============================================================

-- ── 1. PRODUCTS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        UNIQUE NOT NULL,
  name             text        NOT NULL,
  tagline          text        NOT NULL,
  description      text        NOT NULL,
  copy             text        NOT NULL,
  ingredients_list text[]      NOT NULL DEFAULT '{}',
  active           boolean     NOT NULL DEFAULT true,
  sort_order       int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_active" ON public.products;
CREATE POLICY "products_select_active"
  ON public.products FOR SELECT
  USING (active = true);

GRANT SELECT ON public.products TO anon, authenticated;

-- ── 2. SEED PRODUCTS ─────────────────────────────────────────
INSERT INTO public.products (slug, name, tagline, description, copy, ingredients_list, sort_order)
VALUES
  (
    'classic_ginger', 'Classic Ginger', 'Invigorate',
    'A bold, spicy ginger classic made to wake up the palate and sharpen the senses.',
    'A sharp ginger kick with citrus lift and warming spice. Classic Ginger is our no-nonsense invigorating blend — bright, fiery, and made to get you going.',
    ARRAY['Ginger', 'lemon', 'cayenne', 'black pepper', 'turmeric'], 1
  ),
  (
    'green_citrus', 'Green Citrus', 'Revitalise',
    'A fresher, greener blend designed to feel clean, crisp, and uplifting.',
    'Clean, crisp, and refreshing. Green Citrus pairs cooling greens with apple, lemon, mint, and a touch of ginger for a blend that feels light, bright, and revitalising.',
    ARRAY['Apple', 'cucumber', 'spinach', 'lemon', 'mint', 'ginger'], 2
  ),
  (
    'berry_beet', 'Berry Beet', 'Restore',
    'A deeper, earthier blend with rich fruit notes and a more nourishing feel.',
    'Rich berries meet earthy beetroot in a blend that feels smooth, rounded, and restorative. Berry Beet is for when you want something grounding, fruity, and full-bodied.',
    ARRAY['Beetroot', 'strawberry', 'raspberry', 'apple', 'lemon', 'ginger'], 3
  ),
  (
    'golden_carrot', 'Golden Carrot', 'Glow',
    'A warm, sunny blend with a smoother profile and a subtly spiced finish.',
    'Sweet carrot and orange balanced with turmeric, lemon, and ginger. Golden Carrot is a bright, golden blend crafted to leave you feeling refreshed, vibrant, and glowing.',
    ARRAY['Carrot', 'orange', 'turmeric', 'lemon', 'ginger', 'black pepper'], 4
  )
ON CONFLICT (slug) DO NOTHING;

-- ── 3. ORDERS TABLE (create fresh) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Product (primary / legacy single-product)
  product_id                uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug              text,
  format                    text        CHECK (format IN ('shot', 'share')),
  quantity                  int,
  -- Multi-product line items (new)
  line_items                jsonb,
  items                     jsonb       NOT NULL DEFAULT '[]',
  -- Pricing
  subtotal_ex_vat           numeric(10,2) NOT NULL DEFAULT 0,
  vat                       numeric(10,2) NOT NULL DEFAULT 0,
  total_inc_vat             numeric(10,2) NOT NULL DEFAULT 0,
  -- Delivery
  delivery_date             date,
  delivery_notes            text,
  delivery_address_id       uuid        REFERENCES public.addresses(id) ON DELETE SET NULL,
  -- Status & Stripe
  status                    text        NOT NULL DEFAULT 'checkout_draft'
                              CHECK (status IN ('checkout_draft', 'pending', 'paid', 'fulfilled', 'cancelled')),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
CREATE POLICY "orders_update_own"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 4. SUBSCRIPTIONS TABLE — add new columns ─────────────────
-- Stripe columns (these should have been added by the original schema.sql
-- Stripe block — adding here defensively for databases where that block
-- was never run)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id        text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS current_period_end        timestamptz;

-- Allow checkout_draft as a valid status
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('checkout_draft', 'pending', 'active', 'paused', 'cancelled'));

-- New columns (safe — all IF NOT EXISTS)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS product_id            uuid   REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_slug          text,
  ADD COLUMN IF NOT EXISTS format                text   CHECK (format IN ('shot', 'share')),
  ADD COLUMN IF NOT EXISTS quantity_per_delivery int,
  ADD COLUMN IF NOT EXISTS preferred_day         text,
  ADD COLUMN IF NOT EXISTS delivery_address_id   uuid   REFERENCES public.addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_items            jsonb;
