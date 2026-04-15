"use client";

import type { IngredientRow } from "./step-subscription";

export interface CartItem {
  slug: string;
  name: string;
  format: "shot" | "share";
  unitLabel: string;
  priceExVat: number;
  quantity: number;
}

interface Props {
  allIngredients: IngredientRow[];
  cart: CartItem[];
  onChange: (cart: CartItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const VAT = 0.2;

function fmtGBP(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StepOneOff({ allIngredients, cart, onChange, onNext, onBack }: Props) {
  function getQty(slug: string) {
    return cart.find((i) => i.slug === slug)?.quantity ?? 0;
  }

  function setQty(ing: IngredientRow, qty: number) {
    const next = cart.filter((i) => i.slug !== ing.slug);
    if (qty > 0) {
      next.push({
        slug:       ing.slug,
        name:       ing.name,
        format:     ing.format,
        unitLabel:  ing.unit_label,
        priceExVat: ing.price_ex_vat,
        quantity:   qty,
      });
    }
    onChange(next);
  }

  const subtotalEx = cart.reduce((s, i) => s + i.priceExVat * i.quantity, 0);
  const totalInc   = subtotalEx * (1 + VAT);

  return (
    <div className="co-layout">
      <div className="co-form">
        <section className="co-section">
          <h2 className="co-section__title">Add one-off items</h2>
          <p className="co-section__sub">
            These will be added to your first invoice alongside the subscription. Optional — skip
            if you only want the recurring subscription.
          </p>

          <div className="co-oneoff-grid">
            {allIngredients.map((ing) => {
              const qty = getQty(ing.slug);
              return (
                <div key={ing.slug} className="co-oneoff-row">
                  <div className="co-oneoff-row__info">
                    <span className="co-oneoff-row__name">{ing.name}</span>
                    <span className="co-oneoff-row__label">{ing.unit_label}</span>
                    <span className="co-oneoff-row__price">{fmtGBP(ing.price_ex_vat)} ex VAT</span>
                  </div>
                  <div className="co-oneoff-row__ctrl">
                    <button
                      type="button"
                      className="co-qty-btn"
                      onClick={() => setQty(ing, Math.max(0, qty - 1))}
                      disabled={qty === 0}
                      aria-label={`Decrease ${ing.name}`}
                    >−</button>
                    <span className="co-oneoff-qty">{qty}</span>
                    <button
                      type="button"
                      className="co-qty-btn"
                      onClick={() => setQty(ing, qty + 1)}
                      aria-label={`Increase ${ing.name}`}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Summary sidebar */}
      <div className="co-summary">
        <div className="co-price-card">
          <p className="co-price-card__label">One-off items</p>
          {cart.length === 0 ? (
            <p className="co-price-card__placeholder">No items added yet.</p>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.slug} className="co-price-card__row">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{fmtGBP(item.priceExVat * item.quantity)}</span>
                </div>
              ))}
              <div className="co-price-card__divider" />
              <div className="co-price-card__row">
                <span>Subtotal</span><span>{fmtGBP(subtotalEx)}</span>
              </div>
              <div className="co-price-card__row">
                <span>VAT (20%)</span><span>{fmtGBP(subtotalEx * VAT)}</span>
              </div>
              <div className="co-price-card__row co-price-card__row--total">
                <span>Total inc. VAT</span><span>{fmtGBP(totalInc)}</span>
              </div>
            </>
          )}
        </div>

        <div className="co-btn-row">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onBack}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9.5 2.5l-5 5 5 5" />
            </svg>
            Back
          </button>
          <button type="button" className="adm-btn adm-btn--primary co-next-btn" onClick={onNext}>
            {cart.length === 0 ? "Skip" : "Continue"}
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5.5 2.5l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
