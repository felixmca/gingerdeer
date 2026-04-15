import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendSubscriptionCreatedEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { Resend } from "resend";

function makeResend() {
  return process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
}

/**
 * GET /api/subscription
 * Returns all subscription rows for the authenticated user.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/subscription]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data ?? [] });
}

/**
 * POST /api/subscription
 * Creates a pending subscription for the authenticated user.
 * Called when a logged-in user completes the funnel (steps 2–4).
 * Sends a subscription confirmation email and logs it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();
  const row = {
    user_id: user.id,
    ingredients:             body.ingredients              ?? [],
    frequency:               body.frequency               ?? null,
    team_size:               body.team_size               ?? 1,
    quantity_tier:           body.quantity_tier           ?? "1",
    shots_per_drop:          body.shots_per_drop          ?? 0,
    bottles_per_drop:        body.bottles_per_drop        ?? 0,
    shots_per_month:         body.shots_per_month         ?? 0,
    bottles_per_month:       body.bottles_per_month       ?? 0,
    price_per_drop_ex_vat:   body.price_per_drop_ex_vat   ?? null,
    price_per_month_ex_vat:  body.price_per_month_ex_vat  ?? null,
    vat_per_month:           body.vat_per_month           ?? null,
    total_per_month_inc_vat: body.total_per_month_inc_vat ?? null,
    status:                  "pending",
    lead_id:                 typeof body.lead_id === "string" ? body.lead_id : null,
  };

  const { data, error } = await service
    .from("subscriptions")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[POST /api/subscription]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Send confirmation email (best-effort) ─────────────────────────────────
  const userEmail = user.email ?? "";
  const resend = makeResend();
  let emailStatus: "sent" | "failed" = "failed";

  if (resend && userEmail) {
    // Try to resolve company name from linked lead
    let company = userEmail.split("@")[0];
    if (data.lead_id) {
      const { data: lead } = await service
        .from("leads")
        .select("company")
        .eq("id", data.lead_id)
        .single();
      if (lead?.company) company = lead.company;
    }

    try {
      await sendSubscriptionCreatedEmail(resend, {
        to: userEmail,
        company,
        body: {
          frequency:               data.frequency,
          team_size:               data.team_size,
          price_per_month_ex_vat:  data.price_per_month_ex_vat,
          total_per_month_inc_vat: data.total_per_month_inc_vat,
        },
      });
      emailStatus = "sent";
    } catch (err) {
      console.error("[POST /api/subscription] confirmation email error:", err);
    }

    await service.from("email_logs").insert({
      to_email: userEmail,
      to_user_id: user.id,
      subject: "Your Juice for Teams subscription is confirmed",
      template_name: "subscription_created",
      status: emailStatus,
      metadata: { subscription_id: data.id },
    });
  }

  return NextResponse.json({ subscription: data });
}
