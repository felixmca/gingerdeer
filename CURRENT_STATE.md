# Juice for Teams — Current State
**Last updated:** 2026-04-19

## What this project is
B2B SaaS app selling ginger juice subscriptions to offices. Next.js 15 / Supabase / TypeScript. Deployed on Vercel. Two surfaces: a customer-facing funnel + dashboard, and an admin CRM.

## Active workstreams
| Workstream | Status | Tracker |
|---|---|---|
| Marketing Engine (prospects, campaigns, lists) | Active — migration pending | `docs/workstreams/marketing-engine.md` |

## Built and working
| Feature | Notes |
|---|---|
| Lead capture funnel | 4-step modal, anon + auth paths, quote email |
| Auth (email + Google OAuth) | Supabase SSR, cookie session, lead auto-link |
| User dashboard | Subscriptions, one-off orders, addresses, settings |
| Stripe checkout | Embedded checkout, subscription + one-off payment modes |
| Orders DB + Stripe webhook | `orders` table, subscription lifecycle synced from Stripe events |
| Admin CRM | Leads, contacts, accounts, opportunities, email log, reports, billing |
| AI SQL query runner | `/admin/query` — freeform NL → SQL via Claude |
| Prospect contacts database | `prospect_contacts` table, full CRUD API + UI |
| CSV import + AI extract | Bulk import (2000 rows), Claude Haiku two-mode extraction |
| Campaign engine | Create → preview → send → tracking; `campaign_sends` + `campaign_events` |
| Email click tracking | UUID tokens in links, redirect + lifecycle advancement |
| Lifecycle wiring | CTA click → opportunity; checkout → lead; Stripe payment → customer |
| Structured logging | `lib/logger.ts` — ANSI color-coded, used in all API routes |
| Prospect Lists | `prospect_lists` + `prospect_list_members` tables, full API + UI (**migration pending**) |
| AI query tracking | `prospect_extract_queries` table — every Claude call logged (**migration pending**) |

## Not built / incomplete
| Feature | Notes |
|---|---|
| Email open tracking | Pixel at `/api/track/open/[token]` not implemented |
| Scheduled/delayed sends | Campaigns send immediately only |
| Production email domain | Using Resend sandbox `onboarding@resend.dev` |
| Export contacts to CSV | Admin UI only, no export |
| Bulk status update | No batch operations on contacts table yet |
| Rate limiting | No rate limiting on any API route |
| Reviews + Feedback pages | Placeholders in dashboard |
| Real order fulfilment | Orders exist in DB but no delivery workflow |
| Volume discounts | Pricing is linear |

## Critical pending action
**Run `scripts/migrate-prospects.sql` in Supabase SQL Editor.**
This adds 3 tables (`prospect_extract_queries`, `prospect_lists`, `prospect_list_members`), 2 columns (`extract_query_id` on `prospect_contacts`, `list_ids` on `email_campaigns`). None of the Lists feature or AI query tracking will work until this is done.

## Architectural caveats
- `leads` = funnel submissions (self-identified). `prospect_contacts` = admin-sourced contacts. Do not conflate.
- `email_hash` = `lower(trim(email))` — this is the deduplication key for prospects.
- API routes must only export HTTP method handlers (`GET`, `POST`, etc). Any other export breaks the Next.js build (this bit us in `preview/route.ts` — fixed by moving `resolveProspectRecipients` to `lib/campaign-recipients.ts`).
- Stripe Dahlia API: `invoice.parent.subscription_details.subscription` is the subscription ID path (not `invoice.subscription`).
- All DB writes go via service role client. The cookie client is for auth verification only.

## Current priorities
1. Run migration SQL (unblocks Lists + AI query tracking)
2. Test end-to-end: AI extract → import → create campaign targeting a list → send → click → lifecycle advancement
3. Set up Resend production domain
4. Add email open tracking pixel

## Known blockers
- Migration SQL not yet confirmed as run in Supabase
- `POSTMAN_COLLECTION_UID` needs to be added to `.env.local` (script will auto-save it after next `--push` run)
- Supabase anon key (JWT format) missing from `.env.local` — needed for Postman direct REST calls
