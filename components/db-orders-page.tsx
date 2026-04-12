"use client";

import { useState } from "react";

type StatusKey = "scheduled" | "confirmed" | "fulfilled" | "cancelled";

const STATUS_LABELS: Record<StatusKey, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusKey[];

const DRINK_NAMES = ["All-in-one", "Lemon, Ginger, Honey", "Apple Ginger", "Turmeric Boost"];
const FORMAT_NAMES = ["100ml shot", "1L share bottle"];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nextYearISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" />
    </svg>
  );
}

export function DbOrdersPage() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(nextYearISO);
  const [statuses, setStatuses] = useState<Record<StatusKey, boolean>>({
    scheduled: true,
    confirmed: true,
    fulfilled: true,
    cancelled: false,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [drinkFilters, setDrinkFilters] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DRINK_NAMES.map((d) => [d, false]))
  );
  const [formatFilters, setFormatFilters] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FORMAT_NAMES.map((f) => [f, false]))
  );

  function toggleStatus(key: StatusKey) {
    setStatuses((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleDrink(name: string) {
    setDrinkFilters((f) => ({ ...f, [name]: !f[name] }));
  }

  function toggleFormat(name: string) {
    setFormatFilters((f) => ({ ...f, [name]: !f[name] }));
  }

  function clearFilters() {
    setSearch("");
    setDateFrom(todayISO());
    setDateTo(nextYearISO());
    setStatuses({ scheduled: true, confirmed: true, fulfilled: true, cancelled: false });
    setDrinkFilters(Object.fromEntries(DRINK_NAMES.map((d) => [d, false])));
    setFormatFilters(Object.fromEntries(FORMAT_NAMES.map((f) => [f, false])));
  }

  return (
    <div className="db-orders">
      {/* ── Toolbar ── */}
      <div className="db-orders__toolbar">
        <div className="db-orders__count">
          <span className="db-orders__count-num">0</span>
          <span className="db-orders__count-label">deliveries</span>
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
          <a href="/dashboard/one-off" className="btn btn--primary btn--sm db-orders__add-btn">
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

      {/* ── Advanced filters ── */}
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

        {advancedOpen && (
          <div className="db-advanced-panel">
            <div className="db-advanced-group">
              <span className="db-orders__filter-label">Drink type:</span>
              <div className="db-advanced-chips">
                {DRINK_NAMES.map((name) => (
                  <label
                    key={name}
                    className={`db-status-chip${drinkFilters[name] ? " db-status-chip--checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={drinkFilters[name]}
                      onChange={() => toggleDrink(name)}
                    />
                    {drinkFilters[name] && <CheckIcon />}
                    {name}
                  </label>
                ))}
              </div>
            </div>

            <div className="db-advanced-group">
              <span className="db-orders__filter-label">Format:</span>
              <div className="db-advanced-chips">
                {FORMAT_NAMES.map((fmt) => (
                  <label
                    key={fmt}
                    className={`db-status-chip${formatFilters[fmt] ? " db-status-chip--checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formatFilters[fmt]}
                      onChange={() => toggleFormat(fmt)}
                    />
                    {formatFilters[fmt] && <CheckIcon />}
                    {fmt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="db-orders__divider" />

      {/* ── Empty state ── */}
      <div className="db-orders__empty">
        <svg className="db-orders__empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="6" width="32" height="38" rx="3" />
          <path d="M16 6v-2a2 2 0 014 0v2M28 6v-2a2 2 0 014 0v2" />
          <path d="M14 20h20M14 28h14M14 36h8" />
          <rect x="14" y="14" width="20" height="4" rx="1" />
        </svg>
        <h2 className="db-orders__empty-title">No deliveries yet</h2>
        <p className="db-orders__empty-sub">
          Configure your subscription to get started.
        </p>
        <a href="/dashboard/subscriptions" className="btn btn--primary btn--sm">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6.5 1v11M1 6.5h11" />
          </svg>
          Set up a subscription
        </a>
      </div>
    </div>
  );
}
