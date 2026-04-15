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
 * GET /api/admin/opportunities
 * All subscriptions enriched with user email + company from linked lead.
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q")?.trim() ?? "";

  const service = createServiceClient();

  let query = service
    .from("subscriptions")
    .select("*, leads(company, email, crm_status)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: subs, error } = await query;
  if (error) {
    console.error("[GET /api/admin/opportunities]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with user email from auth.users
  const { data: authData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 });
  const userMap = new Map<string, string>();
  for (const u of authData?.users ?? []) {
    userMap.set(u.id, u.email ?? "");
  }

  const opportunities = (subs ?? []).map((sub) => {
    const lead = Array.isArray(sub.leads) ? sub.leads[0] : sub.leads;
    return {
      ...sub,
      user_email: userMap.get(sub.user_id) ?? "",
      company: (lead as { company?: string } | null)?.company ?? "",
      leads: undefined,
    };
  });

  const filtered = q
    ? opportunities.filter(
        (o) =>
          o.user_email.toLowerCase().includes(q.toLowerCase()) ||
          o.company.toLowerCase().includes(q.toLowerCase())
      )
    : opportunities;

  return NextResponse.json({ opportunities: filtered, total: filtered.length });
}
