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
 * GET /api/admin/contacts
 * Returns all authenticated users enriched with subscription data.
 * Uses Supabase admin auth API to list users.
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const service = createServiceClient();

  // Fetch users via admin auth API (service role only)
  const { data: authData, error: authErr } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });

  if (authErr) {
    console.error("[GET /api/admin/contacts]", authErr.message);
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const users = authData?.users ?? [];

  // Fetch all subscriptions to enrich contacts
  const { data: subs } = await service
    .from("subscriptions")
    .select("user_id, status, total_per_month_inc_vat");

  // Fetch linked leads
  const { data: leads } = await service
    .from("leads")
    .select("user_id, company")
    .not("user_id", "is", null);

  const subsMap = new Map<string, typeof subs>();
  for (const sub of subs ?? []) {
    if (!subsMap.has(sub.user_id)) subsMap.set(sub.user_id, []);
    subsMap.get(sub.user_id)!.push(sub);
  }

  const leadsMap = new Map<string, string>();
  for (const lead of leads ?? []) {
    if (lead.user_id) leadsMap.set(lead.user_id, lead.company);
  }

  const contacts = users.map((u) => {
    const userSubs = subsMap.get(u.id) ?? [];
    const activeSub = userSubs.find((s) => s.status === "active");
    const mrr = activeSub?.total_per_month_inc_vat ?? 0;
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: (u.user_metadata?.full_name as string | null) ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      subscription_count: userSubs.length,
      active_subscription: !!activeSub,
      mrr: Number(mrr),
      lead_company: leadsMap.get(u.id) ?? null,
    };
  });

  const filtered = q
    ? contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(q.toLowerCase()) ||
          (c.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (c.lead_company ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : contacts;

  return NextResponse.json({ contacts: filtered, total: filtered.length });
}
