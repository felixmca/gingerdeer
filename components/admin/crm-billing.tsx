"use client";

import { useEffect, useState } from "react";

interface Subscription {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  status: string;
  ingredients: string[];
  frequency: string;
  team_size: number;
  total_per_month_inc_vat: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface Order {
  id: string;
  user_email: string | null;
  total_inc_vat: number;
  status: string;
  created_at: string;
}

interface Invoice {
  id: string;
  customer_email: string | null;
  amount_paid: number;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
}

interface Metrics {
  mrr: number;
  active_subscriptions: number;
  total_subscriptions: number;
  paid_orders: number;
  order_revenue: number;
}

interface BillingData {
  subscriptions: Subscription[];
  orders: Order[];
  invoices: Invoice[];
  metrics: Metrics;
}

function fmtGBP(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | number) {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    active:    "adm-badge adm-badge--green",
    pending:   "adm-badge adm-badge--yellow",
    paused:    "adm-badge adm-badge--yellow",
    cancelled: "adm-badge adm-badge--red",
    paid:      "adm-badge adm-badge--green",
    open:      "adm-badge adm-badge--yellow",
    void:      "adm-badge adm-badge--red",
    draft:     "adm-badge",
  }[status] ?? "adm-badge";
  return <span className={cls}>{status}</span>;
}

export default function CrmBilling() {
  const [data,    setData]    = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<"subscriptions" | "orders" | "invoices">("subscriptions");

  useEffect(() => {
    fetch("/api/admin/billing")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="adm-page">
        <div className="adm-page__header">
          <h1 className="adm-page__title">Billing</h1>
        </div>
        <div className="adm-spinner">Loading billing data…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="adm-page">
        <div className="adm-page__header">
          <h1 className="adm-page__title">Billing</h1>
        </div>
        <div className="adm-empty" style={{ color: "#9f1239" }}>{error ?? "Failed to load billing data."}</div>
      </div>
    );
  }

  const { metrics, subscriptions, orders, invoices } = data;

  return (
    <div className="adm-page">
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Billing</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-ink-muted)" }}>
            Subscriptions, one-off orders, and Stripe invoices.
          </p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="billing-metrics">
        <div className="billing-metric">
          <span className="billing-metric__value">{fmtGBP(metrics.mrr)}</span>
          <span className="billing-metric__label">Monthly recurring revenue</span>
        </div>
        <div className="billing-metric">
          <span className="billing-metric__value">{metrics.active_subscriptions}</span>
          <span className="billing-metric__label">Active subscriptions</span>
        </div>
        <div className="billing-metric">
          <span className="billing-metric__value">{metrics.total_subscriptions}</span>
          <span className="billing-metric__label">Total subscriptions</span>
        </div>
        <div className="billing-metric">
          <span className="billing-metric__value">{fmtGBP(metrics.order_revenue)}</span>
          <span className="billing-metric__label">One-off order revenue</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="adm-tabs">
        <button
          type="button"
          className={`adm-tab${tab === "subscriptions" ? " adm-tab--active" : ""}`}
          onClick={() => setTab("subscriptions")}
        >
          Subscriptions ({subscriptions.length})
        </button>
        <button
          type="button"
          className={`adm-tab${tab === "orders" ? " adm-tab--active" : ""}`}
          onClick={() => setTab("orders")}
        >
          One-off Orders ({orders.length})
        </button>
        <button
          type="button"
          className={`adm-tab${tab === "invoices" ? " adm-tab--active" : ""}`}
          onClick={() => setTab("invoices")}
        >
          Stripe Invoices ({invoices.length})
        </button>
      </div>

      {/* Subscriptions table */}
      {tab === "subscriptions" && (
        <div className="adm-table-wrap">
          {subscriptions.length === 0 ? (
            <p className="adm-empty">No subscriptions yet.</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Frequency</th>
                  <th>Team size</th>
                  <th>Monthly (inc. VAT)</th>
                  <th>Period end</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <div className="billing-customer">
                        <span className="billing-customer__name">{sub.user_name ?? "—"}</span>
                        <span className="billing-customer__email">{sub.user_email ?? sub.user_id}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={sub.status} /></td>
                    <td className="billing-freq">{sub.frequency}</td>
                    <td>{sub.team_size}</td>
                    <td>{fmtGBP(Number(sub.total_per_month_inc_vat))}</td>
                    <td>{sub.current_period_end ? fmtDate(sub.current_period_end) : "—"}</td>
                    <td>{fmtDate(sub.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Orders table */}
      {tab === "orders" && (
        <div className="adm-table-wrap">
          {orders.length === 0 ? (
            <p className="adm-empty">No one-off orders yet.</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total inc. VAT</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.user_email ?? "—"}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>{fmtGBP(Number(order.total_inc_vat))}</td>
                    <td>{fmtDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invoices table */}
      {tab === "invoices" && (
        <div className="adm-table-wrap">
          {invoices.length === 0 ? (
            <p className="adm-empty">No Stripe invoices yet.</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount paid</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="billing-mono">{inv.id}</td>
                    <td>{inv.customer_email ?? "—"}</td>
                    <td><StatusBadge status={inv.status ?? "unknown"} /></td>
                    <td>{fmtGBP(inv.amount_paid / 100)}</td>
                    <td>{fmtDate(inv.created)}</td>
                    <td>
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="adm-link"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
