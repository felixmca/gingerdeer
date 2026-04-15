"use client";

import { useMemo } from "react";
import { computePlan, FREQ_LABEL } from "@/lib/funnel-logic";
import type { SubConfig } from "./step-subscription";
import type { CartItem } from "./step-one-off";

interface Props {
  subConfig: SubConfig;
  cart: CartItem[];
  onBack: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

const VAT = 0.2;

function fmtGBP(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StepReview({ subConfig, cart, onBack, onConfirm, loading }: Props) {
  const plan = useMemo(
    () => computePlan(subConfig.ingredients, subConfig.multiplier, subConfig.teamSize, subConfig.frequency),
    [subConfig]
  );

  const cartSubtotalEx = cart.reduce((s, i) => s + i.priceExVat * i.quantity, 0);
  const cartTotalInc   = cartSubtotalEx * (1 + VAT);
  const firstPayment   = plan.totalPerMonthIncVat + cartTotalInc;

  return (
    <div className="co-review">
      <h2 className="co-review__heading">Review your order</h2>

      {/* Subscription */}
      <div className="co-review-card">
        <div className="co-review-card__header">
          <span className="co-review-card__title">Recurring subscription</span>
          <span className="co-review-card__badge">Monthly billing</span>
        </div>
        <div className="co-review-card__body">
          <div className="co-review-row">
            <span>Juices</span>
            <span>{plan.labels.join(", ") || "—"}</span>
          </div>
          <div className="co-review-row">
            <span>Delivery frequency</span>
            <span>{FREQ_LABEL[plan.freq ?? "monthly"]}</span>
          </div>
          <div className="co-review-row">
            <span>Team size</span>
            <span>{plan.team} people</span>
          </div>
          <div className="co-review-row">
            <span>Quantity per person</span>
            <span>{plan.tier}×</span>
          </div>
          <div className="co-review-row">
            <span>Per delivery</span>
            <span>
              {plan.shotsPerDrop > 0 && `${plan.shotsPerDrop} shots`}
              {plan.shotsPerDrop > 0 && plan.bottlesPerDrop > 0 && " + "}
              {plan.bottlesPerDrop > 0 && `${plan.bottlesPerDrop} bottles`}
            </span>
          </div>
          <div className="co-review-card__divider" />
          <div className="co-review-row">
            <span>Monthly ex. VAT</span>
            <span>{fmtGBP(plan.pricePerMonthExVat)}</span>
          </div>
          <div className="co-review-row">
            <span>VAT (20%)</span>
            <span>{fmtGBP(plan.vatPerMonth)}</span>
          </div>
          <div className="co-review-row co-review-row--total">
            <span>Monthly total</span>
            <span>{fmtGBP(plan.totalPerMonthIncVat)}</span>
          </div>
        </div>
      </div>

      {/* One-off items */}
      {cart.length > 0 && (
        <div className="co-review-card">
          <div className="co-review-card__header">
            <span className="co-review-card__title">One-off items</span>
            <span className="co-review-card__badge co-review-card__badge--oneoff">Added to first invoice</span>
          </div>
          <div className="co-review-card__body">
            {cart.map((item) => (
              <div key={item.slug} className="co-review-row">
                <span>{item.name} × {item.quantity}</span>
                <span>{fmtGBP(item.priceExVat * item.quantity)}</span>
              </div>
            ))}
            <div className="co-review-card__divider" />
            <div className="co-review-row co-review-row--total">
              <span>One-off total inc. VAT</span>
              <span>{fmtGBP(cartTotalInc)}</span>
            </div>
          </div>
        </div>
      )}

      {/* First payment total */}
      <div className="co-review-total">
        <div className="co-review-total__row">
          <span>First payment today</span>
          <span className="co-review-total__amount">{fmtGBP(firstPayment)}</span>
        </div>
        {cart.length > 0 && (
          <p className="co-review-total__note">
            Includes {fmtGBP(cartTotalInc)} for one-off items + {fmtGBP(plan.totalPerMonthIncVat)} first month.
            Then {fmtGBP(plan.totalPerMonthIncVat)}/month.
          </p>
        )}
      </div>

      <div className="co-btn-row">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onBack} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9.5 2.5l-5 5 5 5" />
          </svg>
          Back
        </button>
        <button
          type="button"
          className="adm-btn adm-btn--primary co-next-btn"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <><span className="adm-spinner adm-spinner--sm" />Preparing payment…</>
          ) : (
            <>
              Proceed to payment
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5.5 2.5l5 5-5 5" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
