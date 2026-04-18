-- =============================================================
-- MIGRATION: Prospecting + Email Marketing Engine
-- File:  scripts/migrate-prospects.sql
-- Run in:  Supabase SQL Editor
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE
-- =============================================================

-- ── updated_at auto-stamp (reusable) ──────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =============================================================
-- TABLE 1: prospect_contacts
-- =============================================================
-- The marketing contacts database.  Separate from `leads` (which are
-- self-identified funnel submissions).  These are admin-sourced prospects.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- ── Identity ────────────────────────────────────────────────
  name                  text,
  email                 text        NOT NULL,
  role                  text,          -- 'HR Manager' | 'Events Director' | 'Office Manager' | …
  organisation          text,          -- company / venue name
  website               text,          -- domain or full URL
  phone                 text,

  -- ── Location ────────────────────────────────────────────────
  city                  text,
  borough               text,          -- London borough if applicable
  country               text           NOT NULL DEFAULT 'GB',

  -- ── Segmentation ────────────────────────────────────────────
  -- category: the audience persona bucket (free text — extensible)
  -- standard values: 'mum' | 'dad' | 'flame' | 'candice' | 'grandad'
  category              text           NOT NULL,
  -- sub_category: more granular classification within a category
  -- examples: 'gallery' | 'private_members_club' | 'hedge_fund' | 'student_society'
  sub_category          text,
  tags                  text[]         NOT NULL DEFAULT '{}',

  -- ── Source / Provenance ─────────────────────────────────────
  -- source_type: how this contact entered the system
  source_type           text           NOT NULL DEFAULT 'manual',
  --   'manual'      = admin typed it in
  --   'csv_import'  = bulk CSV upload
  --   'ai_extract'  = AI parsed from pasted text
  --   'web_scrape'  = automated scraper (future)
  --   'linkedin'    = LinkedIn import (future)
  --   'referral'    = referred by existing contact
  source_url            text,          -- URL where contact was found (provenance)
  source_domain         text,          -- canonical domain extracted from source_url
  acquisition_method    text,          -- additional free-text provenance note
  source_raw            text,          -- raw text blob from which contact was extracted (AI extract)

  -- ── Email metadata ───────────────────────────────────────────
  email_type            text,
  --   'personal' | 'generic' | 'info' | 'role_based' | 'unknown'
  email_confidence      numeric(3,2),  -- 0.00–1.00; null = not assessed
  email_verified        boolean        NOT NULL DEFAULT false,
  email_verified_at     timestamptz,

  -- ── Lifecycle ────────────────────────────────────────────────
  -- Tracks where in the commercial journey this contact sits
  lifecycle_stage       text           NOT NULL DEFAULT 'contact'
    CHECK (lifecycle_stage IN ('contact','opportunity','lead','customer','suppressed')),
  lifecycle_updated_at  timestamptz    NOT NULL DEFAULT now(),
  -- Which campaign triggered the last lifecycle advancement
  last_campaign_id      uuid,

  -- ── Status (deliverability / suppression) ───────────────────
  status                text           NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','unsubscribed','bounced','invalid','do_not_contact','review_needed')),

  -- ── Quality ─────────────────────────────────────────────────
  quality_score         smallint       NOT NULL DEFAULT 50
    CHECK (quality_score BETWEEN 0 AND 100),
  -- Manual review tracking
  reviewed              boolean        NOT NULL DEFAULT false,
  reviewed_by           uuid           REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,

  -- ── CRM links (populated as contact progresses) ─────────────
  lead_id               uuid           REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id               uuid           REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Notes ───────────────────────────────────────────────────
  notes                 text,

  -- ── Deduplication ───────────────────────────────────────────
  -- email_hash = lower(trim(email))  — fast exact dedupe key
  email_hash            text           NOT NULL,
  -- domain_hash = domain part of email — company-level dedupe hint
  domain_hash           text,

  UNIQUE (email_hash)
);

-- Updated-at trigger
DROP TRIGGER IF EXISTS prospect_contacts_updated_at ON public.prospect_contacts;
CREATE TRIGGER prospect_contacts_updated_at
  BEFORE UPDATE ON public.prospect_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS pc_email_hash_idx    ON public.prospect_contacts (email_hash);
CREATE INDEX IF NOT EXISTS pc_lifecycle_idx     ON public.prospect_contacts (lifecycle_stage);
CREATE INDEX IF NOT EXISTS pc_category_idx      ON public.prospect_contacts (category);
CREATE INDEX IF NOT EXISTS pc_status_idx        ON public.prospect_contacts (status);
CREATE INDEX IF NOT EXISTS pc_created_at_idx    ON public.prospect_contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS pc_domain_hash_idx   ON public.prospect_contacts (domain_hash);
CREATE INDEX IF NOT EXISTS pc_organisation_idx  ON public.prospect_contacts (organisation);

-- RLS: service-role only (admin resource — never exposed to browser clients)
ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prospect_contacts_service_only ON public.prospect_contacts;
CREATE POLICY prospect_contacts_service_only ON public.prospect_contacts
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_contacts TO service_role;


-- =============================================================
-- TABLE 2: campaign_sends
-- =============================================================
-- One row per recipient per campaign send.
-- Holds the tracking token used in email links.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.campaign_sends (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  campaign_id     uuid        NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,

  -- Exactly one of these identifies the recipient:
  contact_id      uuid        REFERENCES public.prospect_contacts(id) ON DELETE SET NULL,
  lead_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,

  email           text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('queued','pending','sent','failed','bounced','suppressed','clicked','unsubscribed')),

  -- Unique opaque token embedded in every email link.
  -- Used to track clicks and attribute lifecycle transitions.
  tracking_token  text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

  sent_at         timestamptz,
  clicked_at      timestamptz,
  error_message   text
);

CREATE INDEX IF NOT EXISTS cs_campaign_id_idx     ON public.campaign_sends (campaign_id);
CREATE INDEX IF NOT EXISTS cs_contact_id_idx      ON public.campaign_sends (contact_id);
CREATE INDEX IF NOT EXISTS cs_tracking_token_idx  ON public.campaign_sends (tracking_token);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_sends_service_only ON public.campaign_sends;
CREATE POLICY campaign_sends_service_only ON public.campaign_sends
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, UPDATE ON public.campaign_sends TO service_role;


-- =============================================================
-- TABLE 3: campaign_events
-- =============================================================
-- Stores every tracked interaction: CTA clicks, unsubscribes,
-- and lifecycle-change events triggered by campaign activity.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.campaign_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Backlink to the specific send that generated this event
  tracking_token  text,
  campaign_id     uuid        REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  contact_id      uuid        REFERENCES public.prospect_contacts(id) ON DELETE SET NULL,
  lead_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What happened
  event_type      text        NOT NULL,
  --   'click_cta_primary'         — clicked main CTA button
  --   'click_cta_secondary'       — clicked secondary CTA
  --   'unsubscribe'               — clicked unsubscribe link
  --   'converted_opportunity'     — lifecycle advanced to opportunity
  --   'converted_lead'            — lifecycle advanced to lead
  --   'converted_customer'        — lifecycle advanced to customer

  -- For click events: which CTA slot was used
  cta_slot        text,       -- 'primary' | 'secondary' | 'unsubscribe'
  destination_url text,       -- where the click redirected to

  -- Privacy-safe request metadata
  ip_hash         text,       -- SHA-256 of visitor IP
  user_agent_hint text,       -- first 120 chars of User-Agent header

  metadata        jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ce_campaign_id_idx  ON public.campaign_events (campaign_id);
CREATE INDEX IF NOT EXISTS ce_contact_id_idx   ON public.campaign_events (contact_id);
CREATE INDEX IF NOT EXISTS ce_event_type_idx   ON public.campaign_events (event_type);
CREATE INDEX IF NOT EXISTS ce_created_at_idx   ON public.campaign_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ce_token_idx        ON public.campaign_events (tracking_token);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_events_service_only ON public.campaign_events;
CREATE POLICY campaign_events_service_only ON public.campaign_events
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT ON public.campaign_events TO service_role;


-- =============================================================
-- ALTER email_campaigns: add prospect-targeting columns
-- =============================================================

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type          text    NOT NULL DEFAULT 'prospect_only',
  --   'prospect_only'  — sends to prospect_contacts only
  --   'leads_only'     — sends to funnel leads only (legacy behaviour)
  --   'mixed'          — sends to both

  ADD COLUMN IF NOT EXISTS category_filter        text[]  NOT NULL DEFAULT '{}',
  --   Empty = all categories.  Populated = restrict to listed categories.

  ADD COLUMN IF NOT EXISTS lifecycle_filter       text[]  NOT NULL DEFAULT '{}',
  --   Empty = all stages (except suppressed).  Populated = restrict to listed stages.

  ADD COLUMN IF NOT EXISTS sub_category_filter    text[]  NOT NULL DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS cta_label              text,
  ADD COLUMN IF NOT EXISTS cta_url                text,
  ADD COLUMN IF NOT EXISTS secondary_cta_label    text,
  ADD COLUMN IF NOT EXISTS secondary_cta_url      text,
  ADD COLUMN IF NOT EXISTS preview_text           text,
  ADD COLUMN IF NOT EXISTS utm_campaign           text,

  -- Aggregate stats (denormalised for fast read)
  ADD COLUMN IF NOT EXISTS click_count            int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count             int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count       int     NOT NULL DEFAULT 0;


-- =============================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- =============================================================

-- SELECT count(*) FROM public.prospect_contacts;         -- 0
-- SELECT count(*) FROM public.campaign_sends;            -- 0
-- SELECT count(*) FROM public.campaign_events;           -- 0
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'email_campaigns'
--   ORDER BY ordinal_position;                           -- includes new columns


-- =============================================================
-- TABLE 4: prospect_extract_queries
-- =============================================================
-- Stores every AI extract/research query so contacts can be
-- traced back to the query that generated them.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.prospect_extract_queries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  mode          text        NOT NULL,  -- 'research' | 'extract'
  category      text,
  sub_category  text,
  location      text,
  source_url    text,
  raw_text      text,         -- truncated source text (extract mode)
  contact_count int          NOT NULL DEFAULT 0,
  response_raw  text,         -- first 5000 chars of Claude's response
  created_by    uuid         REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.prospect_contacts
  ADD COLUMN IF NOT EXISTS extract_query_id uuid
    REFERENCES public.prospect_extract_queries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pc_extract_query_id_idx
  ON public.prospect_contacts (extract_query_id);

ALTER TABLE public.prospect_extract_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prospect_extract_queries_service_only ON public.prospect_extract_queries;
CREATE POLICY prospect_extract_queries_service_only ON public.prospect_extract_queries
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT ON public.prospect_extract_queries TO service_role;


-- =============================================================
-- TABLE 5: prospect_lists
-- =============================================================
-- Named lists of prospect contacts for campaign targeting.
-- Two types:
--   'filter' — dynamically matches contacts by criteria at send time
--   'manual' — hand-curated via prospect_list_members
-- =============================================================

CREATE TABLE IF NOT EXISTS public.prospect_lists (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  name                 text        NOT NULL,
  description          text,
  list_type            text        NOT NULL DEFAULT 'manual'
    CHECK (list_type IN ('manual', 'filter')),
  -- Filter criteria (for list_type = 'filter')
  category_filter      text[]      NOT NULL DEFAULT '{}',
  lifecycle_filter     text[]      NOT NULL DEFAULT '{}',
  sub_category_filter  text[]      NOT NULL DEFAULT '{}',
  status_filter        text[]      NOT NULL DEFAULT '{}',
  -- Denormalised member count (manual lists only; filter lists compute live)
  contact_count        int         NOT NULL DEFAULT 0,
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS prospect_lists_updated_at ON public.prospect_lists;
CREATE TRIGGER prospect_lists_updated_at
  BEFORE UPDATE ON public.prospect_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS pl_created_at_idx ON public.prospect_lists (created_at DESC);

ALTER TABLE public.prospect_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prospect_lists_service_only ON public.prospect_lists;
CREATE POLICY prospect_lists_service_only ON public.prospect_lists
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_lists TO service_role;


-- =============================================================
-- TABLE 6: prospect_list_members
-- =============================================================
-- Junction table for manually-curated list membership.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.prospect_list_members (
  list_id    uuid NOT NULL REFERENCES public.prospect_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.prospect_contacts(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS plm_list_id_idx    ON public.prospect_list_members (list_id);
CREATE INDEX IF NOT EXISTS plm_contact_id_idx ON public.prospect_list_members (contact_id);

ALTER TABLE public.prospect_list_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prospect_list_members_service_only ON public.prospect_list_members;
CREATE POLICY prospect_list_members_service_only ON public.prospect_list_members
  USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, DELETE ON public.prospect_list_members TO service_role;


-- =============================================================
-- ALTER email_campaigns: add list_ids for list-based targeting
-- =============================================================

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS list_ids uuid[] NOT NULL DEFAULT '{}';
  -- Empty = use filter-based targeting
  -- Non-empty = send to all active members of these lists
