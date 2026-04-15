"use client";

import { useEffect, useState } from "react";
import { OrderLauncher } from "./order-launcher";
import { PRODUCTS } from "@/lib/products";

interface OrderRow {
  id: string;
  product_slug: string | null;
  format: "shot" | "share" | null;
  quantity: number | null;
  delivery_date: string | null;
  status: string;
  total_inc_vat: number | null;
  created_at: string;
}

const FORMAT_LABELS: Record<string, string> = {
  shot:  "100ml shots",
  share: "1L share bottles",
};

const STATUS_LABELS: Record<string, string> = {
  checkout_draft: "Draft",
  pending:        "Pending",
  paid:           "Paid",
  fulfilled:      "Fulfilled",
  cancelled:      "Cancelled",
};

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateParts(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return {
    day:   d.toLocaleDateString("en-GB", { day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
  };
}

function productMeta(slug: string | null) {
  if (!slug) return null;
  // Slug is like "classic_ginger" — match against PRODUCTS
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export function DbOneOffPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [orders, setOrders]       = useState<OrderRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const json = await res.json() as { orders?: OrderRow[] };
          setOrders(json.orders ?? []);
        }
      } catch { /* silently show empty state */ }
      setLoading(false);
    }
    load();
  }, []);

  function handleLauncherClose() {
    setModalOpen(false);
    // Re-fetch to show any newly placed orders
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d: { orders?: OrderRow[] }) => setOrders(d.orders ?? []))
      .catch(() => {});
  }

  const visible = orders.filter((o) => {
    if (!search) return true;
    const pm = productMeta(o.product_slug);
    const needle = search.toLowerCase();
    return (
      pm?.name.toLowerCase().includes(needle) ||
      (o.format && FORMAT_LABELS[o.format]?.toLowerCase().includes(needle)) ||
      STATUS_LABELS[o.status]?.toLowerCase().includes(needle) ||
      o.delivery_date?.includes(needle)
    );
  });

  return (
    <>
      <div className="db-oneoff">

        {/* ── Toolbar ── */}
        <div className="db-oneoff__toolbar">
          <div className="db-oneoff__count">
            <span className="db-oneoff__count-num">{loading ? "—" : orders.length}</span>
            <span className="db-oneoff__count-label">
              one-off order{orders.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="db-orders__search-wrap">
            <svg className="db-orders__search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10 10l3 3" />
            </svg>
            <input
              type="search"
              className="db-orders__search"
              placeholder="Search orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn--primary btn--sm db-orders__add-btn"
            onClick={() => setModalOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6.5 1v11M1 6.5h11" />
            </svg>
            New one-off order
          </button>
        </div>

        {/* ── Product strip ── */}
        <div className="db-oneoff__strip" aria-label="Available drinks">
          {PRODUCTS.map((p) => (
            <button
              key={p.slug}
              type="button"
              className="db-oneoff__strip-card"
              style={{ background: p.bg, borderColor: `color-mix(in srgb, ${p.accent} 20%, transparent)` }}
              onClick={() => setModalOpen(true)}
              aria-label={`Order ${p.name}`}
            >
              <div
                className="db-oneoff__strip-bottle"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 35%, #fff) 0%, ${p.accent} 55%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                  boxShadow: `0 4px 12px color-mix(in srgb, ${p.accent} 25%, transparent)`,
                }}
              />
              <div className="db-oneoff__strip-info">
                <p className="db-oneoff__strip-name" style={{ color: p.accent }}>{p.name}</p>
                <p className="db-oneoff__strip-prices">£3.50 shot · £25.00 1L</p>
              </div>
              <span className="db-oneoff__strip-order" style={{ color: p.accent }}>Order →</span>
            </button>
          ))}
        </div>

        <hr className="db-orders__divider" />

        {/* ── Order list ── */}
        {loading ? (
          <div className="db-orders__empty">
            <p className="db-orders__empty-sub">Loading orders…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="db-orders__empty">
            <svg className="db-orders__empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="6" y="8" width="36" height="36" rx="3" />
              <path d="M16 8V5a2 2 0 014 0v3M28 8V5a2 2 0 014 0v3" />
              <path d="M6 16h36" />
              <path d="M14 24h20M14 31h14M14 38h8" />
            </svg>
            {search ? (
              <>
                <h2 className="db-orders__empty-title">No orders match your search</h2>
                <p className="db-orders__empty-sub">Try a different term or clear the search.</p>
              </>
            ) : (
              <>
                <h2 className="db-orders__empty-title">No one-off orders yet</h2>
                <p className="db-orders__empty-sub">
                  Need juice for a team event, new starter, or special occasion?
                  Place a one-off order outside your regular subscription.
                </p>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6.5 1v11M1 6.5h11" />
                  </svg>
                  Place your first order
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="db-oneoff__list">
            {visible.map((order) => {
              const pm = productMeta(order.product_slug);
              const dateStr = order.delivery_date ?? order.created_at;
              const { day, month } = formatDateParts(dateStr.split("T")[0]);
              return (
                <div
                  key={order.id}
                  className="db-oneoff__card"
                  style={{ borderLeftColor: pm?.accent ?? "var(--color-accent)" }}
                >
                  {/* Date badge */}
                  <div className="db-oneoff__date" style={{ background: pm?.bg, color: pm?.accent }}>
                    <span className="db-oneoff__date-day">{day}</span>
                    <span className="db-oneoff__date-month">{month}</span>
                  </div>

                  {/* Info */}
                  <div className="db-oneoff__card-info">
                    <p className="db-oneoff__card-name" style={{ color: pm?.accent }}>{pm?.name ?? order.product_slug}</p>
                    <p className="db-oneoff__card-meta">
                      {order.quantity} × {order.format ? FORMAT_LABELS[order.format] : "units"}
                      {order.delivery_date && ` · ${formatDate(order.delivery_date)}`}
                    </p>
                  </div>

                  {/* Price + status */}
                  <div className="db-oneoff__card-right">
                    {order.total_inc_vat != null && (
                      <p className="db-oneoff__card-price">£{order.total_inc_vat.toFixed(2)}</p>
                    )}
                    <span className="db-oneoff__card-status" data-status={order.status}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <OrderLauncher
        open={modalOpen}
        onClose={handleLauncherClose}
        preselectedType="one_off"
        loggedIn={true}
      />
    </>
  );
}
