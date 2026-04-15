import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * GET /api/address?type=delivery|billing
 * Returns saved addresses for the authenticated user.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const service = createServiceClient();
  let query = service
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (type === "billing" || type === "delivery") {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[GET /api/address]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ addresses: data ?? [] });
}

/**
 * POST /api/address
 * Creates a new address for the authenticated user.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const type     = body.type as string | undefined;
  const label    = (body.label as string | undefined)?.trim() || null;
  const line1    = (body.line1 as string | undefined)?.trim();
  const line2    = (body.line2 as string | undefined)?.trim() || null;
  const city     = (body.city as string | undefined)?.trim();
  const postcode = (body.postcode as string | undefined)?.trim();
  const country  = ((body.country as string | undefined)?.trim()) || "GB";
  const is_default = Boolean(body.is_default);

  if (!type || !["billing", "delivery"].includes(type))
    return NextResponse.json({ error: "type must be billing or delivery" }, { status: 400 });
  if (!line1)    return NextResponse.json({ error: "line1 is required" },    { status: 400 });
  if (!city)     return NextResponse.json({ error: "city is required" },     { status: 400 });
  if (!postcode) return NextResponse.json({ error: "postcode is required" }, { status: 400 });

  const service = createServiceClient();

  // Unset previous default for this type if needed
  if (is_default) {
    await service
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("type", type)
      .eq("is_default", true);
  }

  const { data, error } = await service
    .from("addresses")
    .insert({ user_id: user.id, type, label, line1, line2, city, postcode, country, is_default })
    .select("*")
    .single();

  if (error) {
    console.error("[POST /api/address]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ address: data });
}
