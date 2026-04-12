import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

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

  return NextResponse.json({ subscription: data });
}
