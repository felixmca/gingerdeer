import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ token: string }> };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/track/unsubscribe/[token]
 *
 * One-click unsubscribe handler. Called by the unsubscribe tracking link.
 *
 * Flow:
 * 1. Resolves campaign_sends row by tracking_token
 * 2. Sets prospect_contacts.status = 'unsubscribed'
 * 3. Records a campaign_events row with event_type = 'unsubscribe'
 * 4. Returns a plain confirmation page (no redirect — stays here)
 *
 * This is an open endpoint — token acts as the credential.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const service = createServiceClient();

  const { data: sendRow } = await service
    .from("campaign_sends")
    .select("id, campaign_id, contact_id, lead_id, email, status")
    .eq("tracking_token", token)
    .maybeSingle();

  if (!sendRow) {
    return new NextResponse(confirmationPage("not found"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (sendRow.status !== "unsubscribed") {
    await Promise.all([
      // Mark prospect as unsubscribed
      sendRow.contact_id
        ? service
            .from("prospect_contacts")
            .update({
              status:               "unsubscribed",
              lifecycle_updated_at: new Date().toISOString(),
            })
            .eq("id", sendRow.contact_id)
        : Promise.resolve(),

      // Update send status
      service
        .from("campaign_sends")
        .update({ status: "unsubscribed" })
        .eq("id", sendRow.id),

      // Record event
      service.from("campaign_events").insert({
        tracking_token:  token,
        campaign_id:     sendRow.campaign_id,
        contact_id:      sendRow.contact_id ?? null,
        lead_id:         sendRow.lead_id    ?? null,
        event_type:      "unsubscribe",
        cta_slot:        "unsubscribe",
        destination_url: null,
      }),
    ]);
  }

  return new NextResponse(confirmationPage("success"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function confirmationPage(state: "success" | "not found"): string {
  const message =
    state === "success"
      ? "You've been unsubscribed. You won't receive any more marketing emails from Juice for Teams."
      : "This unsubscribe link has already been used or is invalid.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Unsubscribed — Juice for Teams</title>
</head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:sans-serif">
  <div style="max-width:480px;margin:80px auto;padding:32px 24px;text-align:center;color:#1c1917">
    <p style="font-size:32px;margin:0 0 16px">🍋</p>
    <h1 style="font-size:22px;margin:0 0 12px">
      ${state === "success" ? "You're unsubscribed" : "Link not found"}
    </h1>
    <p style="color:#57534e;font-size:15px;line-height:1.6">${message}</p>
    <a href="${APP_URL}"
       style="display:inline-block;margin-top:24px;padding:10px 22px;background:#c2410c;
              color:#fff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">
      Go to Juice for Teams
    </a>
  </div>
</body>
</html>`;
}
