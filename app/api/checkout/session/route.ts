import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe, toPence } from "@/lib/stripe";
import { computeSubscriptionPrice, computeOneOffPrice, FORMAT_META } from "@/lib/products";
import { FREQ_LABEL } from "@/lib/funnel-logic";
import { createLogger } from "@/lib/logger";
import type { Format } from "@/lib/products";
import type { Frequency } from "@/lib/funnel-logic";

const log = createLogger("checkout/session");

interface LineItem {
  productSlug: string;
  format: Format;
  quantity: number;
}

interface NewAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  label?: string;
  saveToAccount?: boolean;
}

function sumSubPrice(lineItems: LineItem[], frequency: Frequency) {
  let pricePerDeliveryExVat = 0;
  let pricePerMonthExVat = 0;
  let vatPerMonth = 0;
  let totalPerMonthIncVat = 0;
  for (const item of lineItems) {
    const p = computeSubscriptionPrice(item.format, item.quantity, frequency);
    pricePerDeliveryExVat += p.pricePerDeliveryExVat;
    pricePerMonthExVat += p.pricePerMonthExVat;
    vatPerMonth += p.vatPerMonth;
    totalPerMonthIncVat += p.totalPerMonthIncVat;
  }
  return {
    pricePerDeliveryExVat: parseFloat(pricePerDeliveryExVat.toFixed(2)),
    pricePerMonthExVat: parseFloat(pricePerMonthExVat.toFixed(2)),
    vatPerMonth: parseFloat(vatPerMonth.toFixed(2)),
    totalPerMonthIncVat: parseFloat(totalPerMonthIncVat.toFixed(2)),
  };
}

function sumOneOffPrice(lineItems: LineItem[]) {
  let subtotalExVat = 0, vat = 0, totalIncVat = 0;
  for (const item of lineItems) {
    const p = computeOneOffPrice(item.format, item.quantity);
    subtotalExVat += p.subtotalExVat;
    vat += p.vat;
    totalIncVat += p.totalIncVat;
  }
  return {
    subtotalExVat: parseFloat(subtotalExVat.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    totalIncVat: parseFloat(totalIncVat.toFixed(2)),
  };
}

/**
 * POST /api/checkout/session
 *
 * Unified endpoint for subscription and one-off checkout, plus save-as-draft.
 *
 * Body shape:
 *   mode: "subscription" | "one_off"
 *   lineItems: LineItem[]
 *   saveDraft?: boolean        — skip Stripe, just create checkout_draft record
 *
 * Subscription extra fields: frequency, preferredDay?, deliveryNotes?
 * One-off extra fields: deliveryDate, deliveryNotes?
 *
 * Address (either one):
 *   addressId: string          — use saved address
 *   newAddress: { line1, line2?, city, postcode, label?, saveToAccount? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const mode      = body.mode as string;
  const saveDraft = body.saveDraft === true;
  const existingSubscriptionId = typeof body.existingSubscriptionId === "string" ? body.existingSubscriptionId : null;

  const lineItemsLog = Array.isArray(body.lineItems)
    ? (body.lineItems as LineItem[]).map(i => `${i.quantity}×${i.productSlug}(${i.format})`).join(", ")
    : "—";
  log.input("POST /api/checkout/session", {
    user: user.email,
    mode: existingSubscriptionId ? "existingSub" : (mode ?? "?"),
    saveDraft,
    items: lineItemsLog || "—",
    frequency: body.frequency || null,
    deliveryDate: body.deliveryDate || null,
  });

  const service = createServiceClient();

  // ── Handle payment for an existing pending subscription ─────────────────────
  if (existingSubscriptionId) {
    const { data: existingSub, error: subFetchErr } = await service
      .from("subscriptions")
      .select("id, user_id, status, total_per_month_inc_vat, price_per_month_ex_vat, vat_per_month, line_items, product_slug, format, frequency, stripe_customer_id")
      .eq("id", existingSubscriptionId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (subFetchErr || !existingSub) {
      return NextResponse.json({ error: "Subscription not found or not in pending state" }, { status: 404 });
    }

    // Get or reuse Stripe customer
    let stripeCustomerId = (existingSub.stripe_customer_id as string | null);
    if (!stripeCustomerId) {
      try {
        const { data: otherSub } = await service
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .not("stripe_customer_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (otherSub?.stripe_customer_id) stripeCustomerId = otherSub.stripe_customer_id as string;
      } catch { /* ignore */ }
    }
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
    }

    const subLineItems = (existingSub.line_items ?? []) as LineItem[];
    const subFrequency = existingSub.frequency as Frequency;
    const subPricing = subLineItems.length > 0
      ? sumSubPrice(subLineItems, subFrequency)
      : { totalPerMonthIncVat: (existingSub.total_per_month_inc_vat as number) ?? 0 };
    const subDescription = subLineItems.length > 0
      ? subLineItems.map((i: LineItem) => `${i.quantity} × ${i.productSlug.replace(/_/g, " ")} ${i.format}`).join(", ")
      : ((existingSub.product_slug as string) ?? "Juice subscription");
    const subFreqLabel = subFrequency ? (FREQ_LABEL[subFrequency] ?? subFrequency) : "";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      ui_mode: "embedded_page",
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Juice for Teams — Monthly Subscription",
            description: `${subDescription}${subFreqLabel ? ` — ${subFreqLabel}` : ""}`,
          },
          recurring: { interval: "month" },
          unit_amount: toPence(subPricing.totalPerMonthIncVat),
        },
        quantity: 1,
      }],
      metadata: {
        supabase_subscription_id: existingSub.id as string,
        supabase_user_id: user.id,
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    await service
      .from("subscriptions")
      .update({ stripe_checkout_session_id: session.id, stripe_customer_id: stripeCustomerId })
      .eq("id", existingSub.id as string);

    return NextResponse.json({ clientSecret: session.client_secret });
  }

  if (mode !== "subscription" && mode !== "one_off") {
    return NextResponse.json({ error: "mode must be 'subscription' or 'one_off'" }, { status: 400 });
  }

  const lineItems = (body.lineItems ?? []) as LineItem[];
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ error: "lineItems is required" }, { status: 400 });
  }

  // ── 1. Resolve delivery address ──────────────────────────────────────────────
  let resolvedAddressId: string | null = null;

  if (typeof body.addressId === "string") {
    resolvedAddressId = body.addressId;
  } else if (body.newAddress && typeof body.newAddress === "object") {
    const na = body.newAddress as NewAddress;
    if (na.saveToAccount) {
      const { data: savedAddr } = await service
        .from("addresses")
        .insert({
          user_id:  user.id,
          type:     "delivery",
          line1:    na.line1,
          line2:    na.line2 ?? null,
          city:     na.city,
          postcode: na.postcode,
          label:    na.label ?? null,
        })
        .select("id")
        .single();
      if (savedAddr) resolvedAddressId = savedAddr.id;
    }
  }

  // ── 2. Get or create Stripe customer (skip for draft) ────────────────────────
  let stripeCustomerId: string | null = null;

  if (!saveDraft) {
    // Try to reuse an existing Stripe customer — wrapped in try/catch in case
    // stripe_customer_id column doesn't exist yet (migration not run)
    try {
      const { data: existingSub } = await service
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub?.stripe_customer_id) {
        stripeCustomerId = existingSub.stripe_customer_id as string;
      }
    } catch {
      // Column missing — fall through to create a new customer below
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
    }
  }

  // ── 3. Handle subscription ───────────────────────────────────────────────────
  if (mode === "subscription") {
    const frequency    = body.frequency as Frequency;
    const preferredDay = typeof body.preferredDay === "string" ? body.preferredDay : null;
    const deliveryNotes = typeof body.deliveryNotes === "string" ? body.deliveryNotes : null;

    if (!frequency) {
      return NextResponse.json({ error: "frequency is required for subscription" }, { status: 400 });
    }

    const pricing      = sumSubPrice(lineItems, frequency);
    const primaryItem  = lineItems[0];
    const freqLabel    = FREQ_LABEL[frequency] ?? frequency;
    const description  = lineItems
      .map(i => `${i.quantity} × ${i.productSlug.replace(/_/g, " ")} ${i.format}`)
      .join(", ");

    // Build insert object — omit delivery_address_id if resolvedAddressId is null
    // (column may not exist until migration is run)
    const subInsert: Record<string, unknown> = {
      user_id:                  user.id,
      product_slug:             primaryItem.productSlug,
      format:                   primaryItem.format,
      frequency,
      quantity_per_delivery:    primaryItem.quantity,
      preferred_day:            preferredDay,
      line_items:               lineItems,
      // Computed pricing
      price_per_drop_ex_vat:    pricing.pricePerDeliveryExVat,
      price_per_month_ex_vat:   pricing.pricePerMonthExVat,
      vat_per_month:            pricing.vatPerMonth,
      total_per_month_inc_vat:  pricing.totalPerMonthIncVat,
      // Legacy fields for schema compat
      ingredients:              lineItems.map(i => `${i.productSlug}_${i.format}`),
      team_size:                lineItems.reduce((s, i) => s + i.quantity, 0),
      quantity_tier:            "1",
      shots_per_drop:           lineItems.filter(i => i.format === "shot").reduce((s, i) => s + i.quantity, 0),
      bottles_per_drop:         lineItems.filter(i => i.format === "share").reduce((s, i) => s + i.quantity, 0),
      shots_per_month:          0,
      bottles_per_month:        0,
      status:                   saveDraft ? "pending" : "checkout_draft",
      ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    };

    // Attempt to include address ID — may silently fail if column not yet in schema
    const subInsertWithAddr = resolvedAddressId
      ? { ...subInsert, delivery_address_id: resolvedAddressId }
      : subInsert;

    const { data: dbSub, error: insertErr } = await service
      .from("subscriptions")
      .insert(subInsertWithAddr)
      .select()
      .single();

    // Retry stripping any columns that don't exist yet in the DB schema
    let finalSub = dbSub;
    const needsRetry = insertErr?.message && (
      insertErr.message.includes("delivery_address_id") ||
      insertErr.message.includes("stripe_customer_id") ||
      insertErr.message.includes("line_items") ||
      insertErr.message.includes("product_slug") ||
      insertErr.message.includes("quantity_per_delivery") ||
      insertErr.message.includes("preferred_day")
    );
    if (needsRetry) {
      // Fall back to only the columns guaranteed by the original schema
      const safeInsert: Record<string, unknown> = {
        user_id:                 user.id,
        frequency,
        ingredients:             lineItems.map(i => `${i.productSlug}_${i.format}`),
        team_size:               lineItems.reduce((s, i) => s + i.quantity, 0),
        quantity_tier:           "1",
        shots_per_drop:          lineItems.filter(i => i.format === "shot").reduce((s, i) => s + i.quantity, 0),
        bottles_per_drop:        lineItems.filter(i => i.format === "share").reduce((s, i) => s + i.quantity, 0),
        shots_per_month:         0,
        bottles_per_month:       0,
        price_per_drop_ex_vat:   pricing.pricePerDeliveryExVat,
        price_per_month_ex_vat:  pricing.pricePerMonthExVat,
        vat_per_month:           pricing.vatPerMonth,
        total_per_month_inc_vat: pricing.totalPerMonthIncVat,
        status:                  "pending", // checkout_draft requires updated constraint
      };
      const { data: retried, error: retryErr } = await service
        .from("subscriptions")
        .insert(safeInsert)
        .select()
        .single();
      if (retryErr || !retried) {
        console.error("[checkout/session] sub insert error (safe retry):", retryErr?.message);
        return NextResponse.json({ error: "Failed to create subscription record" }, { status: 500 });
      }
      finalSub = retried;
    } else if (insertErr || !dbSub) {
      console.error("[checkout/session] sub insert error:", insertErr?.message);
      return NextResponse.json({ error: "Failed to create subscription record" }, { status: 500 });
    }

    log.dbResult("subscription record created", { id: finalSub!.id, status: finalSub!.status });

    // Advance prospect lifecycle: contact/opportunity → lead
    if (user.email) {
      const emailKey = user.email.toLowerCase().trim();
      log.db("UPDATE prospect_contacts lifecycle → lead", { email_hash: emailKey, condition: "IN (pre_opp, opp)" });
      await service
        .from("prospect_contacts")
        .update({ lifecycle_stage: "lead", lifecycle_updated_at: new Date().toISOString() })
        .eq("email_hash", emailKey)
        .in("lifecycle_stage", ["pre_opp", "opp"]);
      log.dbResult("prospect lifecycle advanced → lead (best-effort)", { email: user.email });
    }

    // Save-as-draft: return without Stripe
    if (saveDraft) {
      return NextResponse.json({ saved: true, subscriptionId: finalSub!.id });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId!,
      mode: "subscription",
      ui_mode: "embedded_page",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Juice for Teams — Monthly Subscription",
              description: `${description} — ${freqLabel}`,
            },
            recurring: { interval: "month" },
            unit_amount: toPence(pricing.totalPerMonthIncVat),
          },
          quantity: 1,
        },
      ],
      metadata: {
        supabase_subscription_id: finalSub!.id,
        supabase_user_id:         user.id,
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    await service
      .from("subscriptions")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", finalSub!.id);

    log.done("subscription checkout session created", { sub_id: finalSub!.id, stripe_session: session.id, total_per_month: `£${pricing.totalPerMonthIncVat}` });
    return NextResponse.json({ clientSecret: session.client_secret });
  }

  // ── 4. Handle one-off order ──────────────────────────────────────────────────
  const deliveryDate  = body.deliveryDate as string;
  const deliveryNotes = typeof body.deliveryNotes === "string" ? body.deliveryNotes : null;

  if (!deliveryDate) {
    return NextResponse.json({ error: "deliveryDate is required for one_off" }, { status: 400 });
  }

  const pricing     = sumOneOffPrice(lineItems);
  const primaryItem = lineItems[0];
  const description = lineItems
    .map(i => `${i.quantity} × ${i.productSlug.replace(/_/g, " ")} ${FORMAT_META[i.format].unitLabelPlural}`)
    .join(", ");

  const orderInsert: Record<string, unknown> = {
    user_id:         user.id,
    product_slug:    primaryItem.productSlug,
    format:          primaryItem.format,
    quantity:        lineItems.reduce((s, i) => s + i.quantity, 0),
    delivery_date:   deliveryDate,
    delivery_notes:  deliveryNotes,
    line_items:      lineItems,
    subtotal_ex_vat: pricing.subtotalExVat,
    vat:             pricing.vat,
    total_inc_vat:   pricing.totalIncVat,
    status:          "checkout_draft",
    items:           [],
  };

  const orderInsertWithAddr = resolvedAddressId
    ? { ...orderInsert, delivery_address_id: resolvedAddressId }
    : orderInsert;

  const { data: dbOrder, error: orderErr } = await service
    .from("orders")
    .insert(orderInsertWithAddr)
    .select()
    .single();

  let finalOrder = dbOrder;
  if (orderErr?.message?.includes("delivery_address_id") || orderErr?.message?.includes("line_items")) {
    const { data: retried, error: retryErr } = await service
      .from("orders")
      .insert({ ...orderInsert, delivery_address_id: undefined, line_items: undefined })
      .select()
      .single();
    if (retryErr || !retried) {
      console.error("[checkout/session] order insert error:", retryErr?.message);
      return NextResponse.json({ error: "Failed to create order record" }, { status: 500 });
    }
    finalOrder = retried;
  } else if (orderErr || !dbOrder) {
    console.error("[checkout/session] order insert error:", orderErr?.message);
    return NextResponse.json({ error: "Failed to create order record" }, { status: 500 });
  }

  log.dbResult("order record created", { id: finalOrder!.id, status: finalOrder!.status });

  // Advance prospect lifecycle: contact/opportunity → lead
  if (user.email) {
    const emailKey = user.email.toLowerCase().trim();
    log.db("UPDATE prospect_contacts lifecycle → lead (one-off)", { email_hash: emailKey });
    await service
      .from("prospect_contacts")
      .update({ lifecycle_stage: "lead", lifecycle_updated_at: new Date().toISOString() })
      .eq("email_hash", emailKey)
      .in("lifecycle_stage", ["contact", "opportunity"]);
    log.dbResult("prospect lifecycle advanced → lead (one-off, best-effort)", { email: user.email });
  }

  if (saveDraft) {
    return NextResponse.json({ saved: true, orderId: finalOrder!.id });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId!,
    mode: "payment",
    ui_mode: "embedded_page",
    line_items: lineItems.map(item => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: `${item.productSlug.replace(/_/g, " ")} — ${FORMAT_META[item.format].label}`,
        },
        unit_amount: toPence(computeOneOffPrice(item.format, item.quantity).totalIncVat),
      },
      quantity: 1,
    })),
    metadata: {
      supabase_order_id: finalOrder!.id,
      supabase_user_id:  user.id,
    },
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  await service
    .from("orders")
    .update({ stripe_payment_intent_id: session.payment_intent as string })
    .eq("id", finalOrder!.id);

  const oneOffTotal = sumOneOffPrice(lineItems).totalIncVat;
  log.done("one-off checkout session created", { order_id: finalOrder!.id, stripe_session: session.id, total: `£${oneOffTotal}`, delivery_date: deliveryDate });
  return NextResponse.json({ clientSecret: session.client_secret });
}
