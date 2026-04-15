import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe, toPence } from "@/lib/stripe";
import { computePlan, FREQ_LABEL } from "@/lib/funnel-logic";
import type { Frequency } from "@/lib/funnel-logic";

interface CartItem {
  slug: string;
  name: string;
  format: string;
  unitLabel: string;
  priceExVat: number;
  quantity: number;
}

interface SubConfig {
  ingredients: string[];
  frequency: Frequency;
  teamSize: number;
  multiplier: number;
}

/**
 * POST /api/checkout/session
 * Creates a Stripe Checkout session (embedded mode) for a subscription + optional one-off items.
 * Returns { clientSecret } for the EmbeddedCheckout component.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let sub: SubConfig;
  let cart: CartItem[];
  try {
    const body = await req.json();
    sub  = body.sub;
    cart = body.cart ?? [];
    if (!sub?.ingredients?.length || !sub.frequency || !sub.teamSize) {
      throw new Error("invalid sub config");
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const plan = computePlan(sub.ingredients, sub.multiplier ?? 1, sub.teamSize, sub.frequency);

  const service = createServiceClient();

  // ── 1. Get or create Stripe customer ────────────────────────────────────────
  let stripeCustomerId: string;

  const { data: existingSub } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    stripeCustomerId = existingSub.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
  }

  // ── 2. Add one-off cart items as pending invoice items ───────────────────────
  // Stripe will include these in the first subscription invoice automatically.
  const VAT = 0.2;
  for (const item of cart) {
    if (item.quantity <= 0) continue;
    const amountPence = toPence(item.priceExVat * (1 + VAT) * item.quantity);
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      currency: "gbp",
      amount: amountPence,
      description: `${item.name} × ${item.quantity} (${item.unitLabel})`,
    });
  }

  // ── 3. Create pending subscription in our DB ────────────────────────────────
  const { data: dbSub, error: insertErr } = await service
    .from("subscriptions")
    .insert({
      user_id:                  user.id,
      ingredients:              plan.keys,
      frequency:                plan.freq,
      team_size:                plan.team,
      quantity_tier:            plan.tier,
      shots_per_drop:           plan.shotsPerDrop,
      bottles_per_drop:         plan.bottlesPerDrop,
      shots_per_month:          plan.shotsMonth,
      bottles_per_month:        plan.bottlesMonth,
      price_per_drop_ex_vat:    plan.pricePerDropExVat,
      price_per_month_ex_vat:   plan.pricePerMonthExVat,
      vat_per_month:            plan.vatPerMonth,
      total_per_month_inc_vat:  plan.totalPerMonthIncVat,
      status:                   "pending",
      stripe_customer_id:       stripeCustomerId,
    })
    .select()
    .single();

  if (insertErr || !dbSub) {
    return NextResponse.json({ error: "Failed to create subscription record" }, { status: 500 });
  }

  // ── 4. Persist one-off items as an order record ─────────────────────────────
  if (cart.length > 0) {
    const subtotal = cart.reduce((s, i) => s + i.priceExVat * i.quantity, 0);
    const vat      = parseFloat((subtotal * VAT).toFixed(2));
    await service.from("orders").insert({
      user_id:        user.id,
      items:          cart,
      subtotal_ex_vat: parseFloat(subtotal.toFixed(2)),
      vat,
      total_inc_vat:  parseFloat((subtotal + vat).toFixed(2)),
      status:         "pending",
    });
  }

  // ── 5. Create Stripe Checkout Session ──────────────────────────────────────
  const freqLabel = FREQ_LABEL[plan.freq ?? "monthly"] ?? plan.freq;
  const description = `${plan.labels.join(", ")} — ${plan.team} people — ${freqLabel} delivery`;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    ui_mode: "embedded_page",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Juice for Teams — Monthly Subscription",
            description,
          },
          recurring: { interval: "month" },
          unit_amount: toPence(plan.totalPerMonthIncVat),
        },
        quantity: 1,
      },
    ],
    metadata: {
      supabase_subscription_id: dbSub.id,
      supabase_user_id: user.id,
    },
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  // Save session ID to our subscription record
  await service
    .from("subscriptions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", dbSub.id);

  return NextResponse.json({ clientSecret: session.client_secret });
}
