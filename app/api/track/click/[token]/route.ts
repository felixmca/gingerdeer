import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("track/click");

type Params = { params: Promise<{ token: string }> };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/track/click/[token]
 *
 * CTA click tracker. Called by tracked links inside campaign emails.
 *
 * Query params:
 *   slot — "primary" | "secondary" | "unsubscribe" (required)
 *
 * Flow:
 * 1. Looks up tracking_token in campaign_sends → resolves campaign + contact
 * 2. Records a campaign_events row
 * 3. Advances contact lifecycle: contact → opportunity (for primary/secondary clicks)
 * 4. Redirects to the configured CTA destination URL
 *
 * This is an open endpoint (no auth) — token acts as the credential.
 */
export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const slot = (searchParams.get("slot") ?? "primary") as
    | "primary"
    | "secondary"
    | "unsubscribe";

  if (!token) {
    return NextResponse.redirect(APP_URL);
  }

  log.input(`GET /api/track/click/${token.slice(0, 8)}…`, { slot, token_prefix: token.slice(0, 8) });

  // ── 1. Resolve send record ───────────────────────────────────────────────
  const service = createServiceClient();

  log.db("SELECT campaign_sends", { tracking_token: token.slice(0, 8) + "…" });
  const { data: sendRow } = await service
    .from("campaign_sends")
    .select("id, campaign_id, contact_id, lead_id, email, status")
    .eq("tracking_token", token)
    .maybeSingle();

  if (!sendRow) {
    log.warn("unknown tracking token — redirecting to homepage", { token_prefix: token.slice(0, 8) });
    return NextResponse.redirect(APP_URL);
  }
  log.dbResult("send row resolved", { send_id: sendRow.id, campaign_id: sendRow.campaign_id, email: sendRow.email, contact_id: sendRow.contact_id });

  // ── 2. Load campaign for CTA destination URL ─────────────────────────────
  log.db("SELECT email_campaigns", { id: sendRow.campaign_id });
  const { data: campaign } = await service
    .from("email_campaigns")
    .select("cta_url, secondary_cta_url, utm_campaign")
    .eq("id", sendRow.campaign_id)
    .maybeSingle();

  // Determine destination
  let destination = APP_URL;
  if (slot === "primary"   && campaign?.cta_url)           destination = campaign.cta_url;
  if (slot === "secondary" && campaign?.secondary_cta_url) destination = campaign.secondary_cta_url;
  if (slot === "unsubscribe") {
    // Redirect to the unsubscribe confirmation endpoint
    return NextResponse.redirect(
      `${APP_URL}/api/track/unsubscribe/${token}`
    );
  }

  log.transform("destination resolved", { slot, destination: destination.slice(0, 80) });

  // Append UTM params if configured
  if (campaign?.utm_campaign && destination !== APP_URL) {
    try {
      const destUrl = new URL(destination);
      destUrl.searchParams.set("utm_source",   "email");
      destUrl.searchParams.set("utm_medium",   "campaign");
      destUrl.searchParams.set("utm_campaign", campaign.utm_campaign);
      destination = destUrl.toString();
      log.transform("UTM params appended", { utm_campaign: campaign.utm_campaign });
    } catch {
      // destination was not a full URL — leave as-is
    }
  }

  // ── 3. Record event (fire-and-forget style — don't block redirect) ───────
  const ipHeader =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  // Hash IP for privacy (simple substring obfuscation — not crypto hash)
  const ipHint = ipHeader ? ipHeader.split(".").slice(0, 3).join(".") + ".x" : null;

  const eventType =
    slot === "primary"   ? "click_cta_primary"
    : slot === "secondary" ? "click_cta_secondary"
    : "unsubscribe";

  log.db("INSERT campaign_events", { event_type: eventType, cta_slot: slot, campaign_id: sendRow.campaign_id, contact_id: sendRow.contact_id });
  log.db("UPDATE campaign_sends → clicked", { id: sendRow.id });
  if (sendRow.contact_id) {
    log.db("UPDATE prospect_contacts lifecycle contact → opportunity", { contact_id: sendRow.contact_id });
  }

  const [, , lifecycleResult] = await Promise.all([
    // Record event
    service.from("campaign_events").insert({
      tracking_token:  token,
      campaign_id:     sendRow.campaign_id,
      contact_id:      sendRow.contact_id ?? null,
      lead_id:         sendRow.lead_id ?? null,
      event_type:      eventType,
      cta_slot:        slot,
      destination_url: destination,
      ip_hash:         ipHint,
      user_agent_hint: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    }),

    // Mark send as clicked
    service
      .from("campaign_sends")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("id", sendRow.id),

    // Advance lifecycle: contact → opportunity (slot is already "primary"|"secondary" here)
    sendRow.contact_id
      ? service
          .from("prospect_contacts")
          .update({
            lifecycle_stage:      "opportunity",
            lifecycle_updated_at: new Date().toISOString(),
            last_campaign_id:     sendRow.campaign_id,
          })
          .eq("id", sendRow.contact_id)
          .eq("lifecycle_stage", "contact")  // only advance if still at 'contact'
      : Promise.resolve(),
  ]);

  void lifecycleResult; // suppress unused var warning

  log.done("click tracked — redirecting", { destination: destination.slice(0, 80), lifecycle_advanced: !!sendRow.contact_id });

  // ── 4. Redirect ──────────────────────────────────────────────────────────
  return NextResponse.redirect(destination);
}
