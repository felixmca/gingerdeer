import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import type Stripe from "stripe";

const log = createLogger("webhooks/stripe");

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
    log.error("signature verification failed", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  log.input("POST /api/webhooks/stripe", { event_type: event.type, event_id: event.id });

  const service = createServiceClient();

  try {
    switch (event.type) {
      // ── Checkout completed → subscription or one-off payment ─────────────
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
        log.info("checkout.session.completed", { mode: sess.mode, session_id: sess.id, amount_total: sess.amount_total });

        if (sess.mode === "subscription") {
          const dbSubId = sess.metadata?.supabase_subscription_id;
          if (!dbSubId) {
            log.warn("missing supabase_subscription_id in session metadata", { session_id: sess.id });
            break;
          }

          // Retrieve the subscription Stripe just created so we have the period end
          log.info("retrieving Stripe subscription", { stripe_subscription: sess.subscription });
          const stripeSub = await stripe.subscriptions.retrieve(sess.subscription as string);
          const periodEnd = stripeSub.items.data[0]?.current_period_end;

          log.db("UPDATE subscriptions → active", { id: dbSubId, stripe_subscription_id: stripeSub.id });
          await service
            .from("subscriptions")
            .update({
              status:                  "active",
              stripe_subscription_id:  stripeSub.id,
              ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
            })
            .eq("id", dbSubId);
          log.dbResult("subscription activated", { id: dbSubId });

          // Create an orders record for this payment
          log.db("SELECT subscriptions for order record", { id: dbSubId });
          const { data: subData } = await service
            .from("subscriptions")
            .select("user_id, product_slug, format, line_items, delivery_address_id, total_per_month_inc_vat, price_per_month_ex_vat, vat_per_month")
            .eq("id", dbSubId)
            .maybeSingle();

          const userId     = sess.metadata?.supabase_user_id ?? subData?.user_id;
          const totalPence = sess.amount_total ?? 0;
          const totalGBP   = totalPence > 0 ? totalPence / 100 : ((subData?.total_per_month_inc_vat as number | null) ?? 0);

          log.transform("building order record from subscription", { user_id: userId, total_gbp: totalGBP, has_line_items: !!(subData?.line_items) });

          const orderRecord: Record<string, unknown> = {
            user_id:                    userId,
            status:                     "paid",
            total_inc_vat:              totalGBP,
            stripe_checkout_session_id: sess.id,
            items:                      [],
          };
          if (subData?.product_slug)       orderRecord.product_slug    = subData.product_slug;
          if (subData?.format)             orderRecord.format           = subData.format;
          if (subData?.line_items)         orderRecord.line_items       = subData.line_items;
          if (subData?.delivery_address_id) orderRecord.delivery_address_id = subData.delivery_address_id;
          if (subData?.price_per_month_ex_vat) orderRecord.subtotal_ex_vat = subData.price_per_month_ex_vat;
          if (subData?.vat_per_month)      orderRecord.vat              = subData.vat_per_month;

          log.db("INSERT orders (subscription payment)", { user_id: userId, total_inc_vat: totalGBP });
          const { error: orderErr } = await service.from("orders").insert(orderRecord);
          if (orderErr) {
            log.error("INSERT orders failed — retrying with minimal columns", { message: orderErr.message });
            // Retry with minimal columns
            await service.from("orders").insert({
              user_id:                    userId,
              status:                     "paid",
              total_inc_vat:              totalGBP,
              stripe_checkout_session_id: sess.id,
              items:                      [],
            });
          } else {
            log.dbResult("order record created", { user_id: userId, total_inc_vat: totalGBP });
          }

          // Advance prospect lifecycle: lead → customer
          if (userId) {
            try {
              log.db("auth.admin.getUserById — prospect lifecycle lookup", { user_id: userId });
              const { data: authUserData } = await service.auth.admin.getUserById(userId as string);
              const prospectEmail = authUserData?.user?.email;
              if (prospectEmail) {
                const emailKey = prospectEmail.toLowerCase().trim();
                log.db("UPDATE prospect_contacts lifecycle → customer", { email_hash: emailKey, condition: "IN (contact, opportunity, lead)" });
                await service
                  .from("prospect_contacts")
                  .update({ lifecycle_stage: "customer", lifecycle_updated_at: new Date().toISOString() })
                  .eq("email_hash", emailKey)
                  .in("lifecycle_stage", ["contact", "opportunity", "lead"]);
                log.dbResult("prospect lifecycle → customer (best-effort)", { email: prospectEmail });
              }
            } catch (lcErr) {
              // Non-blocking — don't fail the webhook over lifecycle advancement
              log.warn("prospect lifecycle advancement failed (non-fatal)", { message: lcErr instanceof Error ? lcErr.message : String(lcErr) });
            }
          }

        } else if (sess.mode === "payment") {
          // One-off order — find by session ID and mark paid
          const dbOrderId = sess.metadata?.supabase_order_id;
          if (dbOrderId) {
            log.db("UPDATE orders → paid (one-off)", { id: dbOrderId });
            await service
              .from("orders")
              .update({ status: "paid", stripe_checkout_session_id: sess.id })
              .eq("id", dbOrderId);
            log.dbResult("one-off order marked paid", { id: dbOrderId });
          }
        }

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

        log.info("customer.subscription.updated", { stripe_subscription: stripeSub.id, stripe_status: stripeStatus, our_status: ourStatus });

        const periodEnd = stripeSub.items.data[0]?.current_period_end;
        log.db("UPDATE subscriptions status", { stripe_subscription_id: stripeSub.id, status: ourStatus });
        await service
          .from("subscriptions")
          .update({
            status: ourStatus,
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
          })
          .eq("stripe_subscription_id", stripeSub.id);
        log.dbResult("subscription status synced", { stripe_subscription_id: stripeSub.id, status: ourStatus });
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        log.info("customer.subscription.deleted", { stripe_subscription: stripeSub.id });
        log.db("UPDATE subscriptions → cancelled", { stripe_subscription_id: stripeSub.id });
        await service
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", stripeSub.id);
        log.dbResult("subscription cancelled", { stripe_subscription_id: stripeSub.id });
        break;
      }

      // ── Payment failed (e.g. card declined on renewal) ─────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // In the Stripe Dahlia API, subscription is nested in parent.subscription_details
        const subId = (invoice.parent as { subscription_details?: { subscription?: string } } | null)
          ?.subscription_details?.subscription;
        log.info("invoice.payment_failed", { stripe_subscription: subId ?? "(no sub)" });
        if (subId) {
          log.db("UPDATE subscriptions → paused", { stripe_subscription_id: subId });
          await service
            .from("subscriptions")
            .update({ status: "paused" })
            .eq("stripe_subscription_id", subId);
          log.dbResult("subscription paused", { stripe_subscription_id: subId });
        }
        break;
      }

      // ── Payment succeeded (e.g. retry after failure) ───────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice.parent as { subscription_details?: { subscription?: string } } | null)
          ?.subscription_details?.subscription;
        log.info("invoice.payment_succeeded", { stripe_subscription: subId ?? "(no sub)" });
        if (subId) {
          log.db("UPDATE subscriptions → active", { stripe_subscription_id: subId });
          await service
            .from("subscriptions")
            .update({ status: "active" })
            .eq("stripe_subscription_id", subId);
          log.dbResult("subscription reactivated", { stripe_subscription_id: subId });
        }
        break;
      }

      default:
        // Unhandled event type — safe to ignore
        log.info(`unhandled event type — ignoring`, { event_type: event.type });
        break;
    }
  } catch (err) {
    log.error(`handler error for ${event.type}`, { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  log.done("webhook processed", { event_type: event.type, event_id: event.id });
  return NextResponse.json({ received: true });
}
