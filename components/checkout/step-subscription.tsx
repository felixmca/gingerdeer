"use client";

import { useMemo } from "react";
import {
  computePlan,
  MULT_STEPS,
  FREQ_LABEL,
  type Frequency,
  type MultStep,
} from "@/lib/funnel-logic";

export interface IngredientRow {
  id: string;
  slug: string;
  name: string;
  format: "shot" | "share";
  price_ex_vat: number;
  unit_label: string;
  sort_order: number;
}

export interface SubConfig {
  ingredients: string[];
  frequency: Frequency;
  teamSize: number;
  multiplier: MultStep;
}

interface Props {
  allIngredients: IngredientRow[];
  config: SubConfig;
  onChange: (c: SubConfig) => void;
  onNext: () => void;
}

const FREQ_OPTIONS: { value: Frequency; label: string; sub: string }[] = [
  { value: "weekly",   label: "Weekly",       sub: "52 deliveries / year" },
  { value: "biweekly", label: "Every 2 weeks", sub: "26 deliveries / year" },
  { value: "monthly",  label: "Monthly",      sub: "12 deliveries / year" },
];

const MULT_OPTIONS: { value: MultStep; label: string; sub: string }[] = [
  { value: 0.5, label: "Lite",      sub: "½ unit / person" },
  { value: 1.0, label: "Standard",  sub: "1 unit / person" },
  { value: 1.5, label: "Generous",  sub: "1½ units / person" },
  { value: 2.0, label: "Premium",   sub: "2 units / person" },
];

function fmtGBP(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StepSubscription({ allIngredients, config, onChange, onNext }: Props) {
  const plan = useMemo(
    () =>
      config.ingredients.length > 0 && config.frequency
        ? computePlan(config.ingredients, config.multiplier, config.teamSize, config.frequency)
        : null,
    [config]
  );

  const canAdvance =
    config.ingredients.length > 0 &&
    config.frequency !== null &&
    config.teamSize >= 1;

  function toggleIngredient(slug: string) {
    const next = config.ingredients.includes(slug)
      ? config.ingredients.filter((s) => s !== slug)
      : [...config.ingredients, slug];
    onChange({ ...config, ingredients: next });
  }

  return (
    <div className="co-layout">
      {/* ── Left: form ── */}
      <div className="co-form">

        {/* Juice types */}
        <section className="co-section">
          <h2 className="co-section__title">Choose your juices</h2>
          <p className="co-section__sub">Select one or more. Mix shots and share bottles.</p>
          <div className="co-ing-grid">
            {allIngredients.map((ing) => {
              const selected = config.ingredients.includes(ing.slug);
              return (
                <button
                  key={ing.slug}
                  type="button"
                  className={`co-ing-card${selected ? " co-ing-card--selected" : ""}`}
                  onClick={() => toggleIngredient(ing.slug)}
                >
                  <span className="co-ing-card__name">{ing.name}</span>
                  <span className="co-ing-card__label">{ing.unit_label}</span>
                  <span className="co-ing-card__price">{fmtGBP(ing.price_ex_vat)} ex VAT</span>
                  {selected && (
                    <span className="co-ing-card__check" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M2.5 7.5l3.5 3.5 6.5-6.5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Delivery frequency */}
        <section className="co-section">
          <h2 className="co-section__title">Delivery frequency</h2>
          <div className="co-option-group">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`co-option-btn${config.frequency === opt.value ? " co-option-btn--selected" : ""}`}
                onClick={() => onChange({ ...config, frequency: opt.value })}
              >
                <span className="co-option-btn__label">{opt.label}</span>
                <span className="co-option-btn__sub">{opt.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Team size */}
        <section className="co-section">
          <h2 className="co-section__title">Team size</h2>
          <p className="co-section__sub">How many people will receive each delivery?</p>
          <div className="co-qty-row">
            <button
              type="button"
              className="co-qty-btn"
              onClick={() => onChange({ ...config, teamSize: Math.max(1, config.teamSize - 1) })}
              aria-label="Decrease team size"
            >−</button>
            <input
              type="number"
              className="co-qty-input"
              value={config.teamSize}
              min={1}
              max={5000}
              onChange={(e) => onChange({ ...config, teamSize: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <button
              type="button"
              className="co-qty-btn"
              onClick={() => onChange({ ...config, teamSize: config.teamSize + 1 })}
              aria-label="Increase team size"
            >+</button>
            <span className="co-qty-label">people</span>
          </div>
        </section>

        {/* Quantity per person */}
        <section className="co-section">
          <h2 className="co-section__title">Quantity per person</h2>
          <div className="co-option-group">
            {MULT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`co-option-btn${config.multiplier === opt.value ? " co-option-btn--selected" : ""}`}
                onClick={() => onChange({ ...config, multiplier: opt.value })}
              >
                <span className="co-option-btn__label">{opt.label}</span>
                <span className="co-option-btn__sub">{opt.sub}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── Right: live price card ── */}
      <div className="co-summary">
        <div className="co-price-card">
          <p className="co-price-card__label">Monthly estimate</p>

          {plan ? (
            <>
              <p className="co-price-card__total">{fmtGBP(plan.totalPerMonthIncVat)}</p>
              <p className="co-price-card__vat">inc. 20% VAT</p>

              <div className="co-price-card__breakdown">
                <div className="co-price-card__row">
                  <span>Subtotal</span>
                  <span>{fmtGBP(plan.pricePerMonthExVat)}</span>
                </div>
                <div className="co-price-card__row">
                  <span>VAT (20%)</span>
                  <span>{fmtGBP(plan.vatPerMonth)}</span>
                </div>
                <div className="co-price-card__divider" />
                <div className="co-price-card__row co-price-card__row--total">
                  <span>Per delivery</span>
                  <span>{fmtGBP(plan.pricePerDropExVat * 1.2)}</span>
                </div>
              </div>

              <div className="co-price-card__meta">
                {plan.shotsPerDrop > 0 && (
                  <span>{plan.shotsPerDrop} shots / delivery</span>
                )}
                {plan.bottlesPerDrop > 0 && (
                  <span>{plan.bottlesPerDrop} bottles / delivery</span>
                )}
                <span>{FREQ_LABEL[plan.freq ?? "monthly"]} billing</span>
                <span>{plan.team} people</span>
              </div>
            </>
          ) : (
            <p className="co-price-card__placeholder">
              Select juices, frequency and team size to see your estimate.
            </p>
          )}
        </div>

        <button
          type="button"
          className="adm-btn adm-btn--primary co-next-btn"
          onClick={onNext}
          disabled={!canAdvance}
        >
          Continue
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5.5 2.5l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
