import { createServiceClient } from "@/lib/supabase/service";
import {
  sendStep1Email,
  sendQuoteEmail,
  sendExistingUserLoginPromptEmail,
} from "@/lib/email";
import { NextResponse } from "next/server";
import { Resend } from "resend";

function makeResend() {
  return process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
}

/**
 * POST /api/lead
 *
 * Step 1: called when the user clicks "Continue" on step 1 of the funnel.
 * Saves a partial lead row and sends the "finish setup" email.
 *
 * Also used as a fallback for step 4 if step 1 never got a leadId
 * (in that case the full plan fields are included in the body).
 *
 * If the email already exists in auth.users, returns { existingUser: true }
 * and sends a login-prompt email instead.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : null;
  const company = typeof body.company === "string" ? body.company.trim() : null;

  if (!email || !company) {
    return NextResponse.json(
      { error: "email and company are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // ── Check if email already exists in auth.users ──────────────────────────
  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
  const existingAuthUser = (authData?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuthUser) {
    // Send login-prompt email (best-effort)
    const resend = makeResend();
    let emailStatus: "sent" | "failed" = "failed";
    if (resend) {
      try {
        await sendExistingUserLoginPromptEmail(resend, { to: email, company });
        emailStatus = "sent";
      } catch (err) {
        console.error("[/api/lead POST] existing-user email error:", err);
      }
    }

    // Log the email send
    await supabase.from("email_logs").insert({
      to_email: email,
      to_user_id: existingAuthUser.id,
      subject: "You already have a Juice for Teams account",
      template_name: "existing_user_login_prompt",
      status: emailStatus,
      metadata: { company },
    });

    return NextResponse.json({ existingUser: true });
  }

  // ── Determine if this is a full submission (step-4 fallback) or partial ──
  const isFull = Boolean(body.frequency);

  const row: Record<string, unknown> = {
    email,
    company,
    role: body.role ?? null,
    signup_complete: false,
    crm_status: "new",
    crm_source: "landing_page",
  };

  if (isFull) {
    Object.assign(row, {
      ingredients: body.ingredients ?? [],
      frequency: body.frequency,
      quantity_tier: body.quantity_tier,
      team_size: body.team_size,
      shots_per_drop: body.shots_per_drop ?? 0,
      bottles_per_drop: body.bottles_per_drop ?? 0,
      shots_per_month: body.shots_per_month ?? 0,
      bottles_per_month: body.bottles_per_month ?? 0,
      price_per_drop_ex_vat: body.price_per_drop_ex_vat ?? null,
      price_per_month_ex_vat: body.price_per_month_ex_vat ?? null,
      vat_per_month: body.vat_per_month ?? null,
      total_per_month_inc_vat: body.total_per_month_inc_vat ?? null,
    });
  }

  let leadId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .single();

    if (error) throw error;
    leadId = data.id as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[/api/lead POST] DB error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Send email and log it ─────────────────────────────────────────────────
  const resend = makeResend();
  let emailStatus: "sent" | "failed" = "failed";
  const templateName = isFull ? "quote" : "step1_finish_setup";
  const subject = isFull
    ? `Your Juice for Teams quote — ${company}`
    : "Finish setting up your Juice for Teams subscription";

  if (resend) {
    try {
      if (isFull) {
        await sendQuoteEmail(resend, { to: email, company, body });
      } else {
        await sendStep1Email(resend, { to: email, company });
      }
      emailStatus = "sent";
    } catch (err) {
      console.error("[/api/lead POST] Email error:", err);
    }
  }

  // Log the email
  if (leadId) {
    await supabase.from("email_logs").insert({
      to_email: email,
      to_lead_id: leadId,
      subject,
      template_name: templateName,
      status: emailStatus,
      metadata: { company, isFull },
    });
  }

  return NextResponse.json({ leadId });
}
