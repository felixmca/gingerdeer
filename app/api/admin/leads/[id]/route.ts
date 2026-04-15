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
 * GET /api/admin/leads/[id]
 * Full lead detail with notes + email history.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [leadRes, notesRes, emailsRes] = await Promise.all([
    service.from("leads").select("*").eq("id", id).single(),
    service
      .from("lead_notes")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    service
      .from("email_logs")
      .select("*")
      .eq("to_lead_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (leadRes.error || !leadRes.data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Enrich notes with author emails from auth.users via admin SDK
  const notes = notesRes.data ?? [];

  return NextResponse.json({
    lead: leadRes.data,
    notes,
    emails: emailsRes.data ?? [],
  });
}

/**
 * PATCH /api/admin/leads/[id]
 * Update CRM fields on a lead.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ALLOWED = [
    "crm_status", "crm_source", "assigned_to", "last_contacted_at",
    "company", "role", "frequency", "team_size", "ingredients",
    "quantity_tier", "shots_per_drop", "bottles_per_drop",
    "price_per_drop_ex_vat", "price_per_month_ex_vat",
    "vat_per_month", "total_per_month_inc_vat",
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
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/admin/leads/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If status changed, log it as a note
  if (body.crm_status) {
    await service.from("lead_notes").insert({
      lead_id: id,
      author_id: user.id,
      note: `Status changed to "${body.crm_status}"`,
      note_type: "status_change",
    }).then(() => {});
  }

  return NextResponse.json({ lead: data });
}

/**
 * POST /api/admin/leads/[id]
 * Add a note to the lead's activity log.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const note = (body.note as string | undefined)?.trim();
  const note_type = (body.note_type as string | undefined) ?? "note";

  if (!note) return NextResponse.json({ error: "note is required" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("lead_notes")
    .insert({ lead_id: id, author_id: user.id, note, note_type })
    .select("*")
    .single();

  if (error) {
    console.error("[POST /api/admin/leads/[id] note]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}

/**
 * DELETE /api/admin/leads/[id]
 * Hard delete a lead (admin only).
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from("leads").delete().eq("id", id);

  if (error) {
    console.error("[DELETE /api/admin/leads/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
