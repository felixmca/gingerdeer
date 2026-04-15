import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/checkout/session/[id]
 * Returns the status of a Stripe Checkout session.
 * Used by the return page to confirm payment succeeded.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["subscription"],
    });

    return NextResponse.json({
      status:         session.status,
      paymentStatus:  session.payment_status,
      customerEmail:  session.customer_details?.email,
      amountTotal:    session.amount_total,
      currency:       session.currency,
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
