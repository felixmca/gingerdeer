"use client";

import {
  FREQ_DELIVERIES_PER_MONTH,
  SHOT_PRICE_EX_VAT,
  BOTTLE_PRICE_EX_VAT,
  VAT_RATE,
  type Frequency,
} from "@/lib/funnel-logic";
import { type SubRow } from "@/lib/subscription-meta";
import { useState } from "react";

const DRINKS = [
  { id: "allinone",           name: "All-in-one",           accent: "#c2410c", bg: "#fff7ed" },
  { id: "lemon_ginger_honey", name: "Lemon, Ginger, Honey", accent: "#ca8a04", bg: "#fefce8" },
  { id: "apple_ginger",       name: "Apple Ginger",          accent: "#3f6212", bg: "#f7fee7" },
  { id: "turmeric",           name: "Turmeric Boost",        accent: "#d97706", bg: "#fffbeb" },
];

const FORMATS = [
  { key: "shot"  as const, label: "100ml shot",      unitLabel: "shot",         price: SHOT_PRICE_EX_VAT   },
  { key: "share" as const, label: "1L share bottle", unitLabel: "share bottle", price: BOTTLE_PRICE_EX_VAT },
];

const FREQUENCIES = [
  { key: "weekly",    label: "Weekly",        headerLabel: "every week"    },
  { key: "biweekly",  label: "Every 2 weeks", headerLabel: "every 2 weeks" },
  { key: "monthly",   label: "Monthly",       headerLabel: "monthly"       },
];

const DAYS = [
  { key: "Mon", plural: "Mondays"    },
  { key: "Tue", plural: "Tuesdays"   },
  { key: "Wed", plural: "Wednesdays" },
  { key: "Thu", plural: "Thursdays"  },
  { key: "Fri", plural: "Fridays"    },
];

const STEP_TITLES: Record<number, string> = {
  1: "Choose your drink",
  2: "Set a delivery schedule",
  3: "Set quantity",
  4: "Delivery details",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (sub: SubRow) => void;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 5.5L4.5 8.5L9.5 2.5" />
    </svg>
  );
}

export function DbSubscriptionModal({ open, onClose, onComplete }: Props) {
  const [step, setStep]             = useState(1);
  const [drinkId, setDrinkId]       = useState("allinone");
  const [format, setFormat]         = useState<"shot" | "share">("shot");
  const [frequency, setFrequency]   = useState("biweekly");
  const [deliveryDay, setDeliveryDay] = useState("Mon");
  const [quantity, setQuantity]     = useState(10);
  const [address, setAddress]       = useState("");
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!open) return null;

  const drink = DRINKS.find((d) => d.id === drinkId) ?? DRINKS[0];
  const fmt   = FORMATS.find((f) => f.key === format) ?? FORMATS[0];
  const freq  = FREQUENCIES.find((f) => f.key === frequency) ?? FREQUENCIES[1];
  const day   = DAYS.find((d) => d.key === deliveryDay) ?? DAYS[0];
  const total = (quantity * fmt.price).toFixed(2);

  function resetForm() {
    setStep(1);
    setDrinkId("allinone");
    setFormat("shot");
    setFrequency("biweekly");
    setDeliveryDay("Mon");
    setQuantity(10);
    setAddress("");
    setNotes("");
    setSubmitError("");
  }

  async function handleComplete() {
    setSubmitting(true);
    setSubmitError("");

    const slug             = `${drinkId}_${format}`;
    const shots_per_drop   = format === "shot"  ? quantity : 0;
    const bottles_per_drop = format === "share" ? quantity : 0;
    const perMonth         = FREQ_DELIVERIES_PER_MONTH[frequency] ?? 1;

    const shots_per_month           = Math.round(shots_per_drop * perMonth);
    const bottles_per_month         = Math.round(bottles_per_drop * perMonth);
    const price_per_drop_ex_vat     = parseFloat((shots_per_drop * SHOT_PRICE_EX_VAT + bottles_per_drop * BOTTLE_PRICE_EX_VAT).toFixed(2));
    const price_per_month_ex_vat    = parseFloat((price_per_drop_ex_vat * perMonth).toFixed(2));
    const vat_per_month             = parseFloat((price_per_month_ex_vat * VAT_RATE).toFixed(2));
    const total_per_month_inc_vat   = parseFloat((price_per_month_ex_vat + vat_per_month).toFixed(2));

    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients:            [slug],
          frequency,
          team_size:              quantity,
          quantity_tier:          "1",
          shots_per_drop,
          bottles_per_drop,
          shots_per_month,
          bottles_per_month,
          price_per_drop_ex_vat,
          price_per_month_ex_vat,
          vat_per_month,
          total_per_month_inc_vat,
        }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to create subscription.");
      }

      const json = await res.json() as { subscription: SubRow };
      resetForm();
      onComplete(json.subscription);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    }

    setSubmitting(false);
  }

  return (
    <div className="sub-modal-overlay" onClick={onClose}>
      <div className="sub-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sub-modal__header">
          <div>
            <p className="sub-modal__step-label">Step {step} of 4</p>
            <h2 className="sub-modal__title">{STEP_TITLES[step]}</h2>
          </div>
          <button type="button" className="sub-modal__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="sub-modal__progress">
          <div className="sub-modal__progress-bar" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="sub-modal__body">

          {/* Step 1 — Drink + Format */}
          {step === 1 && (
            <div className="sub-modal__step">
              <fieldset className="sub-modal__fieldset">
                <legend className="sub-modal__legend">Drink</legend>
                <div className="sub-modal__option-grid">
                  {DRINKS.map((d) => (
                    <label
                      key={d.id}
                      className={`sub-modal__option${drinkId === d.id ? " sub-modal__option--selected" : ""}`}
                      style={drinkId === d.id ? { borderColor: d.accent, background: d.bg } : {}}
                    >
                      <input
                        type="radio"
                        name="drink"
                        value={d.id}
                        checked={drinkId === d.id}
                        onChange={() => setDrinkId(d.id)}
                        className="sr-only"
                      />
                      <span className="sub-modal__option-dot" style={{ background: d.accent }} />
                      {d.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="sub-modal__fieldset">
                <legend className="sub-modal__legend">Format</legend>
                <div className="sub-modal__format-row">
                  {FORMATS.map((f) => (
                    <label
                      key={f.key}
                      className={`sub-modal__format-chip${format === f.key ? " sub-modal__format-chip--active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={f.key}
                        checked={format === f.key}
                        onChange={() => setFormat(f.key)}
                        className="sr-only"
                      />
                      <strong>{f.label}</strong>
                      <span>£{f.price.toFixed(2)} each</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* Step 2 — Schedule */}
          {step === 2 && (
            <div className="sub-modal__step">
              <fieldset className="sub-modal__fieldset">
                <legend className="sub-modal__legend">Frequency</legend>
                <div className="sub-modal__pill-row">
                  {FREQUENCIES.map((f) => (
                    <label
                      key={f.key}
                      className={`sub-modal__pill${frequency === f.key ? " sub-modal__pill--active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="frequency"
                        value={f.key}
                        checked={frequency === f.key}
                        onChange={() => setFrequency(f.key)}
                        className="sr-only"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="sub-modal__fieldset">
                <legend className="sub-modal__legend">Delivery day</legend>
                <div className="sub-modal__pill-row">
                  {DAYS.map((d) => (
                    <label
                      key={d.key}
                      className={`sub-modal__pill${deliveryDay === d.key ? " sub-modal__pill--active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="day"
                        value={d.key}
                        checked={deliveryDay === d.key}
                        onChange={() => setDeliveryDay(d.key)}
                        className="sr-only"
                      />
                      {d.key}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* Step 3 — Quantity */}
          {step === 3 && (
            <div className="sub-modal__step">
              <p className="sub-modal__qty-hint">
                {drink.name} · {fmt.label} · £{fmt.price.toFixed(2)} each
              </p>

              <div className="sub-modal__stepper-wrap">
                <button
                  type="button"
                  className="sub-modal__stepper-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="sub-modal__stepper-val">{quantity}</span>
                <button
                  type="button"
                  className="sub-modal__stepper-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <div className="sub-modal__price-preview">
                <span className="sub-modal__price-line">
                  {quantity} × £{fmt.price.toFixed(2)} = <strong>£{total}</strong> per delivery
                </span>
              </div>
            </div>
          )}

          {/* Step 4 — Delivery details */}
          {step === 4 && (
            <div className="sub-modal__step">
              <label className="sub-modal__field">
                <span className="sub-modal__field-label">Delivery address</span>
                <input
                  type="text"
                  className="sub-modal__input"
                  placeholder="e.g. 10 Downing Street, London, SW1A 2AA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>

              <label className="sub-modal__field">
                <span className="sub-modal__field-label">
                  Delivery notes{" "}
                  <span className="sub-modal__optional">(optional)</span>
                </span>
                <textarea
                  className="sub-modal__textarea"
                  placeholder="e.g. Leave in the fridge room on arrival"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              <div className="sub-modal__summary">
                <p className="sub-modal__summary-title">Summary</p>
                <dl className="sub-modal__summary-list">
                  <div><dt>Drink</dt><dd>{drink.name}</dd></div>
                  <div><dt>Format</dt><dd>{quantity}× {fmt.unitLabel}s</dd></div>
                  <div><dt>Schedule</dt><dd>{freq.label}, {deliveryDay}</dd></div>
                  <div><dt>Price</dt><dd>£{total} per delivery</dd></div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sub-modal__footer">
          {step > 1 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={submitting}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {submitError && (
            <p className="funnel__error" role="alert" style={{ margin: "0 0.75rem 0 0", fontSize: "0.82rem" }}>
              {submitError}
            </p>
          )}
          {step < 4 ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={submitting}
              onClick={handleComplete}
            >
              {submitting ? "Saving…" : "Create subscription"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
