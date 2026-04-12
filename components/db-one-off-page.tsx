"use client";

import { useState } from "react";
import { DbOneOffModal, type OneOffOrder } from "./db-one-off-modal";

const DRINKS = [
  { key: "allinone",           name: "All-in-one",           accent: "#c2410c", bg: "#fff7ed" },
  { key: "lemon_ginger_honey", name: "Lemon, Ginger, Honey", accent: "#ca8a04", bg: "#fefce8" },
  { key: "apple_ginger",       name: "Apple Ginger",         accent: "#3f6212", bg: "#f7fee7" },
  { key: "turmeric",           name: "Turmeric Boost",       accent: "#d97706", bg: "#fffbeb" },
] as const;

const FORMAT_LABELS: Record<string, string> = {
  shot:  "100ml shots",
  share: "1L share bottles",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pending",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateParts(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
  };
}

export function DbOneOffPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [orders, setOrders] = useState<OneOffOrder[]>([]);
  const [search, setSearch] = useState("");

  function handleComplete(order: OneOffOrder) {
    setOrders((prev) => [order, ...prev]);
    setModalOpen(false);
  }

  const drinkMeta = (key: string) => DRINKS.find((d) => d.key === key);

  const visible = orders.filter((o) => {
    if (!search) return true;
    const dm = drinkMeta(o.drink);
    const needle = search.toLowerCase();
    return (
      (dm?.name.toLowerCase().includes(needle)) ||
      FORMAT_LABELS[o.format]?.toLowerCase().includes(needle) ||
      STATUS_LABELS[o.status]?.toLowerCase().includes(needle) ||
      o.address.toLowerCase().includes(needle) ||
      o.deliveryDate.includes(needle)
    );
  });

  return (
    <>
      <div className="db-oneoff">

        {/* ── Toolbar ── */}
        <div className="db-oneoff__toolbar">
          <div className="db-oneoff__count">
            <span className="db-oneoff__count-num">{orders.length}</span>
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
          {DRINKS.map((d) => (
            <button
              key={d.key}
              type="button"
              className="db-oneoff__strip-card"
              style={{ background: d.bg, borderColor: `color-mix(in srgb, ${d.accent} 20%, transparent)` }}
              onClick={() => setModalOpen(true)}
              aria-label={`Order ${d.name}`}
            >
              <div
                className="db-oneoff__strip-bottle"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${d.accent} 35%, #fff) 0%, ${d.accent} 55%, color-mix(in srgb, ${d.accent} 60%, #000) 100%)`,
                  boxShadow: `0 4px 12px color-mix(in srgb, ${d.accent} 25%, transparent)`,
                }}
              />
              <div className="db-oneoff__strip-info">
                <p className="db-oneoff__strip-name" style={{ color: d.accent }}>{d.name}</p>
                <p className="db-oneoff__strip-prices">£3.50 shot · £25.00 1L</p>
              </div>
              <span className="db-oneoff__strip-order" style={{ color: d.accent }}>Order →</span>
            </button>
          ))}
        </div>

        <hr className="db-orders__divider" />

        {/* ── Order list ── */}
        {visible.length === 0 ? (
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
              const dm = drinkMeta(order.drink);
              const { day, month } = formatDateParts(order.deliveryDate);
              const price = order.format === "shot" ? 3.50 : 25.00;
              const total = price * order.qty;
              return (
                <div
                  key={order.id}
                  className="db-oneoff__card"
                  style={{ borderLeftColor: dm?.accent ?? "var(--color-accent)" }}
                >
                  {/* Date badge */}
                  <div className="db-oneoff__date" style={{ background: dm?.bg, color: dm?.accent }}>
                    <span className="db-oneoff__date-day">{day}</span>
                    <span className="db-oneoff__date-month">{month}</span>
                  </div>

                  {/* Info */}
                  <div className="db-oneoff__card-info">
                    <p className="db-oneoff__card-name" style={{ color: dm?.accent }}>{dm?.name}</p>
                    <p className="db-oneoff__card-meta">
                      {order.qty} × {FORMAT_LABELS[order.format]} · {formatDate(order.deliveryDate)}
                    </p>
                    {order.address && (
                      <p className="db-oneoff__card-address">{order.address}</p>
                    )}
                  </div>

                  {/* Price + status */}
                  <div className="db-oneoff__card-right">
                    <p className="db-oneoff__card-price">£{total.toFixed(2)}</p>
                    <span
                      className="db-oneoff__card-status"
                      data-status={order.status}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DbOneOffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onComplete={handleComplete}
      />
    </>
  );
}
