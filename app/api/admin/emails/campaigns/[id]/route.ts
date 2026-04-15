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
 * GET /api/admin/emails/campaigns/[id]
 * Campaign detail with email log.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [campaignRes, logsRes] = await Promise.all([
    service.from("email_campaigns").select("*").eq("id", id).single(),
    service.from("email_logs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }),
  ]);

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign: campaignRes.data, logs: logsRes.data ?? [] });
}

/**
 * PATCH /api/admin/emails/campaigns/[id]
 * Update a draft campaign.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ALLOWED = ["name", "subject", "body_html", "target"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("email_campaigns")
    .update(patch)
    .eq("id", id)
    .eq("status", "draft") // only allow editing drafts
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}

/**
 * DELETE /api/admin/emails/campaigns/[id]
 * Delete a draft campaign.
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
