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
 * GET /api/admin/reports
 * Aggregated metrics dashboard data.
 */
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoISO = ninetyDaysAgo.toISOString();

  const [
    leadsRes,
    subsRes,
    emailsRes,
    authRes,
    recentLeadsRes,
    emailsByDayRes,
  ] = await Promise.all([
    // All leads with crm_status
    service.from("leads").select("id, crm_status, created_at, signup_complete"),
    // All subscriptions with pricing
    service.from("subscriptions").select("id, status, total_per_month_inc_vat, created_at"),
    // Emails sent in last 30 days
    service
      .from("email_logs")
      .select("id, status, template_name, created_at")
      .gte("created_at", thirtyDaysAgoISO),
    // Auth users (contacts)
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
    // Leads created in last 90 days for trend
    service
      .from("leads")
      .select("id, created_at")
      .gte("created_at", ninetyDaysAgoISO)
      .order("created_at", { ascending: true }),
    // Email logs last 30 days for send volume by day
    service
      .from("email_logs")
      .select("created_at, status")
      .gte("created_at", thirtyDaysAgoISO)
      .order("created_at", { ascending: true }),
  ]);

  const leads = leadsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const emails = emailsRes.data ?? [];
  const authUsers = authRes.data?.users ?? [];
  const recentLeads = recentLeadsRes.data ?? [];

  // --- Lead metrics ---
  const total_leads = leads.length;
  const converted_leads = leads.filter((l) => l.signup_complete).length;
  const conversion_rate =
    total_leads > 0 ? Math.round((converted_leads / total_leads) * 100) : 0;

  // Leads by CRM status
  const statusCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.crm_status ?? "new";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  const leads_by_status = [
    "new", "contacted", "qualified", "proposal", "converted", "lost",
  ].map((s) => ({ status: s, count: statusCounts[s] ?? 0 }));

  // --- Subscription / MRR metrics ---
  const active_subs = subs.filter((s) => s.status === "active").length;
  const pending_subs = subs.filter((s) => s.status === "pending").length;

  const active_mrr = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (Number(s.total_per_month_inc_vat) || 0), 0);

  const pipeline_mrr = subs
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + (Number(s.total_per_month_inc_vat) || 0), 0);

  // --- Email metrics ---
  const emails_sent_30d = emails.filter((e) => e.status === "sent").length;
  const emails_failed_30d = emails.filter((e) => e.status === "failed").length;

  // Emails by template (top 5)
  const templateCounts: Record<string, number> = {};
  for (const e of emails) {
    if (e.status === "sent") {
      templateCounts[e.template_name] = (templateCounts[e.template_name] ?? 0) + 1;
    }
  }
  const emails_by_template = Object.entries(templateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([template, count]) => ({ template, count }));

  // --- Contact metrics ---
  const total_contacts = authUsers.length;

  // --- Trend: leads created per week over last 90 days ---
  const weeklyLeads: Record<string, number> = {};
  for (const l of recentLeads) {
    const d = new Date(l.created_at);
    // ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    const key = weekStart.toISOString().substring(0, 10);
    weeklyLeads[key] = (weeklyLeads[key] ?? 0) + 1;
  }
  const leads_over_time = Object.entries(weeklyLeads)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  // --- Trend: emails sent per day over last 30 days ---
  const dailyEmails = emailsByDayRes.data ?? [];
  const emailsByDay: Record<string, number> = {};
  for (const e of dailyEmails) {
    if (e.status === "sent") {
      const key = e.created_at.substring(0, 10);
      emailsByDay[key] = (emailsByDay[key] ?? 0) + 1;
    }
  }
  const emails_over_time = Object.entries(emailsByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    // Lead metrics
    total_leads,
    converted_leads,
    conversion_rate,
    leads_by_status,
    leads_over_time,

    // Subscription / MRR
    active_subs,
    pending_subs,
    active_mrr: Math.round(active_mrr * 100) / 100,
    pipeline_mrr: Math.round(pipeline_mrr * 100) / 100,

    // Email
    emails_sent_30d,
    emails_failed_30d,
    emails_by_template,
    emails_over_time,

    // Contacts
    total_contacts,
  });
}
