# Juice for Teams — Prospecting + Email Marketing Engine
**Initiative owner:** Admin / Felix  
**Started:** 2026-04-17  
**Last updated:** 2026-04-17

---

## 1. Objective

Build a practical, admin-usable prospecting and email marketing system inside the Juice CRM that:

1. Ingests and manages a database of net-new prospect contacts sourced from online channels
2. Deduplicates and classifies contacts with rich provenance metadata
3. Supports segmented email campaigns targeting specific audience buckets
4. Tracks campaign engagement and CTA clicks
5. Moves contacts through a clean lifecycle: **Contact → Opportunity → Lead → Customer**
6. Integrates with existing Juice product journeys (basket, subscriptions, payments)

---

## 2. Audience segments ("personas")

| Key | Label | Description |
|-----|-------|-------------|
| `mum` | Mum | Premium events, galleries, private members clubs, classy hospitality |
| `dad` | Dad | Offices, HR, workplace, reception, operations, finance firms |
| `flame` | Flame | Universities, student societies, events, campus organisers |
| `candice` | Candice | Clubs, pubs, bars, comedy, nightlife, event managers |
| `grandad` | Grandad | Golf, tennis, spas, wellness, leisure venues |

Categories are stored as free text (extensible). New categories can be added without a migration.

---

## 3. Lifecycle model

```
Contact ──[CTA click in campaign email]──▶ Opportunity
Opportunity ──[basket add / pending subscription]──▶ Lead
Lead ──[paid order / active subscription]──▶ Customer
```

| Stage | Trigger |
|-------|---------|
| `contact` | Added to the prospect database (sourced, imported, manually added) |
| `opportunity` | Clicked a tracked CTA link in a campaign email |
| `lead` | Created a pending subscription or added items to basket |
| `customer` | Completed payment (active subscription or paid order) |
| `suppressed` | Manually suppressed; excluded from all sends |

Status (deliverability) is separate from lifecycle stage:
`active | unsubscribed | bounced | invalid | do_not_contact | review_needed`

---

## 4. Phased plan

### Phase 1 — Foundation ✅
- [x] Domain model design
- [x] DB schema: `prospect_contacts`, `campaign_sends`, `campaign_events`, extend `email_campaigns`
- [x] Migration SQL (`scripts/migrate-prospects.sql`)
- [x] TypeScript types (`lib/prospects.ts`)
- [x] Progress tracker + CODEBASE_KNOWLEDGE.md update

### Phase 2 — Contact management ✅
- [x] `GET/POST /api/admin/prospects` — list + create
- [x] `GET/PATCH/DELETE /api/admin/prospects/[id]` — detail + update + delete
- [x] `POST /api/admin/prospects/import` — CSV bulk import with deduplication
- [x] `POST /api/admin/prospects/extract` — AI-assisted contact extraction (Claude)
- [x] `/admin/prospects` page + `ProspectsPage` component
  - Contacts table with search + category/lifecycle/status filters
  - Contact detail drawer (edit, notes, lifecycle history)
  - Add single contact form
  - CSV import flow
  - AI extract flow

### Phase 3 — Campaign engine ✅
- [x] `GET/POST /api/admin/campaigns` — list + create (new routes, distinct from legacy /admin/emails/campaigns)
- [x] `GET/PATCH /api/admin/campaigns/[id]`
- [x] `GET /api/admin/campaigns/[id]/preview` — recipient preview with count
- [x] `POST /api/admin/campaigns/[id]/send` — resolve + send + log
- [x] `/admin/campaigns` page + `CampaignsPage` component
  - Campaign list with stats (sent, clicked, converted)
  - Campaign composer (segment builder, CTA config, body, preview)
  - Recipient preview modal
  - Analytics per campaign

### Phase 4 — Attribution + tracking ✅
- [x] `GET /api/track/click/[token]` — click tracking redirect + lifecycle update
- [x] `GET /api/track/unsubscribe/[token]` — one-click unsubscribe
- [x] Lifecycle integration in existing flows:
  - Stripe webhook: payment complete → lifecycle 'customer'
  - Checkout session: basket/pending sub creation → lifecycle 'lead'

### Phase 5 — Polish + documentation ✅
- [x] CSS for prospects and campaigns pages (appended to globals.css)
- [x] Sidebar nav updated (Marketing section added)
- [x] CODEBASE_KNOWLEDGE.md updated (v2.1)
- [ ] End-to-end test of full lifecycle flow (requires Supabase migration to be run)

---

## 5. Data model changes

### New tables
| Table | Purpose |
|-------|---------|
| `public.prospect_contacts` | Marketing contact database — sourced prospects |
| `public.campaign_sends` | One row per contact per campaign send; holds tracking token |
| `public.campaign_events` | Click / open / conversion events from campaign links |

### Altered tables
| Table | Changes |
|-------|---------|
| `public.email_campaigns` | Added: `campaign_type`, `category_filter[]`, `lifecycle_filter[]`, `sub_category_filter[]`, `cta_label`, `cta_url`, `secondary_cta_label`, `secondary_cta_url`, `preview_text`, `utm_campaign`, `click_count`, `open_count`, `conversion_count` |

---

## 6. New routes / pages / components

### API routes (new)
| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/admin/prospects` | GET, POST | List/create prospect contacts |
| `/api/admin/prospects/[id]` | GET, PATCH, DELETE | Contact detail |
| `/api/admin/prospects/import` | POST | Bulk CSV import |
| `/api/admin/prospects/extract` | POST | AI-assisted text extraction |
| `/api/admin/campaigns` | GET, POST | Campaign list/create (prospect-aware) |
| `/api/admin/campaigns/[id]` | GET, PATCH | Campaign detail/update |
| `/api/admin/campaigns/[id]/preview` | GET | Recipient preview |
| `/api/admin/campaigns/[id]/send` | POST | Execute send |
| `/api/track/click/[token]` | GET | CTA click tracking + redirect |
| `/api/track/unsubscribe/[token]` | GET | One-click unsubscribe |

### Admin pages (new)
| Path | Component |
|------|-----------|
| `/admin/prospects` | `ProspectsPage` |
| `/admin/campaigns` | `CampaignsPage` |

### Components (new)
| File | Purpose |
|------|---------|
| `components/admin/prospects-page.tsx` | Contacts table, add/edit, import, AI extract |
| `components/admin/campaigns-page.tsx` | Campaign list, composer, analytics |

### Lib (new)
| File | Purpose |
|------|---------|
| `lib/prospects.ts` | TypeScript types + category/lifecycle helpers |

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| `prospect_contacts` is a new table, separate from `leads` | `leads` = funnel submissions (self-identified). `prospect_contacts` = admin-sourced contacts. Conflating them would muddy provenance. |
| Category is free-text, not an enum | Allows adding new segments (e.g. 'rosie', 'uncle_john') without a migration |
| Lifecycle is a column on `prospect_contacts`, not a separate table | Simpler for filtering/reporting; a separate `lifecycle_events` audit table logs the history |
| Tracking token = random UUID per send, stored in `campaign_sends` | Simple, opaque, hard to enumerate; no JWT overhead needed at this scale |
| New `/api/admin/campaigns` routes instead of extending `/api/admin/emails/campaigns` | Keeps the existing email log/automation routes clean; new campaigns are a distinct concept |
| AI extract uses Claude (already in package.json) | No new dependencies; leverages existing Anthropic SDK |
| CSS follows existing `adm-` prefix pattern | Feels native; no new design system |

---

## 8. Current status

**2026-04-17:** All phases fully implemented and documented. The only remaining step before using the system is running `scripts/migrate-prospects.sql` in the Supabase SQL Editor to create the new tables.

---

## 9. Blockers / open questions

- Resend free tier: bulk sending may be rate-limited. Consider batching sends with delay.
- Email open tracking: requires a tracking pixel (1×1 image hosted at `/api/track/open/[token]`). Not implemented in Phase 1 to keep scope clean. Low-trust signal anyway.
- `admin_exec_query` RPC: needs to exist before AI query page works. Check schema.sql.
- Email domain: `onboarding@resend.dev` is a sandbox address. Production requires Resend domain verification.

---

## 10. Follow-up tasks

- [ ] Add `open_count` tracking via pixel at `/api/track/open/[token]`
- [ ] Scheduled / time-delayed campaign sends
- [ ] Contact deduplication by domain (domain-level merge logic)
- [ ] Bulk status update from contacts table (e.g. mark 50 contacts as do_not_contact)
- [ ] Export contacts to CSV from admin UI
- [ ] Rate limiting + batching for large sends (>500 recipients)
- [ ] Campaign template library
- [ ] Segment rules builder (complex AND/OR filters)
- [ ] Contact quality scoring improvement (heuristic → ML)
- [ ] Google / LinkedIn import integration
