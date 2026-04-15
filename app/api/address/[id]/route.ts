import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/address/[id]
 * Updates an address owned by the authenticated user.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const service = createServiceClient();

  // Verify ownership
  const { data: existing, error: fetchErr } = await service
    .from("addresses").select("id, user_id, type").eq("id", id).single();
  if (fetchErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ALLOWED = ["label", "line1", "line2", "city", "postcode", "country", "is_default"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) {
      patch[key] = typeof body[key] === "string"
        ? (body[key] as string).trim() || null
        : body[key];
    }
  }
  if (patch.line1 === null) return NextResponse.json({ error: "line1 cannot be empty" }, { status: 400 });

  // Unset previous default for this type if setting as default
  if (patch.is_default === true) {
    await service
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("type", existing.type)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { data, error } = await service
    .from("addresses").update(patch).eq("id", id).select("*").single();
  if (error) {
    console.error("[PATCH /api/address/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ address: data });
}

/**
 * DELETE /api/address/[id]
 * Deletes an address owned by the authenticated user.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: existing, error: fetchErr } = await service
    .from("addresses").select("id, user_id").eq("id", id).single();
  if (fetchErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await service.from("addresses").delete().eq("id", id);
  if (error) {
    console.error("[DELETE /api/address/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
