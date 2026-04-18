import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("lists/route");

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/lists
 * List all prospect lists.
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const list_type = searchParams.get("list_type") ?? "";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  log.input("GET /api/admin/lists", { list_type: list_type || "(all)", limit, offset });

  const service = createServiceClient();
  let query = service
    .from("prospect_lists")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (list_type) query = query.eq("list_type", list_type);

  const { data, error, count } = await query;
  if (error) {
    log.error("SELECT prospect_lists failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.dbResult("lists fetched", { rows: data?.length ?? 0, total: count ?? 0 });
  return NextResponse.json({ lists: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/admin/lists
 * Create a new list.
 *
 * Body:
 *   name               — required
 *   description        — optional
 *   list_type          — "manual" | "filter" (default: manual)
 *   category_filter    — string[] (filter lists only)
 *   lifecycle_filter   — string[]
 *   sub_category_filter — string[]
 *   status_filter      — string[]
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name      = (body.name as string | undefined)?.trim();
  const list_type = (["manual", "filter"].includes(body.list_type as string) ? body.list_type : "manual") as string;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  log.input("POST /api/admin/lists", { name, list_type });

  const service = createServiceClient();
  const { data, error } = await service
    .from("prospect_lists")
    .insert({
      name,
      description:         (body.description as string | null) ?? null,
      list_type,
      category_filter:     Array.isArray(body.category_filter)     ? body.category_filter     : [],
      lifecycle_filter:    Array.isArray(body.lifecycle_filter)    ? body.lifecycle_filter    : [],
      sub_category_filter: Array.isArray(body.sub_category_filter) ? body.sub_category_filter : [],
      status_filter:       Array.isArray(body.status_filter)       ? body.status_filter       : [],
      created_by:          adminUser.id,
    })
    .select("*")
    .single();

  if (error) {
    log.error("INSERT prospect_lists failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.done("list created", { id: data.id, name, list_type });
  return NextResponse.json({ list: data }, { status: 201 });
}
