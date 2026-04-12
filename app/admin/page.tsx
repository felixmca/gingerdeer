import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { FREQ_LABEL } from "@/lib/funnel-logic";
import { redirect } from "next/navigation";

export const metadata = { title: "Admin — Juice for Teams" };

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

interface Lead {
  id: string;
  created_at: string;
  email: string;
  company: string;
  role: string | null;
  ingredients: string[];
  frequency: string | null;
  quantity_tier: string | null;
  team_size: number | null;
  shots_per_drop: number;
  bottles_per_drop: number;
  total_per_month_inc_vat: number | null;
  signup_complete: boolean;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/admin");
  if (!isAdmin(user.email)) redirect("/dashboard");

  let leads: Lead[] = [];
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("leads")
      .select(
        "id, created_at, email, company, role, ingredients, frequency, quantity_tier, team_size, shots_per_drop, bottles_per_drop, total_per_month_inc_vat, signup_complete"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    leads = (data ?? []) as Lead[];
  } catch (err) {
    console.error("[/admin] Leads fetch error:", err);
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const fmtGBP = (n: number | null) =>
    n !== null && n !== undefined ? `£${Number(n).toFixed(2)}` : "—";

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="wrap dash-header__inner">
          <a href="/" className="logo" aria-label="Juice for Teams home">
            <span className="logo__mark" aria-hidden="true" />
            <span className="logo__text">Juice for Teams</span>
          </a>
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <a href="/dashboard" className="btn btn--ghost btn--sm">Dashboard</a>
            <a href="/auth/signout" className="btn btn--ghost btn--sm">Sign out</a>
          </nav>
        </div>
      </header>

      <main className="wrap dash-main">
        <div className="dash-greeting">
          <h1 className="dash-greeting__title">Leads</h1>
          <p className="dash-greeting__sub">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} captured
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="dash-empty">
            <h2 className="dash-empty__title">No leads yet</h2>
            <p className="dash-empty__copy">
              Leads will appear here once someone submits the funnel.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Blend</th>
                  <th>Freq.</th>
                  <th>Team</th>
                  <th>Total / mo.</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="admin-table__date">{fmtDate(lead.created_at)}</td>
                    <td>
                      <strong>{lead.company}</strong>
                    </td>
                    <td>
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                    </td>
                    <td>{lead.role ?? <span className="admin-table__empty">—</span>}</td>
                    <td className="admin-table__blend">
                      {lead.ingredients?.length
                        ? lead.ingredients.join(" · ")
                        : <span className="admin-table__empty">—</span>}
                    </td>
                    <td>
                      {lead.frequency
                        ? FREQ_LABEL[lead.frequency] ?? lead.frequency
                        : <span className="admin-table__empty">—</span>}
                    </td>
                    <td>{lead.team_size ?? <span className="admin-table__empty">—</span>}</td>
                    <td>
                      <strong>{fmtGBP(lead.total_per_month_inc_vat)}</strong>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${lead.signup_complete ? "admin-badge--done" : "admin-badge--pending"}`}
                      >
                        {lead.signup_complete ? "Active" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
