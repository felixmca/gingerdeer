import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

// Schema context for Claude — cached across requests via prompt caching
const SCHEMA_SYSTEM_PROMPT = `You are a SQL expert for Juice for Teams, a B2B SaaS for ginger juice subscriptions.
Convert the user's natural language question into a PostgreSQL SELECT query.

DATABASE SCHEMA (Supabase / PostgreSQL — public schema):

TABLE: leads — B2B funnel signups
  id uuid PK, created_at timestamptz, email text, company text, role text?,
  ingredients text[] (product slug array), frequency text? ('weekly'|'biweekly'|'monthly'),
  quantity_tier text? ('0.5'|'1.0'|'1.5'|'2.0'), team_size int?,
  shots_per_drop int, bottles_per_drop int, shots_per_month int, bottles_per_month int,
  price_per_drop_ex_vat numeric?, price_per_month_ex_vat numeric?, vat_per_month numeric?,
  total_per_month_inc_vat numeric?, signup_complete boolean,
  user_id uuid? FK→auth.users,
  crm_status text ('new'|'contacted'|'qualified'|'proposal'|'converted'|'lost'),
  crm_source text? ('landing_page'|'cold_outreach'|'referral'|'event'|'other'),
  assigned_to uuid? FK→auth.users, last_contacted_at timestamptz?

TABLE: ingredients — Product catalogue
  id uuid PK, slug text UNIQUE, name text, format text ('shot'|'share'),
  size_ml int, servings_per_unit int, price_ex_vat numeric,
  price_per_serving_ex_vat numeric (generated col), unit_label text,
  sort_order int, available boolean

TABLE: subscriptions — User subscription plans
  id uuid PK, created_at timestamptz, user_id uuid FK→auth.users NOT NULL,
  ingredients text[], frequency text, team_size int, quantity_tier text,
  shots_per_drop int, bottles_per_drop int, shots_per_month int, bottles_per_month int,
  price_per_drop_ex_vat numeric?, price_per_month_ex_vat numeric?,
  vat_per_month numeric?, total_per_month_inc_vat numeric?,
  status text ('pending'|'active'|'paused'|'cancelled'), lead_id uuid? FK→leads

TABLE: addresses — Billing + delivery addresses
  id uuid PK, created_at timestamptz, user_id uuid FK→auth.users,
  type text ('billing'|'delivery'), label text?, line1 text, line2 text?,
  city text, postcode text, country text (default 'GB'), is_default boolean

TABLE: lead_notes — CRM activity log
  id uuid PK, created_at timestamptz, lead_id uuid FK→leads, author_id uuid FK→auth.users,
  note text, note_type text ('note'|'call'|'email'|'status_change')

TABLE: email_logs — Email sending history
  id uuid PK, created_at timestamptz, to_email text, to_user_id uuid? FK→auth.users,
  to_lead_id uuid? FK→leads, subject text, template_name text,
  campaign_id uuid? FK→email_campaigns, status text ('sent'|'failed'), metadata jsonb

TABLE: email_campaigns — Bulk email campaigns
  id uuid PK, created_at timestamptz, name text, subject text, body_html text,
  target text ('all_leads'|'unconverted_leads'|'active_users'|'pending_subs'|'custom'),
  status text ('draft'|'sent'), sent_at timestamptz?, sent_by uuid? FK→auth.users,
  recipient_count int

TABLE: auth.users — Supabase auth (service role access)
  id uuid PK, email text, created_at timestamptz, last_sign_in_at timestamptz,
  raw_user_meta_data jsonb (contains 'full_name' key)

RULES:
1. Return ONLY the SQL inside a \`\`\`sql ... \`\`\` code block — no explanation, no prose.
2. Only SELECT statements are allowed (no INSERT/UPDATE/DELETE/DROP/CREATE/ALTER).
3. Always add LIMIT 100 unless the user asks for a different amount.
4. Use descriptive column aliases (e.g. l.email AS lead_email).
5. For user display names: raw_user_meta_data->>'full_name' AS full_name.
6. Use now() for current timestamp, current_date for today's date.`;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

function extractSQL(text: string): string | null {
  let sql: string | null = null;
  // 1. ```sql ... ```
  const sqlBlock = text.match(/```sql\s*([\s\S]*?)```/i);
  if (sqlBlock) sql = sqlBlock[1].trim();
  // 2. ``` ... ```
  if (!sql) {
    const plainBlock = text.match(/```\s*([\s\S]*?)```/);
    if (plainBlock) sql = plainBlock[1].trim();
  }
  // 3. Bare SELECT / WITH
  if (!sql) {
    const bare = text.trim();
    if (/^(select|with)\s/i.test(bare)) sql = bare;
  }
  // Strip trailing semicolons — they break the subquery wrapper in admin_exec_query
  if (sql) sql = sql.replace(/;\s*$/, "").trim();
  return sql;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let question: string;
  try {
    const body = await req.json();
    question = (body.question ?? "").trim();
    if (!question) throw new Error("empty");
  } catch {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  // 1. Ask Claude to generate SQL
  let generatedSQL: string;
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SCHEMA_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return NextResponse.json(
        { error: `Claude API returned ${anthropicRes.status}: ${errBody}` },
        { status: 502 }
      );
    }

    const json = await anthropicRes.json();
    const rawText: string = json.content?.[0]?.text ?? "";
    const sql = extractSQL(rawText);
    if (!sql) {
      return NextResponse.json(
        {
          error:
            "Claude did not return a recognisable SQL query. Try rephrasing your question.",
          raw: rawText,
        },
        { status: 422 }
      );
    }
    generatedSQL = sql;
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach Claude API: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  // 2. Execute via admin_exec_query stored function
  const service = createServiceClient();
  const { data, error: rpcError } = await service.rpc("admin_exec_query", {
    query_text: generatedSQL,
  });

  if (rpcError) {
    return NextResponse.json({
      sql: generatedSQL,
      error: rpcError.message,
      results: null,
      columns: [],
    });
  }

  const results: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data
    ? [data as Record<string, unknown>]
    : [];
  const columns = results.length > 0 ? Object.keys(results[0]) : [];

  return NextResponse.json({ sql: generatedSQL, results, columns, error: null });
}
