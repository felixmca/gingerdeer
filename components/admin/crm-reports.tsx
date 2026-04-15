"use client";

import { useEffect, useState } from "react";

interface ReportData {
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  leads_by_status: { status: string; count: number }[];
  leads_over_time: { week: string; count: number }[];
  active_subs: number;
  pending_subs: number;
  active_mrr: number;
  pipeline_mrr: number;
  emails_sent_30d: number;
  emails_failed_30d: number;
  emails_by_template: { template: string; count: number }[];
  total_contacts: number;
}

function fmtGBP(n: number) {
  return `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number) {
  return `${Number(n).toFixed(1)}%`;
}

// Styles in app/globals.css under "ADMIN CRM SHELL" section.

export default function CrmReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ReportData>;
      })
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load report data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <div className="adm-reports">
          <h1>Reports</h1>
          <div className="adm-spinner" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="adm-reports">
          <h1>Reports</h1>
          <p className="adm-error-msg">{error || "No data returned."}</p>
        </div>
      </>
    );
  }

  const maxStatusCount = Math.max(1, ...data.leads_by_status.map((s) => s.count));
  const maxWeekCount   = Math.max(1, ...data.leads_over_time.map((w) => w.count));

  return (
    <>
      <div className="adm-reports">
        <h1>Reports</h1>

        {/* Row 1: 4 KPI cards */}
        <div className="adm-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{data.total_leads.toLocaleString()}</span>
            <span className="adm-kpi__label">Total Leads</span>
          </div>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{fmtPct(data.conversion_rate)}</span>
            <span className="adm-kpi__label">Conversion Rate</span>
          </div>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{fmtGBP(data.active_mrr)}</span>
            <span className="adm-kpi__label">Active MRR</span>
          </div>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{data.emails_sent_30d.toLocaleString()}</span>
            <span className="adm-kpi__label">Emails Sent (30d)</span>
          </div>
        </div>

        {/* Row 2: 3 cards */}
        <div className="adm-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 32 }}>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{data.active_subs.toLocaleString()}</span>
            <span className="adm-kpi__label">Active Subscriptions</span>
          </div>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{data.pending_subs.toLocaleString()}</span>
            <span className="adm-kpi__label">Pending Subscriptions</span>
          </div>
          <div className="adm-kpi">
            <span className="adm-kpi__value">{fmtGBP(data.pipeline_mrr)}</span>
            <span className="adm-kpi__label">Pipeline MRR</span>
          </div>
        </div>

        {/* Leads by Status */}
        <div className="adm-section">
          <h2>Leads by Status</h2>
          <div className="adm-chart">
            {data.leads_by_status.length === 0 ? (
              <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              data.leads_by_status.map((row) => (
                <div key={row.status} className="adm-chart__bar-wrap">
                  <span className="adm-chart__label">{row.status}</span>
                  <div className="adm-chart__track">
                    <div
                      className="adm-chart__bar"
                      style={{ width: `${(row.count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="adm-chart__value">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leads over Time */}
        <div className="adm-section">
          <h2>Leads over Time</h2>
          <div className="adm-chart">
            {data.leads_over_time.length === 0 ? (
              <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              data.leads_over_time.map((row) => (
                <div key={row.week} className="adm-chart__bar-wrap">
                  <span className="adm-chart__label" style={{ width: 120, fontSize: "0.8125rem" }}>
                    {row.week}
                  </span>
                  <div className="adm-chart__track">
                    <div
                      className="adm-chart__bar adm-chart__bar--week"
                      style={{ width: `${(row.count / maxWeekCount) * 100}%` }}
                    />
                  </div>
                  <span className="adm-chart__value">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Email Templates */}
        <div className="adm-section">
          <h2>Top Email Templates</h2>
          {data.emails_by_template.length === 0 ? (
            <p style={{ color: "var(--color-ink-muted)", fontSize: "0.9rem" }}>No data.</p>
          ) : (
            <div className="adm-template-list">
              {data.emails_by_template.map((row) => (
                <div key={row.template} className="adm-template-row">
                  <span>{row.template}</span>
                  <span>{row.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
