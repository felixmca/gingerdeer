/**
 * CRM Database Migration Script
 * Run from repo root: node scripts/migrate.js
 *
 * Creates all CRM tables and extends the leads table.
 * Safe to re-run (idempotent).
 */

const { Client } = require("pg");

const client = new Client({
  connectionString: `postgresql://postgres.ttuufcgmelhfvbfoaiyq:Gingerjuice!!12=@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
});

const SQL = `
-- Extend leads with CRM columns
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

-- Lead notes
create table if not exists public.lead_notes (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  author_id   uuid        not null references auth.users(id) on delete cascade,
  note        text        not null,
  note_type   text        not null default 'note'
              check (note_type in ('note','call','email','status_change'))
);
create index if not exists lead_notes_lead_id_idx on public.lead_notes(lead_id);
create index if not exists lead_notes_created_at_idx on public.lead_notes(created_at desc);
alter table public.lead_notes enable row level security;
drop policy if exists "lead_notes_service_only" on public.lead_notes;
create policy "lead_notes_service_only" on public.lead_notes using (false);
grant select on table public.lead_notes to authenticated;

-- Email logs
create table if not exists public.email_logs (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  to_email       text        not null,
  to_user_id     uuid        references auth.users(id) on delete set null,
  to_lead_id     uuid        references public.leads(id) on delete set null,
  subject        text        not null,
  template_name  text        not null,
  campaign_id    uuid,
  status         text        not null default 'sent' check (status in ('sent','failed')),
  metadata       jsonb       not null default '{}'
);
create index if not exists email_logs_to_email_idx   on public.email_logs(to_email);
create index if not exists email_logs_to_lead_id_idx  on public.email_logs(to_lead_id);
create index if not exists email_logs_created_at_idx  on public.email_logs(created_at desc);
alter table public.email_logs enable row level security;
drop policy if exists "email_logs_service_only" on public.email_logs;
create policy "email_logs_service_only" on public.email_logs using (false);
grant select on table public.email_logs to authenticated;

-- Email campaigns
create table if not exists public.email_campaigns (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text        not null,
  subject          text        not null,
  body_html        text        not null default '',
  target           text        not null default 'unconverted_leads'
                   check (target in ('all_leads','unconverted_leads','active_users','pending_subs','custom')),
  status           text        not null default 'draft' check (status in ('draft','sent')),
  sent_at          timestamptz,
  sent_by          uuid        references auth.users(id) on delete set null,
  recipient_count  int         not null default 0
);
alter table public.email_campaigns enable row level security;
drop policy if exists "email_campaigns_service_only" on public.email_campaigns;
create policy "email_campaigns_service_only" on public.email_campaigns using (false);
grant select on table public.email_campaigns to authenticated;

-- FK from email_logs → campaigns
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'email_logs_campaign_id_fkey' and table_name = 'email_logs'
  ) then
    alter table public.email_logs
      add constraint email_logs_campaign_id_fkey
      foreign key (campaign_id) references public.email_campaigns(id) on delete set null;
  end if;
end $$;
`;

async function run() {
  console.log("Connecting to Supabase...");
  await client.connect();
  console.log("Connected. Running migrations...");
  await client.query(SQL);
  console.log("✓ All CRM migrations applied successfully.");
  await client.end();
}

run().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
