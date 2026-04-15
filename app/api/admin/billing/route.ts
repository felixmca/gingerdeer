import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/billing
 * Returns subscription + order data for the admin billing dashboard.
 * Joins our DB records with live Stripe data.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Fetch all subscriptions that have been through Stripe
  const { data: subscriptions } = await service
    .from("subscriptions")
    .select("*")
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false });

  // Fetch auth users to get emails
  const { data: { users: authUsers } } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const userMap = new Map(authUsers.map((u) => [u.id, u]));

  // Enrich subscriptions with user email and Stripe status
  const enriched = (subscriptions ?? []).map((sub) => {
    const authUser = userMap.get(sub.user_id);
    return {
      ...sub,
      user_email:    authUser?.email ?? null,
      user_name:     authUser?.user_metadata?.full_name ?? null,
    };
  });

  // Fetch all orders
  const { data: orders } = await service
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const enrichedOrders = (orders ?? []).map((order) => {
    const authUser = userMap.get(order.user_id);
    return {
      ...order,
      user_email: authUser?.email ?? null,
    };
  });

  // Summary metrics
  const activeSubscriptions = enriched.filter((s) => s.status === "active");
  const mrr = activeSubscriptions.reduce(
    (sum, s) => sum + (Number(s.total_per_month_inc_vat) || 0), 0
  );
  const paidOrders = enrichedOrders.filter((o) => o.status === "paid");
  const orderRevenue = paidOrders.reduce(
    (sum, o) => sum + (Number(o.total_inc_vat) || 0), 0
  );

  // Fetch recent invoices from Stripe (last 50)
  let recentInvoices: {
    id: string;
    customer_email: string | null;
    amount_paid: number;
    status: string | null;
    created: number;
    hosted_invoice_url: string | null;
  }[] = [];
  try {
    const invoices = await stripe.invoices.list({ limit: 50, expand: ["data.customer"] });
    recentInvoices = invoices.data.map((inv) => ({
      id:                 inv.id,
      customer_email:     (inv.customer as { email?: string })?.email ?? inv.customer_email,
      amount_paid:        inv.amount_paid,
      status:             inv.status,
      created:            inv.created,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
    }));
  } catch {
    // Stripe not fully configured yet — skip invoice fetch
  }

  return NextResponse.json({
    subscriptions: enriched,
    orders:        enrichedOrders,
    invoices:      recentInvoices,
    metrics: {
      mrr:                  Math.round(mrr * 100) / 100,
      active_subscriptions: activeSubscriptions.length,
      total_subscriptions:  enriched.length,
      paid_orders:          paidOrders.length,
      order_revenue:        Math.round(orderRevenue * 100) / 100,
    },
  });
}
