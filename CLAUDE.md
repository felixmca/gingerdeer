# Claude Operating Instructions — Juice for Teams

## Start of every session
1. Read `CURRENT_STATE.md` for a live project snapshot.
2. Read the relevant workstream tracker in `docs/workstreams/` if working on a specific feature.
3. Read only the source files directly relevant to the task — do not scan the whole repo.
4. For deep structural questions, read `codebase-analysis-docs/CODEBASE_KNOWLEDGE.md`.

## Working rhythm
- **Name sessions by workstream** (e.g. "Marketing engine", "Checkout", "CRM lists"). Keep scope tight.
- **Split unrelated work into separate sessions.** Don't mix marketing engine work with checkout work.
- **Update docs before finishing.** Any session that changes architecture, schema, routes, or lifecycle must update the affected tracker and `CURRENT_STATE.md`.
- **Write handoffs when stopping mid-task.** Use `docs/handovers/HANDOFF_TEMPLATE.md` to capture what was completed, what's next, and exact file locations.

## Code rules
- Auth pattern: always verify via cookie client (`createClient`), then act via service role (`createServiceClient`).
- Admin check: `isAdmin(user.email)` from `lib/admin.ts`. `ADMIN_EMAILS` env var is the source of truth.
- Never expose the service role key to the browser. Never expose it in client components.
- New API routes: HTTP method exports only (`GET`, `POST`, `PATCH`, `DELETE`). No other exports — Next.js will reject the build.
- Shared logic between routes belongs in `lib/`, not exported from route files.
- Use `createLogger` from `lib/logger.ts` in every new API route.
- All DB writes go via service role client. Never write with the anon/cookie client.
- Keep `prospect_contacts` and `leads` separate. They are different concepts (sourced vs self-identified).

## Documentation rules
- When schema changes: update `scripts/migrate-prospects.sql` AND the relevant section of `CODEBASE_KNOWLEDGE.md`.
- When a new route is added: add it to the API routes table in `CODEBASE_KNOWLEDGE.md`.
- When a new table is added: add its schema to `CODEBASE_KNOWLEDGE.md`.
- When a workstream phase completes: tick the item in the workstream tracker.
- When the overall project state changes: update `CURRENT_STATE.md`.
- Never let `CURRENT_STATE.md` fall more than one session behind.

## Token efficiency
- Prefer concise responses. Only show long file contents when the user needs to see them.
- Prefer targeted edits over full-file rewrites.
- When starting a session, read 3–5 targeted files rather than scanning directories.
- Use the workstream trackers and `CURRENT_STATE.md` as the memory layer between sessions instead of relying on long chat history.

## Repo layout
- `app/` — Next.js pages and API routes
- `components/admin/` — all admin CRM UI components
- `lib/` — shared utilities, types, helpers
- `scripts/` — migration SQL + Postman sync
- `codebase-analysis-docs/` — long-form documentation
- `docs/workstreams/` — active workstream trackers
- `docs/handovers/` — session handoff notes
