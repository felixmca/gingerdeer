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
 * GET /api/admin/leads
 * Returns all leads with optional search/filter params.
 */
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q        = searchParams.get("q")?.trim() ?? "";
  const status   = searchParams.get("status") ?? "";
  const source   = searchParams.get("source") ?? "";
  const converted = searchParams.get("converted") ?? "";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  const service = createServiceClient();
  let query = service
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)    query = query.eq("crm_status", status);
  if (source)    query = query.eq("crm_source", source);
  if (converted === "true")  query = query.eq("signup_complete", true);
  if (converted === "false") query = query.eq("signup_complete", false);
  if (q) {
    query = query.or(`email.ilike.%${q}%,company.ilike.%${q}%,role.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[GET /api/admin/leads]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [], total: count ?? 0 });
}
