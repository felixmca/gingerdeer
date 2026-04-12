import { createServiceClient } from "@/lib/supabase/service";
import { sendQuoteEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * PATCH /api/lead/[id]
 *
 * Step 4: updates the existing partial lead row with the full plan and sends
 * the quote email to the user.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateRow: Record<string, unknown> = {
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
  };

  let email: string | null = null;
  let company: string | null = null;

  try {
    const supabase = createServiceClient();

    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("email, company")
      .eq("id", id)
      .single();

    if (fetchErr || !lead) throw fetchErr ?? new Error("Lead not found");

    email = lead.email as string;
    company = lead.company as string;

    const { error: updateErr } = await supabase
      .from("leads")
      .update(updateRow)
      .eq("id", id);

    if (updateErr) throw updateErr;
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[/api/lead/[id] PATCH] DB error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Send quote email (best-effort)
  if (process.env.RESEND_API_KEY && email && company) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    sendQuoteEmail(resend, { to: email, company, body }).catch((err) =>
      console.error("[/api/lead/[id] PATCH] Email error:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
