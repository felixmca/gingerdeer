"use client";

import { useEffect, useState } from "react";
import { PRODUCT_BY_SLUG, FORMAT_META } from "@/lib/products";
import type { Format } from "@/lib/products";

type StatusKey = "paid" | "fulfilled" | "cancelled";

const STATUS_LABELS: Record<StatusKey, string> = {
  paid:      "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<StatusKey, { bg: string; color: string }> = {
  paid:      { bg: "color-mix(in srgb, #16a34a 12%, transparent)", color: "#15803d" },
  fulfilled: { bg: "color-mix(in srgb, #1d4ed8 12%, transparent)", color: "#1d4ed8" },
  cancelled: { bg: "color-mix(in srgb, #6b7280 12%, transparent)", color: "#6b7280" },
};

const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusKey[];

interface LineItem {
  productSlug: string;
  format: Format;
  quantity: number;
}

interface OrderRow {
  id: string;
  user_id: string;
  status: string;
  product_slug?: string;
  format?: string;
  quantity?: number;
  delivery_date?: string;
  total_inc_vat?: number;
  line_items?: LineItem[];
  created_at: string;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nextYearISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function formatItems(order: OrderRow): string {
  if (order.line_items && order.line_items.length > 0) {
    return order.line_items.map((i) => {
      const p = PRODUCT_BY_SLUG[i.productSlug];
      const f = FORMAT_META[i.format];
      return `${i.quantity} × ${p?.name ?? i.productSlug} (${f?.label ?? i.format})`;
    }).join(", ");
  }
  if (order.product_slug) {
    const p = PRODUCT_BY_SLUG[order.product_slug];
    const f = order.format ? FORMAT_META[order.format as Format] : null;
    return `${order.quantity ?? "?"} × ${p?.name ?? order.product_slug}${f ? ` (${f.label})` : ""}`;
  }
  return "—";
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" />
    </svg>
  );
}

export function DbOrdersPage() {
  const [orders, setOrders]         = useState<OrderRow[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [loading, setLoading]       = useState(true);

  const [search, setSearch]     = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo]     = useState(nextYearISO);
  const [statuses, setStatuses] = useState<Record<StatusKey, boolean>>({
    paid:      true,
    fulfilled: true,
    cancelled: false,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/orders");
        const json = await res.json() as { orders?: OrderRow[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load orders");
        setOrders(json.orders ?? []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleStatus(key: StatusKey) {
    setStatuses((s) => ({ ...s, [key]: !s[key] }));
  }

  function clearFilters() {
    setSearch("");
    setDateFrom(todayISO());
    setDateTo(nextYearISO());
    setStatuses({ paid: true, fulfilled: true, cancelled: false });
  }

  // Client-side filtering
  const filtered = orders.filter((o) => {
    const st = o.status as StatusKey;
    if (!statuses[st]) return false;

    const dateStr = o.delivery_date ?? o.created_at.split("T")[0];
    if (dateStr < dateFrom || dateStr > dateTo) return false;

    if (search) {
      const lower = search.toLowerCase();
      if (
        !formatItems(o).toLowerCase().includes(lower) &&
        !o.id.toLowerCase().includes(lower)
      ) return false;
    }

    return true;
  });

  return (
    <div className="db-orders">
      {/* ── Toolbar ── */}
      <div className="db-orders__toolbar">
        <div className="db-orders__count">
          <span className="db-orders__count-num">{filtered.length}</span>
          <span className="db-orders__count-label">{filtered.length === 1 ? "delivery" : "deliveries"}</span>
        </div>

        <div className="db-orders__search-wrap">
          <svg className="db-orders__search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10 10l3 3" />
          </svg>
          <input
            type="search"
            className="db-orders__search"
            placeholder="Search for deliveries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="db-orders__actions">
          <a href="/dashboard/checkout" className="btn btn--primary btn--sm db-orders__add-btn">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6.5 1v11M1 6.5h11" />
            </svg>
            Add one-off order
          </a>
          <button type="button" className="db-orders__filter-btn" aria-label="Show filter options">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M1 3h12M3.5 7h7M6 11h2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Date filter ── */}
      <div className="db-orders__date-row">
        <span className="db-orders__filter-label">Delivery Date:</span>
        <input
          type="date"
          className="db-orders__date-input"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
        />
        <span className="db-orders__filter-sep">to</span>
        <input
          type="date"
          className="db-orders__date-input"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
        />
      </div>

      {/* ── Status filter ── */}
      <div className="db-orders__status-row">
        <button type="button" className="db-orders__clear" onClick={clearFilters}>
          Clear filters
        </button>
        <div className="db-orders__status-group">
          <span className="db-orders__filter-label">Status:</span>
          {STATUS_KEYS.map((key) => (
            <label
              key={key}
              className={`db-status-chip${statuses[key] ? " db-status-chip--checked" : ""}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={statuses[key]}
                onChange={() => toggleStatus(key)}
              />
              {statuses[key] && <CheckIcon />}
              {STATUS_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      {/* ── Advanced filters toggle ── */}
      <div className="db-orders__advanced-row">
        <button
          type="button"
          className="db-orders__advanced-toggle"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            aria-hidden="true"
          >
            <path d="M1 3l4 4 4-4" />
          </svg>
          Advanced Filters
        </button>
      </div>

      <hr className="db-orders__divider" />

      {fetchError && (
        <p style={{ color: "var(--color-accent)", fontSize: "0.875rem", marginBottom: "1rem" }}>{fetchError}</p>
      )}

      {loading ? (
        <p style={{ color: "var(--color-ink-muted)", fontSize: "0.875rem", padding: "2rem 0" }}>Loading orders…</p>
      ) : filtered.length === 0 ? (
        /* ── Empty state ── */
        <div className="db-orders__empty">
          <svg className="db-orders__empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8" y="6" width="32" height="38" rx="3" />
            <path d="M16 6v-2a2 2 0 014 0v2M28 6v-2a2 2 0 014 0v2" />
            <path d="M14 20h20M14 28h14M14 36h8" />
            <rect x="14" y="14" width="20" height="4" rx="1" />
          </svg>
          <h2 className="db-orders__empty-title">No deliveries yet</h2>
          <p className="db-orders__empty-sub">
            {orders.length > 0
              ? "No orders match your current filters."
              : "Place a one-off order or set up a subscription to get started."}
          </p>
          {orders.length === 0 && (
            <a href="/dashboard/checkout" className="btn btn--primary btn--sm">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6.5 1v11M1 6.5h11" />
              </svg>
              Place an order
            </a>
          )}
        </div>
      ) : (
        /* ── Orders list ── */
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((order) => {
            const st = order.status as StatusKey;
            const badge = STATUS_BADGE[st];
            const dateLabel = order.delivery_date
              ? new Date(order.delivery_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

            return (
              <div
                key={order.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr auto",
                  gap: "1rem",
                  padding: "0.875rem 0",
                  borderBottom: "1px solid var(--color-border)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.8125rem", color: "var(--color-ink-muted)", whiteSpace: "nowrap" }}>
                  {dateLabel}
                </span>
                <span style={{ fontSize: "0.875rem", lineHeight: 1.4 }}>
                  {formatItems(order)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
                  {order.total_inc_vat != null && (
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                      £{order.total_inc_vat.toFixed(2)}
                    </span>
                  )}
                  <span style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    background: badge?.bg ?? "var(--color-surface-2)",
                    color: badge?.color ?? "var(--color-ink-muted)",
                    whiteSpace: "nowrap",
                  }}>
                    {STATUS_LABELS[st] ?? order.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
