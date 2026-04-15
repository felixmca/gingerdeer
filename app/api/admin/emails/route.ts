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
 * GET /api/admin/emails
 * Returns email log with optional filters.
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q        = searchParams.get("q")?.trim() ?? "";
  const template = searchParams.get("template") ?? "";
  const status   = searchParams.get("status") ?? "";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  const service = createServiceClient();

  let query = service
    .from("email_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (template) query = query.eq("template_name", template);
  if (status)   query = query.eq("status", status);
  if (q)        query = query.ilike("to_email", `%${q}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error("[GET /api/admin/emails]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emails: data ?? [], total: count ?? 0 });
}
