import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { buildTrackingUrl } from "@/lib/prospects";
import { resolveProspectRecipients } from "../preview/route";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("campaigns/send");

type Params = { params: Promise<{ id: string }> };

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM     = process.env.RESEND_FROM_EMAIL   ?? "Juice for Teams <hello@juiceforteams.com>";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * POST /api/admin/campaigns/[id]/send
 *
 * Sends a prospect campaign.
 * 1. Resolves recipients using campaign filters
 * 2. Deduplicates against existing campaign_sends (skips already-sent)
 * 3. Inserts a campaign_sends row per recipient (with unique tracking_token)
 * 4. Builds personalised HTML (injects CTA tracking URLs + unsubscribe link)
 * 5. Sends via Resend in batches
 * 6. Updates campaign status → "sent"
 *
 * Returns: { sent, skipped_already_sent, failed, total_resolved }
 */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  log.input(`POST /api/admin/campaigns/${id}/send`, { campaign_id: id, admin: adminUser.email });

  // ── 1. Load campaign ────────────────────────────────────────────────────
  log.db("SELECT email_campaigns", { id });
  const { data: campaign, error: campErr } = await service
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (campErr || !campaign) {
    log.error("campaign not found", { id, message: campErr?.message });
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  log.dbResult("campaign loaded", { id, name: campaign.name, status: campaign.status, campaign_type: campaign.campaign_type });

  if (campaign.status === "sent") {
    log.warn("campaign already sent — aborting", { id });
    return NextResponse.json({ error: "Campaign already sent" }, { status: 409 });
  }
  if (!campaign.body_html) {
    return NextResponse.json({ error: "Campaign has no body_html" }, { status: 400 });
  }

  // ── 2. Resolve recipients ────────────────────────────────────────────────
  log.info("resolveProspectRecipients", {
    campaign_type: campaign.campaign_type,
    category_filter: campaign.category_filter,
    lifecycle_filter: campaign.lifecycle_filter,
    sub_category_filter: campaign.sub_category_filter,
  });
  const recipients = await resolveProspectRecipients(service, campaign);
  log.result("recipients resolved", { count: recipients.length });

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No eligible recipients for this campaign" }, { status: 400 });
  }

  // ── 3. Skip already-sent (re-send guard) ────────────────────────────────
  log.db("SELECT campaign_sends — re-send guard", { campaign_id: id });
  const { data: existingSends } = await service
    .from("campaign_sends")
    .select("contact_id")
    .eq("campaign_id", id);

  const alreadySentIds = new Set((existingSends ?? []).map((s) => s.contact_id as string));
  const toSend = recipients.filter((r) => !alreadySentIds.has(r.contact_id));
  const skipped = recipients.length - toSend.length;

  log.transform("re-send dedup", { total_recipients: recipients.length, to_send: toSend.length, skipped_already_sent: skipped });

  if (toSend.length === 0) {
    log.warn("all recipients already sent — aborting", { skipped });
    return NextResponse.json({
      sent:                 0,
      skipped_already_sent: skipped,
      failed:               0,
      total_resolved:       recipients.length,
    });
  }

  // ── 4. Insert campaign_sends rows (generates tracking tokens via DB default) ──
  const sendRows = toSend.map((r) => ({
    campaign_id: id,
    contact_id:  r.contact_id,
    email:       r.email,
    status:      "pending" as const,
  }));

  log.db("INSERT campaign_sends", { rows: sendRows.length });
  const { data: insertedSends, error: sendInsertErr } = await service
    .from("campaign_sends")
    .insert(sendRows)
    .select("id, email, contact_id, tracking_token");

  if (sendInsertErr || !insertedSends) {
    log.error("INSERT campaign_sends failed", { message: sendInsertErr?.message });
    return NextResponse.json({ error: "Failed to create send records" }, { status: 500 });
  }
  log.dbResult("campaign_sends inserted", { rows: insertedSends.length });

  // ── 5. Resolve Resend client ─────────────────────────────────────────────
  const { Resend } = await import("resend");
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) log.warn("RESEND_API_KEY not set — emails will be marked failed");

  // Build a name-lookup for personalisation
  const nameByEmail = new Map(toSend.map((r) => [r.email, r.name]));

  // ── 6. Send emails ───────────────────────────────────────────────────────
  log.info("sending emails via Resend", { to_send: insertedSends.length, from: FROM });
  let sent    = 0;
  let failed  = 0;
  const statusUpdates: { id: string; status: "sent" | "failed" }[] = [];

  for (const sendRow of insertedSends) {
    const token       = sendRow.tracking_token as string;
    const contactName = nameByEmail.get(sendRow.email) ?? null;
    const html        = buildEmailHtml(campaign, token, contactName);

    if (resend) {
      try {
        await resend.emails.send({
          from:    FROM,
          to:      sendRow.email,
          subject: campaign.subject,
          html,
        });
        sent++;
        statusUpdates.push({ id: sendRow.id, status: "sent" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Resend failed for ${sendRow.email}`, { message: msg, tracking_token: token });
        failed++;
        statusUpdates.push({ id: sendRow.id, status: "failed" });
      }
    } else {
      // Resend not configured — mark all failed
      failed++;
      statusUpdates.push({ id: sendRow.id, status: "failed" });
    }
  }

  log.result("email sending complete", { sent, failed });

  // ── 7. Update campaign_sends statuses in batch ───────────────────────────
  const sentIds   = statusUpdates.filter((u) => u.status === "sent").map((u) => u.id);
  const failedIds = statusUpdates.filter((u) => u.status === "failed").map((u) => u.id);

  log.db("UPDATE campaign_sends statuses", { sent_count: sentIds.length, failed_count: failedIds.length });
  await Promise.all([
    sentIds.length > 0
      ? service.from("campaign_sends").update({ status: "sent",   sent_at: new Date().toISOString() }).in("id", sentIds)
      : Promise.resolve(),
    failedIds.length > 0
      ? service.from("campaign_sends").update({ status: "failed" }).in("id", failedIds)
      : Promise.resolve(),
  ]);

  // ── 8. Mark campaign as sent ─────────────────────────────────────────────
  log.db("UPDATE email_campaigns → sent", { id, recipient_count: sent });
  await service
    .from("email_campaigns")
    .update({
      status:          "sent",
      sent_at:         new Date().toISOString(),
      recipient_count: sent,
    })
    .eq("id", id);

  log.done("campaign send complete", { campaign_id: id, sent, skipped_already_sent: skipped, failed, total_resolved: recipients.length });

  return NextResponse.json({
    sent,
    skipped_already_sent: skipped,
    failed,
    total_resolved: recipients.length,
  });
}

// ── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(
  campaign: Record<string, unknown>,
  trackingToken: string,
  contactName: string | null,
): string {
  const primaryCta   = campaign.cta_label   as string | null;
  const primaryUrl   = campaign.cta_url     as string | null;
  const secondaryCta = campaign.secondary_cta_label as string | null;
  const secondaryUrl = campaign.secondary_cta_url   as string | null;
  const preview      = campaign.preview_text as string | null;

  const primaryTracked   = primaryUrl
    ? buildTrackingUrl(APP_URL, trackingToken, "primary")
    : null;
  const secondaryTracked = secondaryUrl
    ? buildTrackingUrl(APP_URL, trackingToken, "secondary")
    : null;
  const unsubscribeUrl   = buildTrackingUrl(APP_URL, trackingToken, "unsubscribe");

  // Inject tracked URLs into body_html, replacing literal CTA URLs if present
  let bodyHtml = campaign.body_html as string;
  if (primaryUrl && primaryTracked) {
    bodyHtml = bodyHtml.split(primaryUrl).join(primaryTracked);
  }
  if (secondaryUrl && secondaryTracked) {
    bodyHtml = bodyHtml.split(secondaryUrl).join(secondaryTracked);
  }

  // Personalise greeting token if author used {{name}}
  if (contactName) {
    bodyHtml = bodyHtml.split("{{name}}").join(contactName);
  } else {
    bodyHtml = bodyHtml.split("{{name}}").join("there");
  }

  // Build CTA buttons (appended after body if defined and not already in body)
  const ctaButtons = [
    primaryCta && primaryTracked
      ? `<a href="${primaryTracked}"
            style="display:inline-block;margin:8px 8px 8px 0;padding:12px 24px;background:#c2410c;
                   color:#fff;border-radius:999px;text-decoration:none;font-weight:600">
           ${primaryCta}
         </a>`
      : "",
    secondaryCta && secondaryTracked
      ? `<a href="${secondaryTracked}"
            style="display:inline-block;margin:8px 0;padding:12px 24px;background:#f5f5f4;
                   color:#1c1917;border-radius:999px;text-decoration:none;font-weight:600">
           ${secondaryCta}
         </a>`
      : "",
  ].join("");

  // Invisible preview text trick
  const previewSnippet = preview
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#fff">${preview}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fafaf9">
${previewSnippet}
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1917">

  ${bodyHtml}

  ${ctaButtons ? `<div style="margin:24px 0">${ctaButtons}</div>` : ""}

  <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0"/>
  <p style="font-size:12px;color:#a8a29e;margin:0">
    Juice for Teams · B2B ginger juice subscriptions ·
    <a href="${unsubscribeUrl}" style="color:#a8a29e">Unsubscribe</a>
  </p>
</div>
</body>
</html>`;
}
