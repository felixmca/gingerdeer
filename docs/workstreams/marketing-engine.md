# Workstream: Marketing Engine
**Owner:** Felix  
**Started:** 2026-04-17  
**Last updated:** 2026-04-19

## Objective
A practical admin-usable prospecting and email marketing system inside the Juice CRM. Sources net-new B2B contacts, segments them by audience persona, sends targeted campaigns, tracks engagement, and automatically advances contacts through a commercial lifecycle.

## Why it matters
Juice has no outbound channel. This engine is the primary growth lever until inbound scales.

## Current state
All major features are implemented. **Blocked on running the migration SQL** before the Lists and AI query tracking features can be tested.

## Lifecycle model
```
contact → [CTA click] → opportunity → [checkout/pending sub] → lead → [paid] → customer
```
Tracked via `lifecycle_stage` on `prospect_contacts`. Separate from `status` (deliverability).

## Audience segments
| Key | Label | Examples |
|---|---|---|
| `mum` | Mum | Galleries, private members clubs, fine dining |
| `dad` | Dad | Law firms, tech offices, HR, co-working |
| `flame` | Flame | Universities, student societies, campus cafés |
| `candice` | Candice | Bars, comedy clubs, music venues, nightclubs |
| `grandad` | Grandad | Golf clubs, tennis clubs, spas, gyms |

## DB tables
| Table | Purpose | Status |
|---|---|---|
| `prospect_contacts` | Marketing contact database | Live |
| `campaign_sends` | Per-recipient send record + tracking token | Live |
| `campaign_events` | Click/unsubscribe/lifecycle events | Live |
| `prospect_extract_queries` | Every AI extract/research query + response | **Pending migration** |
| `prospect_lists` | Named lists (manual or filter-based) | **Pending migration** |
| `prospect_list_members` | Junction: list ↔ contact | **Pending migration** |
| `email_campaigns` (extended) | Added: `campaign_type`, filter arrays, CTA fields, `list_ids[]` | Live (filter cols) / **Pending** (list_ids) |

## API routes
| Route | Methods | Status |
|---|---|---|
| `/api/admin/prospects` | GET, POST | Live |
| `/api/admin/prospects/[id]` | GET, PATCH, DELETE | Live |
| `/api/admin/prospects/import` | POST | Live |
| `/api/admin/prospects/extract` | POST | Live |
| `/api/admin/campaigns` | GET, POST | Live |
| `/api/admin/campaigns/[id]` | GET, PATCH, DELETE | Live |
| `/api/admin/campaigns/[id]/preview` | GET | Live |
| `/api/admin/campaigns/[id]/send` | POST | Live |
| `/api/admin/lists` | GET, POST | Live (needs migration) |
| `/api/admin/lists/[id]` | GET, PATCH, DELETE | Live (needs migration) |
| `/api/admin/lists/[id]/members` | POST, DELETE | Live (needs migration) |
| `/api/track/click/[token]` | GET | Live |
| `/api/track/unsubscribe/[token]` | GET | Live |

## Key lib files
| File | Purpose |
|---|---|
| `lib/prospects.ts` | Types, CATEGORIES, lifecycle helpers, `isSendable`, `buildTrackingUrl` |
| `lib/campaign-recipients.ts` | `resolveProspectRecipients()` — shared between preview + send routes |
| `lib/logger.ts` | Structured ANSI console logger for all API routes |

## Key components
| File | Purpose |
|---|---|
| `components/admin/crm-prospects.tsx` | Prospects table, add/import/AI-extract UI |
| `components/admin/crm-campaigns.tsx` | Campaign list + composer + list targeting |
| `components/admin/crm-lists.tsx` | Lists management UI |
| `components/admin/admin-sidebar.tsx` | Sidebar with Marketing section (Prospects, Campaigns, Lists) |

## Decisions made
| Decision | Rationale |
|---|---|
| `prospect_contacts` separate from `leads` | `leads` = self-identified funnel. `prospect_contacts` = admin-sourced. Different provenance. |
| Category is free-text | Extensible without migrations |
| `email_hash = lower(trim(email))` | Simple, fast dedupe key |
| Tracking token = UUID per send | Opaque, hard to enumerate, no JWT overhead |
| New `/api/admin/campaigns` routes (not extending `/api/admin/emails/campaigns`) | Keeps legacy email/automation routes clean |
| `resolveProspectRecipients` in `lib/campaign-recipients.ts` | Can't export arbitrary functions from Next.js route files (build error) |
| Claude Haiku for AI extract | Lowest cost, fastest; quality sufficient for B2B contact extraction |
| AI extract: user's category always wins | Prevents Claude from overriding the admin's segment selection |
| Lists support both `manual` and `filter` types | Manual = hand-curated; filter = dynamic query at send time |

## Done
- [x] Domain model + DB schema design
- [x] `prospect_contacts`, `campaign_sends`, `campaign_events` tables
- [x] `email_campaigns` extended with targeting + CTA fields
- [x] TypeScript types (`lib/prospects.ts`)
- [x] Full CRUD API for prospects
- [x] CSV bulk import with deduplication (`/api/admin/prospects/import`)
- [x] AI extract/research mode (`/api/admin/prospects/extract`)
- [x] Campaign create → preview → send flow
- [x] Click tracking + unsubscribe routes
- [x] Lifecycle wiring: click→opportunity, checkout→lead, payment→customer
- [x] Structured logging (`lib/logger.ts`) across all routes
- [x] AI query tracking (`prospect_extract_queries` table + extract_query_id FK)
- [x] Prospect Lists (tables, API, UI, campaign integration)
- [x] Campaign recipients refactored to `lib/campaign-recipients.ts` (fixed Vercel build)
- [x] Admin sidebar updated with Marketing section

## Open questions
- Should filter-based lists re-evaluate at preview time AND at send time, or only at send time?
- What should happen when a contact's status changes after being added to a manual list?
- Is `reviewed` flag on contacts being used anywhere in the UI yet?

## Next steps
1. **Run `scripts/migrate-prospects.sql`** in Supabase SQL Editor (BLOCKS everything below)
2. Test: AI extract → import → verify `extract_query_id` populated on contacts
3. Test: Create a list → add contacts → create campaign targeting list → preview → send
4. Test: Click tracked link → verify lifecycle advances to `opportunity`
5. Verify Stripe webhook lifecycle: payment → `customer`
6. Set up Resend production domain
7. Add email open-tracking pixel at `/api/track/open/[token]`
8. Add bulk contact export (CSV download from admin UI)
9. Add rate limiting/batching for sends >500 recipients
