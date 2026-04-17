import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/campaigns
 *
 * List all prospect-targeting campaigns (campaign_type = prospect_only | mixed).
 * Legacy leads_only campaigns live at /api/admin/emails/campaigns.
 *
 * Query params:
 *   status   — "draft" | "sent" (omit for all)
 *   limit    — default 50
 *   offset   — default 0
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const service = createServiceClient();
  let query = service
    .from("email_campaigns")
    .select("*", { count: "exact" })
    .in("campaign_type", ["prospect_only", "mixed"])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) {
    console.error("[GET /api/admin/campaigns]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/admin/campaigns
 *
 * Create a new prospect campaign draft.
 *
 * Body:
 *   name               — required
 *   subject            — required
 *   body_html          — required
 *   preview_text       — optional
 *   campaign_type      — "prospect_only" | "mixed" (default: "prospect_only")
 *   category_filter    — string[] (empty = all categories)
 *   lifecycle_filter   — string[] (empty = all stages)
 *   sub_category_filter — string[]
 *   cta_label          — optional
 *   cta_url            — optional
 *   secondary_cta_label — optional
 *   secondary_cta_url  — optional
 *   utm_campaign       — optional
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name      = (body.name as string | undefined)?.trim();
  const subject   = (body.subject as string | undefined)?.trim();
  const body_html = (body.body_html as string | undefined) ?? "";

  if (!name)      return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!subject)   return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!body_html) return NextResponse.json({ error: "body_html is required" }, { status: 400 });

  const campaign_type = (["prospect_only", "mixed"].includes(body.campaign_type as string)
    ? body.campaign_type
    : "prospect_only") as string;

  const service = createServiceClient();
  const { data: campaign, error } = await service
    .from("email_campaigns")
    .insert({
      name,
      subject,
      body_html,
      preview_text:        (body.preview_text as string | null) ?? null,
      campaign_type,
      category_filter:     Array.isArray(body.category_filter)     ? body.category_filter     : [],
      lifecycle_filter:    Array.isArray(body.lifecycle_filter)    ? body.lifecycle_filter    : [],
      sub_category_filter: Array.isArray(body.sub_category_filter) ? body.sub_category_filter : [],
      cta_label:           (body.cta_label as string | null)           ?? null,
      cta_url:             (body.cta_url as string | null)             ?? null,
      secondary_cta_label: (body.secondary_cta_label as string | null) ?? null,
      secondary_cta_url:   (body.secondary_cta_url as string | null)   ?? null,
      utm_campaign:        (body.utm_campaign as string | null)        ?? null,
      target:              "prospect_contacts",  // legacy field, keep set
      status:              "draft",
      sent_by:             adminUser.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[POST /api/admin/campaigns]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[campaigns] created campaign draft id=${campaign.id} name="${name}"`);
  return NextResponse.json({ campaign }, { status: 201 });
}
