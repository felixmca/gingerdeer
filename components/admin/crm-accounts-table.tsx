"use client";

import { useEffect, useState } from "react";

interface Account {
  company: string;
  lead_count: number;
  contact_count: number;
  pipeline_mrr: number;
  best_status: string;
}

const STATUS_COLOR: Record<string, string> = {
  active:    "#15803d",
  pending:   "#b45309",
  cancelled: "#b91c1c",
  paused:    "#475569",
  new:       "#1d4ed8",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status.toLowerCase()] ?? "#57534e";
  return (
    <span
      className="adm-badge"
      style={{
        "--badge-color": color,
      } as React.CSSProperties}
    >
      {status}
    </span>
  );
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
}
.adm-search {
  flex: 1;
  max-width: 320px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: 0.875rem;
  color: var(--color-ink);
  outline: none;
}
.adm-search:focus {
  border-color: var(--color-accent);
}
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
.adm-table tbody tr:last-child td {
  border-bottom: none;
}
.adm-table tbody tr:hover td {
  background: #f7f4ef88;
}
.adm-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--badge-color) 12%, transparent);
  color: var(--badge-color);
  border: 1px solid color-mix(in srgb, var(--badge-color) 25%, transparent);
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
  color: var(--color-ink-muted);
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
@keyframes adm-spin {
  to { transform: rotate(360deg); }
}
`;

export default function CrmAccountsTable() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : data.accounts ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = accounts.filter((a) =>
    a.company.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <style>{styles}</style>
      <div className="adm-page">
        <h1>Accounts</h1>
        <div className="adm-toolbar">
          <input
            className="adm-search"
            type="search"
            placeholder="Search by company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span style={{ fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
            {loading ? "" : `${filtered.length} account${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-spinner" />
          ) : filtered.length === 0 ? (
            <div className="adm-empty">
              {q ? `No accounts matching "${q}"` : "No accounts yet."}
            </div>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Leads</th>
                  <th>Contacts</th>
                  <th>Pipeline MRR</th>
                  <th>Best Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.company}>
                    <td style={{ fontWeight: 500 }}>{a.company}</td>
                    <td>{a.lead_count}</td>
                    <td>{a.contact_count}</td>
                    <td>
                      {a.pipeline_mrr != null
                        ? `£${Number(a.pipeline_mrr).toFixed(2)}`
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge status={a.best_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
