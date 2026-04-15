/**
 * Automations migration — creates email_automation_rules table + seeds initial rules.
 * Run: node scripts/migrate-automations.js
 */
const { Client } = require("pg");

const client = new Client({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.ttuufcgmelhfvbfoaiyq",
  password: "Gingerjuice!!12=",
  ssl: { rejectUnauthorized: false },
});

const SQL = `
-- Email automation rules
create table if not exists public.email_automation_rules (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  name           text        not null,
  description    text        not null default '',
  trigger_event  text        not null
                 check (trigger_event in (
                   'lead_created',
                   'lead_created_existing_user',
                   'funnel_complete',
                   'subscription_created',
                   'lead_age_hours',
                   'pending_sub_age_hours',
                   'manual'
                 )),
  delay_hours    int         not null default 0,
  template_name  text        not null,
  subject        text        not null,
  body_html      text        not null default '',
  enabled        boolean     not null default true,
  conditions     jsonb       not null default '{}'
);

alter table public.email_automation_rules enable row level security;
drop policy if exists "automations_service_only" on public.email_automation_rules;
create policy "automations_service_only" on public.email_automation_rules using (false);
grant select on table public.email_automation_rules to authenticated;

-- Seed initial rules (skip if already seeded)
insert into public.email_automation_rules
  (name, description, trigger_event, delay_hours, template_name, subject, enabled)
select name, description, trigger_event, delay_hours, template_name, subject, enabled
from (values
  (
    'Funnel Step 1',
    'Sent immediately when someone submits the first funnel step with a new email address.',
    'lead_created', 0,
    'step1_finish_setup',
    'Finish setting up your Juice for Teams subscription',
    true
  ),
  (
    'Existing User — Login Prompt',
    'Sent when a known account email re-submits the funnel. Prompts them to sign in instead.',
    'lead_created_existing_user', 0,
    'existing_user_login_prompt',
    'You already have a Juice for Teams account',
    true
  ),
  (
    'Full Quote',
    'Sent when someone completes all 4 funnel steps (anon path). Contains full pricing breakdown.',
    'funnel_complete', 0,
    'quote',
    'Your Juice for Teams quote',
    true
  ),
  (
    'Subscription Confirmed',
    'Sent immediately when a logged-in user creates a new subscription.',
    'subscription_created', 0,
    'subscription_created',
    'Your Juice for Teams subscription is confirmed',
    true
  ),
  (
    'Lead Follow-up — 24h',
    'First follow-up for unconverted leads. Checks the quote is still available.',
    'lead_age_hours', 24,
    'lead_followup_24h',
    'Did you get a chance to look at your Juice for Teams quote?',
    true
  ),
  (
    'Lead Follow-up — 3 days',
    'Second follow-up. Offers to answer questions and nudges toward sign-up.',
    'lead_age_hours', 72,
    'lead_followup_3d',
    'Still thinking about Juice for Teams?',
    true
  ),
  (
    'Lead Follow-up — 7 days',
    'Final follow-up. Creates urgency — quote expires soon messaging.',
    'lead_age_hours', 168,
    'lead_followup_7d',
    'Your Juice for Teams quote expires soon',
    true
  ),
  (
    'Pending Subscription Reminder',
    'Sent ~24h after a subscription is created but still pending. Skipped if user has an active sub.',
    'pending_sub_age_hours', 24,
    'pending_sub_reminder',
    'Your Juice for Teams subscription is pending — we''re on it',
    true
  )
) as v(name, description, trigger_event, delay_hours, template_name, subject, enabled)
where not exists (
  select 1 from public.email_automation_rules limit 1
);
`;

async function run() {
  console.log("Connecting...");
  await client.connect();
  console.log("Running automations migration...");
  await client.query(SQL);
  console.log("✓ email_automation_rules table created and seeded.");
  await client.end();
}

run().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
