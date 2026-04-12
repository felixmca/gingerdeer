"use client";

import {
  FREQ_LABEL,
  ingredientLabels,
  primaryMeta,
  SLUG_META,
  STATUS_LABELS,
  type SubRow,
  type SubStatus,
} from "@/lib/subscription-meta";
import { useEffect, useState } from "react";

type ModalMode = "view" | "cancelling" | "done";

interface Props {
  sub: SubRow | null;
  onClose: () => void;
  onUpdate: (updated: SubRow) => void;
}

function fmtGBP(n: number | null | undefined) {
  if (n == null) return "—";
  return `£${n.toFixed(2)}`;
}

export function DbSubscriptionDetailModal({ sub, onClose, onUpdate }: Props) {
  const [mode, setMode]       = useState<ModalMode>("view");
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState("");

  const open = sub !== null;

  useEffect(() => {
    if (open) { setMode("view"); setError(""); }
  }, [open, sub?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!sub) return null;

  const pm       = primaryMeta(sub.ingredients);
  const freqLabel = FREQ_LABEL[sub.frequency] ?? sub.frequency;
  const mult      = parseFloat(sub.quantity_tier);
  const multLabel = isNaN(mult) ? sub.quantity_tier : `×${mult}`;

  async function patch(fields: Partial<SubRow>) {
    setPending(true);
    setError("");
    try {
      const res = await fetch(`/api/subscription/${sub!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Update failed.");
      }
      const json = await res.json() as { subscription: SubRow };
      onUpdate(json.subscription);
      if (fields.status === "cancelled") setMode("done");
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setPending(false);
  }

  // ── Status action config ─────────────────────────────────────────────────────
  type Action = { label: string; targetStatus: SubStatus; primary: boolean };

  const ACTIONS: Record<SubStatus, Action[]> = {
    pending: [
      { label: "Confirm subscription",  targetStatus: "active",    primary: true  },
    ],
    active: [
      { label: "Pause subscription",    targetStatus: "paused",    primary: false },
    ],
    paused: [
      { label: "Resume subscription",   targetStatus: "active",    primary: true  },
    ],
    cancelled: [],
  };

  const actions = ACTIONS[sub.status] ?? [];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sub-detail-title">
      <button type="button" className="modal__backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="modal__panel sub-detail">

        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">&times;</button>

        {/* ── Header ── */}
        <div className="sub-detail__head" style={{ background: pm.bg }}>
          <div>
            <span className="sub-detail__status" data-status={sub.status}>
              {STATUS_LABELS[sub.status]}
            </span>
            <h2 id="sub-detail-title" className="sub-detail__title" style={{ color: pm.accent }}>
              {pm.name}
            </h2>
            {sub.ingredients.length > 1 && (
              <p className="sub-detail__subtitle">{ingredientLabels(sub.ingredients)}</p>
            )}
          </div>
          <div
            className="sub-detail__bottle"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${pm.accent} 35%, #fff) 0%, ${pm.accent} 55%, color-mix(in srgb, ${pm.accent} 60%, #000) 100%)`,
              boxShadow: `0 6px 18px color-mix(in srgb, ${pm.accent} 30%, transparent)`,
            }}
          />
        </div>

        {mode === "view" && (
          <>
            {/* ── Plan details ── */}
            <div className="sub-detail__section">
              <p className="sub-detail__section-label">Plan details</p>
              <dl className="sub-detail__dl">
                <div>
                  <dt>Frequency</dt>
                  <dd>{freqLabel}</dd>
                </div>
                <div>
                  <dt>Team size</dt>
                  <dd>{sub.team_size} {sub.team_size === 1 ? "person" : "people"}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{multLabel} per person per drop</dd>
                </div>
                {sub.shots_per_drop > 0 && (
                  <div>
                    <dt>Shots per drop</dt>
                    <dd>{sub.shots_per_drop} × 100ml</dd>
                  </div>
                )}
                {sub.bottles_per_drop > 0 && (
                  <div>
                    <dt>Bottles per drop</dt>
                    <dd>{sub.bottles_per_drop} × 1L share</dd>
                  </div>
                )}
                {sub.shots_per_month > 0 && (
                  <div>
                    <dt>Shots / month</dt>
                    <dd>{sub.shots_per_month}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* ── Pricing ── */}
            {sub.total_per_month_inc_vat != null && (
              <div className="sub-detail__section">
                <p className="sub-detail__section-label">Pricing</p>
                <dl className="sub-detail__dl">
                  {sub.price_per_drop_ex_vat != null && (
                    <div>
                      <dt>Per drop (ex. VAT)</dt>
                      <dd>{fmtGBP(sub.price_per_drop_ex_vat)}</dd>
                    </div>
                  )}
                  {sub.price_per_month_ex_vat != null && (
                    <div>
                      <dt>Per month (ex. VAT)</dt>
                      <dd>{fmtGBP(sub.price_per_month_ex_vat)}</dd>
                    </div>
                  )}
                  {sub.vat_per_month != null && (
                    <div>
                      <dt>VAT (20%)</dt>
                      <dd>{fmtGBP(sub.vat_per_month)}</dd>
                    </div>
                  )}
                  <div className="sub-detail__dl-total">
                    <dt>Monthly total</dt>
                    <dd style={{ color: pm.accent }}>{fmtGBP(sub.total_per_month_inc_vat)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {error && <p className="funnel__error" role="alert">{error}</p>}

            {/* ── Actions ── */}
            {sub.status !== "cancelled" && (
              <div className="sub-detail__actions">
                {actions.map((a) => (
                  <button
                    key={a.targetStatus}
                    type="button"
                    className={a.primary ? "btn btn--primary" : "btn btn--ghost"}
                    disabled={pending}
                    onClick={() => patch({ status: a.targetStatus })}
                  >
                    {pending ? "Saving…" : a.label}
                    {a.primary && !pending && " →"}
                  </button>
                ))}
                <button
                  type="button"
                  className="sub-detail__cancel-link"
                  onClick={() => setMode("cancelling")}
                >
                  Cancel subscription
                </button>
              </div>
            )}
          </>
        )}

        {mode === "cancelling" && (
          <div className="sub-detail__section sub-detail__confirm-cancel">
            <p className="sub-detail__section-label">Cancel subscription</p>
            <p>Are you sure? This will mark the subscription as cancelled. You can start a new one at any time.</p>
            {error && <p className="funnel__error" role="alert">{error}</p>}
            <div className="sub-detail__actions">
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: "#991b1b", borderColor: "#991b1b" }}
                disabled={pending}
                onClick={() => patch({ status: "cancelled" })}
              >
                {pending ? "Cancelling…" : "Yes, cancel it"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setMode("view")}>
                Keep subscription
              </button>
            </div>
          </div>
        )}

        {mode === "done" && (
          <div className="sub-detail__section" style={{ textAlign: "center", padding: "2rem 1.5rem" }}>
            <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✓</p>
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Subscription cancelled</p>
            <p style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)", marginBottom: "1.5rem" }}>
              You can start a new subscription any time from this page.
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
