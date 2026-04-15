import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/contacts/[id]
 * Full contact profile: user info, subscriptions, addresses, linked lead, email history.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const [userRes, subsRes, addrsRes, leadsRes, emailsRes] = await Promise.all([
    service.auth.admin.getUserById(id),
    service
      .from("subscriptions")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    service.from("addresses").select("*").eq("user_id", id).order("type"),
    service
      .from("leads")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    service
      .from("email_logs")
      .select("*")
      .eq("to_user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (userRes.error || !userRes.data?.user) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: userRes.data.user,
    subscriptions: subsRes.data ?? [],
    addresses: addrsRes.data ?? [],
    lead: (leadsRes.data ?? [])[0] ?? null,
    emails: emailsRes.data ?? [],
  });
}
