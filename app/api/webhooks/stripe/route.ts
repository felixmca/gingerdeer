import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 * Stripe sends events here. Verifies the signature then updates our DB.
 *
 * Local dev: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *
 * Events handled:
 *   checkout.session.completed       → activate subscription
 *   customer.subscription.updated    → sync status
 *   customer.subscription.deleted    → mark cancelled
 *   invoice.payment_failed           → mark paused
 *   invoice.payment_succeeded        → ensure active
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const service = createServiceClient();

  try {
    switch (event.type) {
      // ── Checkout completed → subscription created in Stripe ────────────────
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
        if (sess.mode !== "subscription") break;

        const dbSubId = sess.metadata?.supabase_subscription_id;
        if (!dbSubId) {
          console.warn("[stripe webhook] checkout.session.completed missing supabase_subscription_id");
          break;
        }

        // Retrieve the subscription Stripe just created so we have the period end
        const stripeSub = await stripe.subscriptions.retrieve(sess.subscription as string);

        const periodEnd = stripeSub.items.data[0]?.current_period_end;
        await service
          .from("subscriptions")
          .update({
            status:                  "active",
            stripe_subscription_id:  stripeSub.id,
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
          })
          .eq("id", dbSubId);

        // Mark any pending orders for this user as paid (they were on the first invoice)
        await service
          .from("orders")
          .update({ status: "paid", stripe_checkout_session_id: sess.id })
          .eq("user_id", sess.metadata?.supabase_user_id ?? "")
          .eq("status", "pending");

        break;
      }

      // ── Subscription updated (plan change, renewal, etc.) ──────────────────
      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const stripeStatus = stripeSub.status; // active | past_due | canceled | paused | etc.

        let ourStatus: string;
        if (stripeStatus === "active")                                    ourStatus = "active";
        else if (stripeStatus === "paused" || stripeStatus === "past_due") ourStatus = "paused";
        else if (stripeStatus === "canceled")                              ourStatus = "cancelled";
        else                                                               ourStatus = "pending";

        const periodEnd = stripeSub.items.data[0]?.current_period_end;
        await service
          .from("subscriptions")
          .update({
            status: ourStatus,
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
          })
          .eq("stripe_subscription_id", stripeSub.id);
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await service
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", stripeSub.id);
        break;
      }

      // ── Payment failed (e.g. card declined on renewal) ─────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // In the Stripe Dahlia API, subscription is nested in parent.subscription_details
        const subId = (invoice.parent as { subscription_details?: { subscription?: string } } | null)
          ?.subscription_details?.subscription;
        if (subId) {
          await service
            .from("subscriptions")
            .update({ status: "paused" })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }

      // ── Payment succeeded (e.g. retry after failure) ───────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice.parent as { subscription_details?: { subscription?: string } } | null)
          ?.subscription_details?.subscription;
        if (subId) {
          await service
            .from("subscriptions")
            .update({ status: "active" })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }

      default:
        // Unhandled event type — safe to ignore
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
