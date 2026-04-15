"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StepSubscription, { type IngredientRow, type SubConfig } from "./step-subscription";
import StepOneOff, { type CartItem } from "./step-one-off";
import StepReview from "./step-review";
import StepPayment from "./step-payment";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Subscription", "Add-ons", "Review", "Payment"];

const DEFAULT_CONFIG: SubConfig = {
  ingredients: [],
  frequency:   "monthly",
  teamSize:    1,
  multiplier:  1.0,
};

export default function CheckoutWizard() {
  const [step,         setStep]         = useState<Step>(1);
  const [ingredients,  setIngredients]  = useState<IngredientRow[]>([]);
  const [subConfig,    setSubConfig]    = useState<SubConfig>(DEFAULT_CONFIG);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Fetch ingredients once on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ingredients")
      .select("id, slug, name, format, price_ex_vat, unit_label, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setFetchError("Failed to load ingredients. Please refresh.");
        } else {
          setIngredients((data as IngredientRow[]) ?? []);
        }
      });
  }, []);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sub: subConfig, cart }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create session");
      setClientSecret(json.clientSecret);
      setStep(4);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (fetchError) {
    return (
      <div className="co-error">
        <p>{fetchError}</p>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="co-wizard">
      {/* Step indicator */}
      <div className="co-stepper" aria-label="Checkout steps">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const done    = n < step;
          const current = n === step;
          return (
            <div
              key={n}
              className={`co-step${current ? " co-step--active" : ""}${done ? " co-step--done" : ""}`}
            >
              <span className="co-step__dot" aria-hidden="true">
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M2.5 7.5l3.5 3.5 6.5-6.5" />
                  </svg>
                ) : n}
              </span>
              <span className="co-step__label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepSubscription
          allIngredients={ingredients}
          config={subConfig}
          onChange={setSubConfig}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepOneOff
          allIngredients={ingredients}
          cart={cart}
          onChange={setCart}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepReview
          subConfig={subConfig}
          cart={cart}
          onBack={() => setStep(2)}
          onConfirm={handleConfirm}
          loading={loading}
        />
      )}

      {step === 4 && clientSecret && (
        <StepPayment
          clientSecret={clientSecret}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}
