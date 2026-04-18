import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { isSendable } from "@/lib/prospects";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("lists/[id]");

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/lists/[id]
 * List detail. For filter-based lists, resolves contacts live.
 * For manual lists, returns member contacts from the junction table.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  log.db("SELECT prospect_lists", { id });
  const { data: list, error } = await service
    .from("prospect_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !list) {
    log.error("list not found", { id });
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Resolve contacts
  let contacts: unknown[] = [];
  let resolvedCount = 0;

  if (list.list_type === "manual") {
    log.db("SELECT prospect_list_members JOIN prospect_contacts", { list_id: id });
    const { data: members } = await service
      .from("prospect_list_members")
      .select("contact_id, added_at, prospect_contacts(id, email, name, organisation, category, lifecycle_stage, status, quality_score)")
      .eq("list_id", id)
      .order("added_at", { ascending: false });

    contacts  = (members ?? []).map((m) => ({ ...m.prospect_contacts, added_at: m.added_at }));
    resolvedCount = contacts.length;
  } else {
    // Filter-based: resolve dynamically
    log.db("SELECT prospect_contacts — filter-based list resolution", { list_id: id });
    let query = service
      .from("prospect_contacts")
      .select("id, email, name, organisation, category, lifecycle_stage, status, quality_score")
      .eq("status", "active");

    if ((list.category_filter as string[])?.length > 0)      query = query.in("category",       list.category_filter);
    if ((list.lifecycle_filter as string[])?.length > 0)     query = query.in("lifecycle_stage", list.lifecycle_filter);
    if ((list.sub_category_filter as string[])?.length > 0)  query = query.in("sub_category",    list.sub_category_filter);

    const { data } = await query;
    contacts = (data ?? []).filter((c) => isSendable({ status: c.status, lifecycle_stage: c.lifecycle_stage }));
    resolvedCount = contacts.length;
  }

  log.dbResult("list resolved", { id, list_type: list.list_type, contacts: resolvedCount });
  return NextResponse.json({ list, contacts, count: resolvedCount });
}

/**
 * PATCH /api/admin/lists/[id]
 * Update list metadata / filter criteria.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ALLOWED = ["name", "description", "list_type", "category_filter", "lifecycle_filter", "sub_category_filter", "status_filter"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("prospect_lists")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    log.error("UPDATE prospect_lists failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.done("list updated", { id });
  return NextResponse.json({ list: data });
}

/**
 * DELETE /api/admin/lists/[id]
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from("prospect_lists").delete().eq("id", id);

  if (error) {
    log.error("DELETE prospect_lists failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.done("list deleted", { id });
  return NextResponse.json({ ok: true });
}
