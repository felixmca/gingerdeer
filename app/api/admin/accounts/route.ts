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
 * GET /api/admin/accounts
 * Company-level aggregation of leads + contacts.
 */
export async function GET(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const service = createServiceClient();

  const { data: leads, error } = await service
    .from("leads")
    .select("id, company, crm_status, signup_complete, total_per_month_inc_vat, created_at, user_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by company
  const companyMap = new Map<
    string,
    {
      company: string;
      lead_count: number;
      contact_count: number;
      pipeline_mrr: number;
      lead_ids: string[];
      statuses: string[];
      latest_activity: string;
    }
  >();

  for (const lead of leads ?? []) {
    const key = (lead.company ?? "Unknown").trim();
    if (!companyMap.has(key)) {
      companyMap.set(key, {
        company: key,
        lead_count: 0,
        contact_count: 0,
        pipeline_mrr: 0,
        lead_ids: [],
        statuses: [],
        latest_activity: lead.created_at,
      });
    }
    const acc = companyMap.get(key)!;
    acc.lead_count += 1;
    acc.lead_ids.push(lead.id);
    acc.statuses.push(lead.crm_status ?? "new");
    acc.pipeline_mrr += Number(lead.total_per_month_inc_vat ?? 0);
    if (lead.signup_complete) acc.contact_count += 1;
    if (lead.created_at > acc.latest_activity) acc.latest_activity = lead.created_at;
  }

  const STATUS_RANK: Record<string, number> = {
    converted: 6, proposal: 5, qualified: 4, contacted: 3, new: 2, lost: 1,
  };

  const accounts = Array.from(companyMap.values())
    .map((acc) => ({
      company: acc.company,
      lead_count: acc.lead_count,
      contact_count: acc.contact_count,
      pipeline_mrr: Math.round(acc.pipeline_mrr * 100) / 100,
      best_status: acc.statuses.sort(
        (a, b) => (STATUS_RANK[b] ?? 0) - (STATUS_RANK[a] ?? 0)
      )[0] ?? "new",
      latest_activity: acc.latest_activity,
    }))
    .sort((a, b) => b.pipeline_mrr - a.pipeline_mrr);

  const filtered = q
    ? accounts.filter((a) => a.company.toLowerCase().includes(q.toLowerCase()))
    : accounts;

  return NextResponse.json({ accounts: filtered, total: filtered.length });
}
