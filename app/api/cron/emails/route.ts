import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import {
  sendLeadFollowUpEmail,
  sendPendingSubReminderEmail,
} from "@/lib/email";

/**
 * GET /api/cron/emails
 * Vercel Cron — runs every hour via vercel.json.
 * Processes automated follow-up and reminder emails.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { Resend } = await import("resend");
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const service = createServiceClient();

  const now = new Date();
  let processed = 0;
  const errors: string[] = [];

  // ── 1. Lead follow-up emails ─────────────────────────────────────────────
  // We check leads that are NOT converted, have received no follow-up for
  // the relevant window, and whose follow-up hasn't already been sent.

  // Build a set of (lead_id, template_name) already sent to avoid duplicates.
  const { data: sentLogs } = await service
    .from("email_logs")
    .select("to_lead_id, template_name")
    .in("template_name", ["lead_followup_24h", "lead_followup_3d", "lead_followup_7d"])
    .eq("status", "sent");

  const sentSet = new Set<string>(
    (sentLogs ?? []).map((l) => `${l.to_lead_id}::${l.template_name}`)
  );

  const { data: leads } = await service
    .from("leads")
    .select("id, email, company, created_at, signup_complete")
    .eq("signup_complete", false);

  for (const lead of leads ?? []) {
    const createdAt = new Date(lead.created_at);
    const ageMs = now.getTime() - createdAt.getTime();
    const ageH = ageMs / (1000 * 60 * 60);

    type FollowUp = { template: string; dayLabel: "24h" | "3d" | "7d"; minH: number; maxH: number };
    const followUps: FollowUp[] = [
      { template: "lead_followup_24h", dayLabel: "24h", minH: 23,   maxH: 25   },
      { template: "lead_followup_3d",  dayLabel: "3d",  minH: 71,   maxH: 73   },
      { template: "lead_followup_7d",  dayLabel: "7d",  minH: 167,  maxH: 169  },
    ];

    for (const fu of followUps) {
      if (ageH < fu.minH || ageH > fu.maxH) continue;
      const key = `${lead.id}::${fu.template}`;
      if (sentSet.has(key)) continue;

      let status: "sent" | "failed" = "sent";
      try {
        await sendLeadFollowUpEmail(resend, {
          to: lead.email,
          company: lead.company ?? "there",
          dayLabel: fu.dayLabel,
        });
        processed++;
      } catch (e) {
        status = "failed";
        errors.push(`lead_followup ${lead.id} ${fu.dayLabel}: ${String(e)}`);
      }

      await service.from("email_logs").insert({
        to_email: lead.email,
        to_lead_id: lead.id,
        subject: `Lead follow-up (${fu.dayLabel})`,
        template_name: fu.template,
        status,
        metadata: { company: lead.company },
      });

      sentSet.add(key);
    }
  }

  // ── 2. Pending subscription reminders ────────────────────────────────────
  // Send once per pending subscription, ~24h after creation, only if no
  // active subscription exists for that user.

  const { data: pendingSubLogs } = await service
    .from("email_logs")
    .select("to_user_id")
    .eq("template_name", "pending_sub_reminder")
    .eq("status", "sent");

  const alreadyRemindedUserIds = new Set(
    (pendingSubLogs ?? []).map((l) => l.to_user_id).filter(Boolean)
  );

  const { data: pendingSubs } = await service
    .from("subscriptions")
    .select("id, user_id, created_at")
    .eq("status", "pending");

  // Fetch all active subs for fast lookup
  const { data: activeSubs } = await service
    .from("subscriptions")
    .select("user_id")
    .eq("status", "active");

  const activeUserIds = new Set((activeSubs ?? []).map((s) => s.user_id));

  // Fetch auth users for email lookup
  const { data: authData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 });
  const userEmailMap = new Map<string, string>();
  for (const u of authData?.users ?? []) {
    userEmailMap.set(u.id, u.email ?? "");
  }

  for (const sub of pendingSubs ?? []) {
    if (alreadyRemindedUserIds.has(sub.user_id)) continue;
    if (activeUserIds.has(sub.user_id)) continue;

    const createdAt = new Date(sub.created_at);
    const ageH = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (ageH < 23 || ageH > 49) continue; // send once in the 23–49h window

    const email = userEmailMap.get(sub.user_id);
    if (!email) continue;

    let status: "sent" | "failed" = "sent";
    try {
      await sendPendingSubReminderEmail(resend, {
        to: email,
        company: email.split("@")[0], // best-effort; leads table not joined here
      });
      processed++;
    } catch (e) {
      status = "failed";
      errors.push(`pending_sub_reminder ${sub.user_id}: ${String(e)}`);
    }

    await service.from("email_logs").insert({
      to_email: email,
      to_user_id: sub.user_id,
      subject: "Your Juice for Teams subscription is pending",
      template_name: "pending_sub_reminder",
      status,
      metadata: { subscription_id: sub.id },
    });

    alreadyRemindedUserIds.add(sub.user_id);
  }

  return NextResponse.json({ ok: true, processed, errors });
}
