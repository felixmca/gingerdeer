"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useMemo } from "react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface Props {
  clientSecret: string;
  onBack: () => void;
}

export default function StepPayment({ clientSecret, onBack }: Props) {
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);

  return (
    <div className="co-payment">
      <div className="co-payment__back">
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          onClick={onBack}
        >
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9.5 2.5l-5 5 5 5" />
          </svg>
          Edit order
        </button>
      </div>

      <div className="co-payment__stripe">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
