import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("lists/members");

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * POST /api/admin/lists/[id]/members
 * Add contacts to a manual list.
 * Body: { contact_ids: string[] }
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { contact_ids?: string[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const contactIds = body.contact_ids;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return NextResponse.json({ error: "contact_ids array is required" }, { status: 400 });
  }

  log.input("POST /api/admin/lists/[id]/members", { list_id: id, contact_count: contactIds.length });

  const service = createServiceClient();

  // Upsert (ignore duplicate key conflicts)
  const rows = contactIds.map((cid) => ({ list_id: id, contact_id: cid }));
  const { error } = await service
    .from("prospect_list_members")
    .upsert(rows, { onConflict: "list_id,contact_id", ignoreDuplicates: true });

  if (error) {
    log.error("INSERT prospect_list_members failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update denormalised contact_count
  const { count } = await service
    .from("prospect_list_members")
    .select("*", { count: "exact", head: true })
    .eq("list_id", id);

  await service
    .from("prospect_lists")
    .update({ contact_count: count ?? 0 })
    .eq("id", id);

  log.done("members added", { list_id: id, added: contactIds.length });
  return NextResponse.json({ ok: true, added: contactIds.length });
}

/**
 * DELETE /api/admin/lists/[id]/members
 * Remove contacts from a manual list.
 * Body: { contact_ids: string[] }
 */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { contact_ids?: string[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const contactIds = body.contact_ids;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return NextResponse.json({ error: "contact_ids array is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("prospect_list_members")
    .delete()
    .eq("list_id", id)
    .in("contact_id", contactIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await service
    .from("prospect_list_members")
    .select("*", { count: "exact", head: true })
    .eq("list_id", id);

  await service
    .from("prospect_lists")
    .update({ contact_count: count ?? 0 })
    .eq("id", id);

  return NextResponse.json({ ok: true, removed: contactIds.length });
}
