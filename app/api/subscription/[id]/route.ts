import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/subscription/[id]
 * Updates a subscription row owned by the authenticated user.
 * Accepted fields: status, ingredients, frequency, team_size, quantity_tier,
 *                  shots_per_drop, bottles_per_drop, shots_per_month,
 *                  bottles_per_month, price_per_drop_ex_vat,
 *                  price_per_month_ex_vat, vat_per_month,
 *                  total_per_month_inc_vat
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

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

  // Only allow these fields to be updated
  const ALLOWED = [
    "status", "ingredients", "frequency", "team_size", "quantity_tier",
    "shots_per_drop", "bottles_per_drop", "shots_per_month", "bottles_per_month",
    "price_per_drop_ex_vat", "price_per_month_ex_vat", "vat_per_month",
    "total_per_month_inc_vat",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify ownership before updating
  const { data: existing, error: fetchErr } = await service
    .from("subscriptions")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: updateErr } = await service
    .from("subscriptions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) {
    console.error("[PATCH /api/subscription/[id]]", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: updated });
}
