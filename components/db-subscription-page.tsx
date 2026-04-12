"use client";

import {
  FREQ_LABEL,
  ingredientLabels,
  primaryMeta,
  STATUS_LABELS,
  type SubRow,
  type SubStatus,
} from "@/lib/subscription-meta";
import { useEffect, useState } from "react";
import { DbSubscriptionDetailModal } from "./db-subscription-detail-modal";
import { DbSubscriptionModal } from "./db-subscription-modal";

// ── Filter helpers ────────────────────────────────────────────────────────────

type StatusKey = SubStatus;

const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusKey[];

const DRINK_NAMES = ["All-in-one", "Lemon, Ginger, Honey", "Apple Ginger", "Turmeric Boost"];
const DAY_KEYS    = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function allTrue(keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, true]));
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DbSubscriptionPage() {
  const [search,       setSearch]       = useState("");
  const [statuses,     setStatuses]     = useState<Record<StatusKey, boolean>>({
    pending: true, active: true, paused: true, cancelled: false,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedSub,  setSelectedSub]  = useState<SubRow | null>(null);

  const [subRows,   setSubRows]         = useState<SubRow[]>([]);
  const [loading,   setLoading]         = useState(true);

  const [drinkFilters, setDrinkFilters] = useState<Record<string, boolean>>(
    () => allTrue(DRINK_NAMES)
  );
  const [dayFilters, setDayFilters]     = useState<Record<string, boolean>>(
    () => allTrue(DAY_KEYS)
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const json = await res.json() as { subscriptions?: SubRow[] };
          setSubRows(json.subscriptions ?? []);
        }
      } catch { /* silently show empty state */ }
      setLoading(false);
    }
    load();
  }, []);

  function toggleStatus(key: StatusKey) { setStatuses((s) => ({ ...s, [key]: !s[key] })); }
  function toggleDrink(name: string)    { setDrinkFilters((f) => ({ ...f, [name]: !f[name] })); }
  function toggleDay(day: string)       { setDayFilters((f) => ({ ...f, [day]: !f[day] })); }

  function clearFilters() {
    setSearch("");
    setStatuses({ pending: true, active: true, paused: true, cancelled: false });
    setDrinkFilters(allTrue(DRINK_NAMES));
    setDayFilters(allTrue(DAY_KEYS));
  }

  // Prepend newly created subscription so it appears at the top
  function handleNewSub(sub: SubRow) {
    setSubRows((rows) => [sub, ...rows]);
  }

  // Called when the detail modal updates a sub's status/fields
  function handleSubUpdate(updated: SubRow) {
    setSubRows((rows) => rows.map((r) => r.id === updated.id ? updated : r));
    setSelectedSub(updated);
  }

  // Filters
  const visibleSubRows = subRows.filter((sub) => {
    if (!statuses[sub.status]) return false;
    const pm = primaryMeta(sub.ingredients);
    if (!drinkFilters[pm.name]) return false;
    if (search) {
      const needle = search.toLowerCase();
      const hay = [pm.name, FREQ_LABEL[sub.frequency] ?? sub.frequency, STATUS_LABELS[sub.status]].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const totalCount = subRows.length;
  const hasAny     = totalCount > 0;

  return (
    <>
      <div className="db-orders">
        {/* ── Toolbar ── */}
        <div className="db-orders__toolbar">
          <div className="db-orders__count">
            <span className="db-orders__count-num">{loading ? "—" : totalCount}</span>
            <span className="db-orders__count-label">subscription{totalCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="db-orders__search-wrap">
            <svg className="db-orders__search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3 3" />
            </svg>
            <input
              type="search"
              className="db-orders__search"
              placeholder="Search subscriptions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="db-orders__actions">
            <button type="button" className="btn btn--primary btn--sm db-orders__add-btn" onClick={() => setNewModalOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6.5 1v11M1 6.5h11" />
              </svg>
              New subscription
            </button>
          </div>
        </div>

        {/* ── Status filter ── */}
        <div className="db-orders__status-row">
          <button type="button" className="db-orders__clear" onClick={clearFilters}>Clear filters</button>
          <div className="db-orders__status-group">
            <span className="db-orders__filter-label">Status:</span>
            {STATUS_KEYS.map((key) => (
              <label key={key} className={`db-status-chip${statuses[key] ? " db-status-chip--checked" : ""}`}>
                <input type="checkbox" className="sr-only" checked={statuses[key]} onChange={() => toggleStatus(key)} />
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
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true">
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
                    <label key={name} className={`db-status-chip${drinkFilters[name] ? " db-status-chip--checked" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={drinkFilters[name]} onChange={() => toggleDrink(name)} />
                      {drinkFilters[name] && <CheckIcon />}
                      {name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="db-advanced-group">
                <span className="db-orders__filter-label">Delivery day:</span>
                <div className="db-advanced-chips">
                  {DAY_KEYS.map((day) => (
                    <label key={day} className={`db-status-chip${dayFilters[day] ? " db-status-chip--checked" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={dayFilters[day]} onChange={() => toggleDay(day)} />
                      {dayFilters[day] && <CheckIcon />}
                      {day}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <hr className="db-orders__divider" />

        {/* ── Cards ── */}
        {loading ? (
          <div className="db-orders__empty">
            <p className="db-orders__empty-sub">Loading subscriptions…</p>
          </div>
        ) : !hasAny ? (
          <div className="db-orders__empty">
            <svg className="db-orders__empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="8" y="10" width="32" height="30" rx="3" />
              <path d="M16 10V7a2 2 0 014 0v3M28 10V7a2 2 0 014 0v3M8 18h32M16 26h10M16 33h6" />
              <path d="M33 26a5 5 0 100 8" strokeWidth="1.75" /><path d="M33 34l2-2-2-2" strokeWidth="1.75" />
            </svg>
            <h2 className="db-orders__empty-title">No subscription configured yet</h2>
            <p className="db-orders__empty-sub">
              Complete the sign-up journey on the home page, or create one here directly.
            </p>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setNewModalOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6.5 1v11M1 6.5h11" />
              </svg>
              Configure subscription
            </button>
          </div>
        ) : (
          <div className="db-sub-list">
            {visibleSubRows.length === 0 ? (
              <p className="db-sub-no-match">No subscriptions match the current filters.</p>
            ) : (
              visibleSubRows.map((sub) => {
                const pm   = primaryMeta(sub.ingredients);
                const freq = FREQ_LABEL[sub.frequency] ?? sub.frequency;
                const mult = parseFloat(sub.quantity_tier);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className="db-sub-card db-sub-card--clickable"
                    style={{ borderColor: pm.accent }}
                    onClick={() => setSelectedSub(sub)}
                    aria-label={`View ${pm.name} subscription`}
                  >
                    <div className="db-sub-card__head" style={{ background: pm.bg, borderBottomColor: pm.accent + "33" }}>
                      <div>
                        <p className="db-sub-card__deliver-line" style={{ color: pm.accent }}>
                          {freq} · {sub.team_size} {sub.team_size === 1 ? "person" : "people"}
                        </p>
                        <p className="db-sub-card__details-line">
                          {ingredientLabels(sub.ingredients)}
                          <span className="db-sub-card__status-badge" data-status={sub.status}>
                            {STATUS_LABELS[sub.status]}
                          </span>
                        </p>
                      </div>
                      <span className="db-sub-card__chevron" aria-hidden="true">›</span>
                    </div>
                    <div className="db-sub-card__body">
                      <div className="db-sub-card__drink-row">
                        <span className="db-sub-card__drink-dot" style={{ background: pm.accent }} />
                        <span className="db-sub-card__drink-name">{pm.name}</span>
                        {sub.ingredients.length > 1 && (
                          <span className="db-sub-card__drink-name" style={{ color: "var(--color-ink-muted)", fontWeight: 400 }}>
                            +{sub.ingredients.length - 1} more
                          </span>
                        )}
                      </div>
                      <p className="db-sub-card__qty">
                        {sub.shots_per_drop > 0  && `${sub.shots_per_drop} × 100ml shots`}
                        {sub.shots_per_drop > 0 && sub.bottles_per_drop > 0 && " · "}
                        {sub.bottles_per_drop > 0 && `${sub.bottles_per_drop} × 1L bottles`}
                        {!isNaN(mult) && ` (${mult}× / person)`}
                      </p>
                      {sub.total_per_month_inc_vat != null && (
                        <p className="db-sub-card__price" style={{ color: pm.accent }}>
                          £{sub.total_per_month_inc_vat.toFixed(2)} / month inc. VAT
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      <DbSubscriptionDetailModal
        sub={selectedSub}
        onClose={() => setSelectedSub(null)}
        onUpdate={handleSubUpdate}
      />

      {/* ── New subscription modal ── */}
      <DbSubscriptionModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onComplete={handleNewSub}
      />
    </>
  );
}
