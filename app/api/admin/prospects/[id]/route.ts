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
 * GET /api/admin/prospects/[id]
 * Full contact detail including campaign send history.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [contactRes, sendsRes, eventsRes] = await Promise.all([
    service.from("prospect_contacts").select("*").eq("id", id).single(),
    service
      .from("campaign_sends")
      .select("*, email_campaigns(id, name, subject, sent_at, status)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("campaign_events")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (contactRes.error || !contactRes.data) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({
    contact: contactRes.data,
    sends:   sendsRes.data ?? [],
    events:  eventsRes.data ?? [],
  });
}

/**
 * PATCH /api/admin/prospects/[id]
 * Update editable fields on a prospect contact.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ALLOWED = [
    "name", "role", "organisation", "website", "phone",
    "city", "borough", "country",
    "category", "sub_category", "tags",
    "source_type", "source_url", "source_domain", "acquisition_method",
    "email_type", "email_confidence", "email_verified",
    "lifecycle_stage", "status",
    "quality_score", "reviewed", "notes",
    "lead_id", "user_id",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // If lifecycle_stage is being advanced, stamp the timestamp
  if ("lifecycle_stage" in patch) {
    patch.lifecycle_updated_at = new Date().toISOString();
  }

  // If being set as reviewed, stamp reviewer
  if (patch.reviewed === true) {
    patch.reviewed_by = adminUser.id;
    patch.reviewed_at = new Date().toISOString();
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("prospect_contacts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/admin/prospects/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

/**
 * DELETE /api/admin/prospects/[id]
 * Hard-deletes a contact. Cascades to campaign_sends and campaign_events.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from("prospect_contacts").delete().eq("id", id);

  if (error) {
    console.error("[DELETE /api/admin/prospects/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
