import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/account
 * Updates the authenticated user's display name.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const displayName = (body.display_name as string | undefined)?.trim() ?? "";

  const { error } = await supabase.auth.updateUser({
    data: { full_name: displayName },
  });

  if (error) {
    console.error("[PATCH /api/account]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
