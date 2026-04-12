import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { DbSidebarNav } from "@/components/db-sidebar-nav";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/dashboard");

  // Auto-link lead to user account
  try {
    const service = createServiceClient();
    const { data: linked } = await service
      .from("leads")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!linked && user.email) {
      const { data: byEmail } = await service
        .from("leads")
        .select("id")
        .eq("email", user.email)
        .is("user_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byEmail) {
        await service
          .from("leads")
          .update({ user_id: user.id, signup_complete: true })
          .eq("id", (byEmail as { id: string }).id);
      }
    }
  } catch (err) {
    console.error("[dashboard] Lead link error:", err);
  }

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
  const displayName = fullName || user.email?.split("@")[0] || "User";
  const avatarLetter = (fullName[0] || user.email?.[0] || "U").toUpperCase();

  return (
    <div className="db-shell">
      {/* ── Sidebar ── */}
      <DbSidebarNav />

      {/* ── Main area ── */}
      <div className="db-main">
        <header className="db-topbar">
          <span className="db-topbar__title">juice</span>
          <div className="db-topbar__user">
            <span className="db-topbar__avatar" aria-hidden="true">
              {avatarLetter}
            </span>
            <span className="db-topbar__username">{displayName}</span>
          </div>
        </header>
        <main className="db-content">{children}</main>
      </div>
    </div>
  );
}
