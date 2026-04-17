import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * GET /api/orders
 * Returns all non-draft orders for the authenticated user, newest first.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: orders, error } = await service
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "checkout_draft")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/orders]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: orders ?? [] });
}
