import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/campaigns/[id]
 * Campaign detail + campaign_sends summary + campaign_events breakdown.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [campaignRes, sendsRes, eventsRes] = await Promise.all([
    service.from("email_campaigns").select("*").eq("id", id).single(),
    service
      .from("campaign_sends")
      .select("id, email, status, created_at, contact_id, lead_id")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    service
      .from("campaign_events")
      .select("event_type, cta_slot, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Aggregate event counts for quick stats
  const eventCounts: Record<string, number> = {};
  for (const e of (eventsRes.data ?? [])) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;
  }

  return NextResponse.json({
    campaign:     campaignRes.data,
    sends:        sendsRes.data ?? [],
    events:       eventsRes.data ?? [],
    event_counts: eventCounts,
  });
}

/**
 * PATCH /api/admin/campaigns/[id]
 * Update a draft campaign. Sent campaigns are read-only.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ALLOWED = [
    "name", "subject", "body_html", "preview_text",
    "campaign_type",
    "category_filter", "lifecycle_filter", "sub_category_filter",
    "cta_label", "cta_url", "secondary_cta_label", "secondary_cta_url",
    "utm_campaign",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("email_campaigns")
    .update(patch)
    .eq("id", id)
    .eq("status", "draft")   // guard: only drafts are editable
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/admin/campaigns/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Campaign not found or already sent" }, { status: 404 });
  }

  return NextResponse.json({ campaign: data });
}

/**
 * DELETE /api/admin/campaigns/[id]
 * Delete a draft campaign (cannot delete sent campaigns).
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service
    .from("email_campaigns")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    console.error("[DELETE /api/admin/campaigns/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
