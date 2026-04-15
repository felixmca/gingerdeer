"use client";

import { useEffect, useRef, useState } from "react";

interface Opportunity {
  id: string;
  created_at: string;
  user_email: string;
  company: string;
  status: string; // pending | active | cancelled | paused
  frequency: string | null;
  team_size: number | null;
  ingredients: string[];
  total_per_month_inc_vat: number | null;
  price_per_month_ex_vat: number | null;
  price_per_drop_ex_vat?: number | null;
  vat_per_month?: number | null;
}

const STATUS_OPTIONS = ["All", "pending", "active", "cancelled", "paused"] as const;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "#fef3c7", text: "#b45309" },
  active:    { bg: "#dcfce7", text: "#15803d" },
  cancelled: { bg: "#fee2e2", text: "#b91c1c" },
  paused:    { bg: "#f1f5f9", text: "#475569" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLOR[status.toLowerCase()] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      className="adm-badge"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.text}33`,
      }}
    >
      {status}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtGBP(n: number | null | undefined) {
  if (n == null) return "—";
  return `£${Number(n).toFixed(2)}`;
}

const styles = `
.adm-page {
  padding: 32px;
  background: var(--color-bg);
  min-height: 100vh;
  font-family: Outfit, sans-serif;
  color: var(--color-ink);
}
.adm-page h1 {
  font-family: Fraunces, serif;
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 24px;
}
.adm-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.adm-search {
  flex: 1;
  min-width: 200px;
  max-width: 320px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: 0.875rem;
  color: var(--color-ink);
  outline: none;
}
.adm-search:focus { border-color: var(--color-accent); }
.adm-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: 0.875rem;
  color: var(--color-ink);
  cursor: pointer;
  outline: none;
}
.adm-select:focus { border-color: var(--color-accent); }
.adm-table-wrap {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.adm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.adm-table thead tr {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}
.adm-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.adm-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink);
}
.adm-table tbody tr:last-child td { border-bottom: none; }
.adm-table tbody tr.adm-row--clickable {
  cursor: pointer;
}
.adm-table tbody tr.adm-row--clickable:hover td { background: #f7f4ef88; }
.adm-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}
.adm-empty {
  text-align: center;
  padding: 64px 24px;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}
.adm-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
}
.adm-spinner::after {
  content: "";
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: adm-spin 0.7s linear infinite;
}
@keyframes adm-spin { to { transform: rotate(360deg); } }

/* Drawer */
.adm-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(28,25,23,0.35);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}
.adm-drawer {
  background: var(--color-surface);
  width: min(480px, 100vw);
  height: 100%;
  overflow-y: auto;
  box-shadow: -8px 0 32px rgba(28,25,23,0.12);
  display: flex;
  flex-direction: column;
}
.adm-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 1;
}
.adm-drawer__header h2 {
  font-family: Fraunces, serif;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}
.adm-drawer__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-ink-muted);
  line-height: 1;
  padding: 4px;
}
.adm-drawer__close:hover { color: var(--color-ink); }
.adm-drawer__body {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.adm-detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.adm-detail-row dt {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.adm-detail-row dd {
  font-size: 0.9375rem;
  color: var(--color-ink);
  margin: 0;
}
.adm-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 4px 0;
}
.adm-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.adm-select-inline {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  font-size: 0.9375rem;
  color: var(--color-ink);
  cursor: pointer;
  outline: none;
}
.adm-select-inline:focus { border-color: var(--color-accent); }
.adm-drawer__footer {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  position: sticky;
  bottom: 0;
  background: var(--color-surface);
}
.adm-btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.adm-btn--primary {
  background: var(--color-accent);
  color: #fff;
}
.adm-btn--primary:hover:not(:disabled) { opacity: 0.88; }
.adm-btn--ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-ink);
}
.adm-btn--ghost:hover:not(:disabled) { background: var(--color-bg); }
.adm-save-error {
  font-size: 0.8125rem;
  color: #b91c1c;
  align-self: center;
}
`;

function OpportunityDrawer({
  opp,
  onClose,
  onSaved,
}: {
  opp: Opportunity;
  onClose: () => void;
  onSaved: (updated: Opportunity) => void;
}) {
  const [status, setStatus] = useState(opp.status);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (status === opp.status) { onClose(); return; }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/admin/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? "Failed to update.");
      }
      onSaved({ ...opp, status });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const ingredients = Array.isArray(opp.ingredients) ? opp.ingredients.join(", ") : "—";

  return (
    <div className="adm-drawer-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="adm-drawer" role="dialog" aria-modal="true" aria-label="Opportunity detail">
        <div className="adm-drawer__header">
          <h2>{opp.company || "Opportunity"}</h2>
          <button className="adm-drawer__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="adm-drawer__body">
          <dl style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="adm-detail-row">
              <dt>Email</dt>
              <dd>{opp.user_email}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Created</dt>
              <dd>{fmtDate(opp.created_at)}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Frequency</dt>
              <dd>{opp.frequency ?? "—"}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Team Size</dt>
              <dd>{opp.team_size ?? "—"}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Ingredients</dt>
              <dd>{ingredients}</dd>
            </div>
          </dl>

          <hr className="adm-divider" />

          <dl style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="adm-detail-row">
              <dt>Price per drop (ex. VAT)</dt>
              <dd>{fmtGBP(opp.price_per_drop_ex_vat)}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Price per month (ex. VAT)</dt>
              <dd>{fmtGBP(opp.price_per_month_ex_vat)}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>VAT per month</dt>
              <dd>{fmtGBP(opp.vat_per_month)}</dd>
            </div>
            <div className="adm-detail-row">
              <dt>Total per month (inc. VAT)</dt>
              <dd style={{ fontWeight: 600, fontSize: "1.0625rem" }}>
                {fmtGBP(opp.total_per_month_inc_vat)}
              </dd>
            </div>
          </dl>

          <hr className="adm-divider" />

          <div>
            <label className="adm-label" htmlFor="drawer-status">Status</label>
            <select
              id="drawer-status"
              className="adm-select-inline"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {saveError && <p className="adm-save-error">{saveError}</p>}
        </div>

        <div className="adm-drawer__footer">
          <button className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="adm-btn adm-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrmOpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<Opportunity | null>(null);

  useEffect(() => {
    fetch("/api/admin/opportunities")
      .then((r) => r.json())
      .then((data) => setOpps(Array.isArray(data) ? data : data.opportunities ?? []))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = opps.filter((o) => {
    const matchQ =
      o.company.toLowerCase().includes(q.toLowerCase()) ||
      o.user_email.toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    return matchQ && matchStatus;
  });

  function handleSaved(updated: Opportunity) {
    setOpps((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelected(updated);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="adm-page">
        <h1>Opportunities</h1>

        <div className="adm-toolbar">
          <input
            className="adm-search"
            type="search"
            placeholder="Search company or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="adm-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
            {loading ? "" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-spinner" />
          ) : filtered.length === 0 ? (
            <div className="adm-empty">
              {q || statusFilter !== "All" ? "No results match your filters." : "No opportunities yet."}
            </div>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Ingredients</th>
                  <th>Freq</th>
                  <th>Team</th>
                  <th>MRR (inc. VAT)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="adm-row--clickable"
                    onClick={() => setSelected(o)}
                  >
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.created_at)}</td>
                    <td style={{ fontWeight: 500 }}>{o.company}</td>
                    <td style={{ color: "var(--color-ink-muted)" }}>{o.user_email}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {Array.isArray(o.ingredients) ? o.ingredients.join(", ") : "—"}
                    </td>
                    <td>{o.frequency ?? "—"}</td>
                    <td>{o.team_size ?? "—"}</td>
                    <td>{fmtGBP(o.total_per_month_inc_vat)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <OpportunityDrawer
          opp={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
