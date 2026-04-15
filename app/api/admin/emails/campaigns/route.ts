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
 * GET /api/admin/emails/campaigns
 * List all email campaigns.
 */
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data ?? [] });
}

/**
 * POST /api/admin/emails/campaigns
 * Create a new campaign (draft or send immediately).
 */
export async function POST(request: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name     = (body.name as string | undefined)?.trim();
  const subject  = (body.subject as string | undefined)?.trim();
  const body_html = (body.body_html as string | undefined) ?? "";
  const target   = (body.target as string | undefined) ?? "unconverted_leads";
  const send_now = Boolean(body.send_now);

  if (!name)    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });

  const service = createServiceClient();

  const { data: campaign, error: insertErr } = await service
    .from("email_campaigns")
    .insert({
      name, subject, body_html, target,
      status: "draft",
      sent_by: adminUser.id,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  if (!send_now) {
    return NextResponse.json({ campaign });
  }

  // Send immediately — resolve recipients based on target
  const recipients = await resolveRecipients(service, target);

  const { Resend } = await import("resend");
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  let sent = 0;
  const logs = [];

  for (const r of recipients) {
    let emailStatus: "sent" | "failed" = "sent";
    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Juice for Teams <onboarding@resend.dev>",
          to: r.email,
          subject,
          html: body_html,
        });
        sent++;
      } catch {
        emailStatus = "failed";
      }
    } else {
      emailStatus = "failed";
    }

    logs.push({
      to_email: r.email,
      to_user_id: r.user_id ?? null,
      to_lead_id: r.lead_id ?? null,
      subject,
      template_name: "campaign",
      campaign_id: campaign.id,
      status: emailStatus,
      metadata: { campaign_name: name, target },
    });
  }

  // Batch-insert email logs
  if (logs.length > 0) {
    await service.from("email_logs").insert(logs);
  }

  // Mark campaign as sent
  const { data: updated } = await service
    .from("email_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sent,
    })
    .eq("id", campaign.id)
    .select("*")
    .single();

  return NextResponse.json({ campaign: updated, sent, total: recipients.length });
}

type Recipient = { email: string; user_id?: string; lead_id?: string };

async function resolveRecipients(
  service: ReturnType<typeof import("@/lib/supabase/service").createServiceClient>,
  target: string
): Promise<Recipient[]> {
  if (target === "all_leads") {
    const { data } = await service.from("leads").select("id, email");
    return (data ?? []).map((l) => ({ email: l.email, lead_id: l.id }));
  }

  if (target === "unconverted_leads") {
    const { data } = await service
      .from("leads")
      .select("id, email")
      .eq("signup_complete", false);
    return (data ?? []).map((l) => ({ email: l.email, lead_id: l.id }));
  }

  if (target === "active_users") {
    const { data: authData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 });
    return (authData?.users ?? []).map((u) => ({ email: u.email ?? "", user_id: u.id }));
  }

  if (target === "pending_subs") {
    const { data: subs } = await service
      .from("subscriptions")
      .select("user_id")
      .eq("status", "pending");
    if (!subs?.length) return [];
    const userIds = subs.map((s) => s.user_id);
    const { data: authData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 });
    return (authData?.users ?? [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => ({ email: u.email ?? "", user_id: u.id }));
  }

  return [];
}
