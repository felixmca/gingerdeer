"use client";

import {
  computePlan,
  FREQ_LABEL,
  FUNNEL_TITLES,
  INGREDIENT_META,
  MULT_STEPS,
  type Frequency,
  type MultStep,
} from "@/lib/funnel-logic";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_STEP = 4;

type Step = 1 | 2 | 3 | 4 | "success";

const INGREDIENT_OPTIONS = [
  { value: "allinone_shot",            name: "All-in-one",           meta: "100ml shot · £3.50 ex. VAT"          },
  { value: "allinone_share",           name: "All-in-one",           meta: "1L share bottle · £25.00 ex. VAT"    },
  { value: "lemon_ginger_honey_shot",  name: "Lemon, Ginger, Honey", meta: "100ml shot · £3.50 ex. VAT"          },
  { value: "lemon_ginger_honey_share", name: "Lemon, Ginger, Honey", meta: "1L share bottle · £25.00 ex. VAT"    },
  { value: "apple_ginger_shot",        name: "Apple Ginger",         meta: "100ml shot · £3.50 ex. VAT"          },
  { value: "apple_ginger_share",       name: "Apple Ginger",         meta: "1L share bottle · £25.00 ex. VAT"    },
  { value: "turmeric_shot",            name: "Turmeric Boost",       meta: "100ml shot · £3.50 ex. VAT"          },
  { value: "turmeric_share",           name: "Turmeric Boost",       meta: "1L share bottle · £25.00 ex. VAT"    },
] as const;

const MULT_META: Record<MultStep, { label: string; sub: string }> = {
  0.5: { label: "×0.5",  sub: "Try it out"     },
  1.0: { label: "×1.0",  sub: "Standard"       },
  1.5: { label: "×1.5",  sub: "Generous"       },
  2.0: { label: "×2.0",  sub: "Full coverage"  },
};

export interface FunnelPrefill {
  email: string;
  company: string;
  role?: string;
  leadId?: string;
}

export function FunnelModal({
  open,
  onClose,
  prefill,
  preselectedIngredient,
  loggedIn,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: FunnelPrefill;
  preselectedIngredient?: string;
  loggedIn?: boolean;
}) {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<Frequency>(null);
  const [perPersonMult, setPerPersonMult] = useState<MultStep>(1.0);
  const [teamSize, setTeamSize] = useState(50);
  const [submitError, setSubmitError] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [step1Saving, setStep1Saving] = useState(false);
  const [existingUser, setExistingUser] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  // Prevents the submit button from being active the instant step 4 renders.
  // Without this, a double-click on "Continue" (step 3) fires a second click
  // on the Submit button that React renders at the same DOM position.
  const [step4Ready, setStep4Ready] = useState(false);
  const step4RafRef = useRef<number | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  const plan = computePlan(ingredients, perPersonMult, teamSize, frequency);

  const fmt = (n: number) => (n >= 1000 ? n.toLocaleString() : String(n));
  const fmtGBP = (n: number) => `£${n.toFixed(2)}`;

  const reset = useCallback(() => {
    setStep(1);
    setEmail("");
    setCompany("");
    setRole("");
    setIngredients([]);
    setFrequency(null);
    setPerPersonMult(1.0);
    setTeamSize(50);
    setSubmitError("");
    setSubmitPending(false);
    setStep1Saving(false);
    setExistingUser(false);
    setLeadId(null);
    setStep4Ready(false);
  }, []);

  // Enable/disable the step-4 submit button with a one-frame delay
  useEffect(() => {
    if (step4RafRef.current !== null) {
      cancelAnimationFrame(step4RafRef.current);
      step4RafRef.current = null;
    }
    if (step !== 4) {
      setStep4Ready(false);
      return;
    }
    step4RafRef.current = requestAnimationFrame(() => {
      setStep4Ready(true);
      step4RafRef.current = null;
    });
    return () => {
      if (step4RafRef.current !== null) {
        cancelAnimationFrame(step4RafRef.current);
        step4RafRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    if (!open) return;
    reset();
    let startStep: Step = 1;
    if (prefill?.email) {
      setEmail(prefill.email);
      setCompany(prefill.company ?? "");
      setRole(prefill.role ?? "");
      if (prefill.leadId) setLeadId(prefill.leadId);
      if (prefill.email && prefill.company) startStep = 2;
    }
    if (preselectedIngredient) {
      setIngredients([preselectedIngredient]);
      if (startStep === 2) startStep = 3;
    }
    setStep(startStep);
  }, [open, reset, prefill, preselectedIngredient]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove("modal-open");
      return;
    }
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && step === 1) {
      queueMicrotask(() => emailRef.current?.focus());
    }
  }, [open, step]);

  function toggleIngredient(value: string) {
    setIngredients((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function validateStep(s: Step): boolean {
    if (s === 1) {
      if (!emailRef.current?.checkValidity()) {
        emailRef.current?.reportValidity();
        return false;
      }
      if (!company.trim()) {
        companyRef.current?.setCustomValidity("Please enter your company name");
        companyRef.current?.reportValidity();
        companyRef.current?.setCustomValidity("");
        return false;
      }
    }
    if (s === 2 && ingredients.length === 0) {
      setSubmitError("Choose at least one ingredient to continue.");
      return false;
    }
    if (s === 3 && !frequency) {
      setSubmitError("Choose a delivery frequency to continue.");
      return false;
    }
    return true;
  }

  async function handleStep1Continue() {
    setSubmitError("");
    setExistingUser(false);
    if (!validateStep(1)) return;
    setStep1Saving(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company: company.trim(),
          role: role.trim() || null,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { leadId?: string; existingUser?: boolean };
        if (json.existingUser) {
          setExistingUser(true);
          setStep1Saving(false);
          return;
        }
        if (json.leadId) setLeadId(json.leadId);
      }
    } catch {
      // Silent — don't block the user
    }
    setStep1Saving(false);
    setStep(ingredients.length > 0 ? 3 : 2);
  }

  function goNext() {
    setSubmitError("");
    if (!validateStep(step)) return;
    if (typeof step === "number" && step < MAX_STEP) {
      setStep((step + 1) as Step);
    }
  }

  function goBack() {
    setSubmitError("");
    if (typeof step === "number" && step > 1) {
      setStep((step - 1) as Step);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Hard guard: only submit when actually on step 4 AND the button has had
    // at least one animation frame to settle (prevents spurious double-click submit).
    if (step !== 4 || !step4Ready) return;

    setSubmitError("");
    if (!validateStep(4)) return;
    if (!plan.freq) {
      setSubmitError("Choose a delivery cadence (go back to step 3).");
      return;
    }

    const planData = {
      ingredients,
      frequency:               plan.freq,
      quantity_tier:           plan.tier,
      team_size:               plan.team,
      shots_per_drop:          plan.shotsPerDrop,
      bottles_per_drop:        plan.bottlesPerDrop,
      shots_per_month:         plan.shotsMonth,
      bottles_per_month:       plan.bottlesMonth,
      price_per_drop_ex_vat:   plan.pricePerDropExVat,
      price_per_month_ex_vat:  plan.pricePerMonthExVat,
      vat_per_month:           plan.vatPerMonth,
      total_per_month_inc_vat: plan.totalPerMonthIncVat,
    };

    setSubmitPending(true);
    try {
      if (loggedIn) {
        // ── Logged-in user: create a pending subscription ──────────────
        const res = await fetch("/api/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...planData, lead_id: leadId }),
        });
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          throw new Error(json.error ?? "Could not save your subscription.");
        }
      } else {
        // ── Anonymous user: store as a lead ──────────────────────────
        const leadPayload = {
          email:   email.trim(),
          company: company.trim(),
          role:    role.trim() || null,
          ...planData,
        };
        if (leadId) {
          const res = await fetch(`/api/lead/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(leadPayload),
          });
          if (!res.ok) {
            const json = await res.json() as { error?: string };
            throw new Error(json.error ?? "Could not save your quote.");
          }
        } else {
          const res = await fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(leadPayload),
          });
          if (!res.ok) {
            const json = await res.json() as { error?: string };
            throw new Error(json.error ?? "Could not save your quote.");
          }
        }
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setSubmitPending(false);
      return;
    }
    setSubmitPending(false);
    setStep("success");
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (!open) return null;

  const progressPct =
    step === "success" ? 100 : (Math.min(step as number, MAX_STEP) / MAX_STEP) * 100;
  const progressStep = step === "success" ? MAX_STEP : (step as number);

  const freqLabel = plan.freq ? FREQ_LABEL[plan.freq] || plan.freq : "—";
  const ingLabels = ingredients
    .map((k) => INGREDIENT_META[k]?.label)
    .filter(Boolean)
    .join(", ");

  const calcBlend =
    plan.labels.length === 0
      ? "Pick at least one ingredient on step 2."
      : `Blend: ${plan.labels.join(" · ")}`;

  const calcShotsDrop    = plan.labels.length === 0 ? "—" : fmt(plan.shotsPerDrop);
  const calcBottlesDrop  = plan.labels.length === 0 ? "—" : fmt(plan.bottlesPerDrop);
  const calcShotsMonth   = plan.labels.length === 0 ? "—" : plan.freq ? fmt(plan.shotsMonth)   : "Select cadence";
  const calcBottlesMonth = plan.labels.length === 0 ? "—" : plan.freq ? fmt(plan.bottlesMonth) : "Select cadence";

  const hasPricing        = plan.labels.length > 0 && plan.freq;
  const calcPricePerDrop  = hasPricing ? fmtGBP(plan.pricePerDropExVat)  : plan.labels.length === 0 ? "—" : "Select cadence";
  const calcPricePerMonth = hasPricing ? fmtGBP(plan.pricePerMonthExVat) : plan.labels.length === 0 ? "—" : "Select cadence";
  const calcVAT           = hasPricing ? fmtGBP(plan.vatPerMonth)         : "—";
  const calcTotal         = hasPricing ? fmtGBP(plan.totalPerMonthIncVat) : "—";

  const baselineShotsPerDrop    = plan.shotsPerDrop / perPersonMult;
  const recommendedAtStandard   = Math.round(baselineShotsPerDrop);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="funnel-title"
    >
      <button
        type="button"
        className="modal__backdrop"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={handleClose}
      />
      <div
        className={`modal__panel ${step === 4 ? "modal__panel--wide" : ""}`}
      >
        <button
          type="button"
          className="modal__close"
          onClick={handleClose}
          aria-label="Close"
        >
          &times;
        </button>
        <div className="funnel" data-step={step}>
          <div className="funnel__header">
            <p className="funnel__step-label">
              {step === "success" ? "Complete" : `Step ${step} of ${MAX_STEP}`}
            </p>
            <h2 id="funnel-title" className="funnel__title">
              {step === "success" ? "You're on the list" : FUNNEL_TITLES[step as number]}
            </h2>
            <div
              className="funnel__progress"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={MAX_STEP}
              aria-valuenow={progressStep}
            >
              <div
                className="funnel__progress-bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <form className="funnel__form" onSubmit={handleSubmit} noValidate>
            {step === 1 && (
              <div className="funnel__pane">
                <label className="field">
                  <span className="field__label">Work email</span>
                  <input
                    ref={emailRef}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setLeadId(null);
                    }}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Company name</span>
                  <input
                    ref={companyRef}
                    type="text"
                    required
                    autoComplete="organization"
                    placeholder="Acme Inc."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Your role (optional)</span>
                  <input
                    type="text"
                    autoComplete="organization-title"
                    placeholder="People Ops, HRBP…"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </label>
                {existingUser && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 8,
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#fef3c7",
                      border: "1px solid #fcd34d",
                      color: "#92400e",
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                    }}
                  >
                    You already have an account —{" "}
                    <a
                      href="/auth/login"
                      style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}
                    >
                      sign in to continue your subscription
                    </a>
                    .
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <fieldset className="field field--fieldset">
                <legend className="field__label">What's in each drop?</legend>
                <p className="field__hint field__hint--tight">
                  Select one or more — prices shown per unit ex. VAT.
                </p>
                <div className="ingredient-grid">
                  {INGREDIENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="ingredient">
                      <input
                        type="checkbox"
                        checked={ingredients.includes(opt.value)}
                        onChange={() => toggleIngredient(opt.value)}
                      />
                      <span className="ingredient__card">
                        <span className="ingredient__name">{opt.name}</span>
                        <span className="ingredient__meta">{opt.meta}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <fieldset className="field field--fieldset">
                <legend className="field__label">How often should we deliver?</legend>
                <div className="choice-grid">
                  {(
                    [
                      ["weekly",   "Weekly"],
                      ["biweekly", "Every 2 weeks"],
                      ["monthly",  "Monthly"],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="choice">
                      <input
                        type="radio"
                        name="frequency"
                        checked={frequency === val}
                        onChange={() => setFrequency(val)}
                      />
                      <span className="choice__card">{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 4 && (
              <div className="funnel__pane">
                <div className="funnel__split">
                  <div className="funnel__controls">

                    <label className="field">
                      <span className="field__label">
                        How many people are receiving deliveries?
                      </span>
                      <div className="funnel__team-row">
                        <input
                          type="range"
                          min={5}
                          max={500}
                          step={5}
                          value={teamSize}
                          onChange={(e) => setTeamSize(parseInt(e.target.value, 10))}
                        />
                        <span className="funnel__team-count">
                          <strong>{teamSize}</strong> people
                        </span>
                      </div>
                    </label>

                    {ingredients.length > 0 && (
                      <div className="funnel__recommend">
                        <span className="funnel__recommend-icon" aria-hidden="true">→</span>
                        <p>
                          At standard (×1.0): <strong>{recommendedAtStandard} shot{recommendedAtStandard !== 1 ? "s" : ""}</strong> per drop for {teamSize} {teamSize === 1 ? "person" : "people"}.
                          Adjust below if you want to go lighter or stock the fridge.
                        </p>
                      </div>
                    )}

                    <fieldset className="field field--fieldset">
                      <legend className="field__label">Quantity per person, per delivery</legend>
                      <div className="mult-grid">
                        {MULT_STEPS.map((m) => {
                          const meta = MULT_META[m];
                          return (
                            <button
                              key={m}
                              type="button"
                              className={`mult-btn${perPersonMult === m ? " mult-btn--active" : ""}`}
                              onClick={() => setPerPersonMult(m)}
                              aria-pressed={perPersonMult === m}
                            >
                              <span className="mult-btn__label">{meta.label}</span>
                              <span className="mult-btn__sub">{meta.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                  </div>
                  <aside className="calc" aria-live="polite">
                    <h3 className="calc__title">Delivery calculator</h3>
                    <p className="calc__blend">{calcBlend}</p>
                    <dl className="calc__stats">
                      <div className="calc__row">
                        <dt>100ml shots per drop</dt>
                        <dd>{calcShotsDrop}</dd>
                      </div>
                      <div className="calc__row">
                        <dt>1L share bottles per drop</dt>
                        <dd>{calcBottlesDrop}</dd>
                      </div>
                      <div className="calc__row calc__row--emph">
                        <dt>100ml shots / month</dt>
                        <dd>{calcShotsMonth}</dd>
                      </div>
                      <div className="calc__row calc__row--emph">
                        <dt>1L share bottles / month</dt>
                        <dd>{calcBottlesMonth}</dd>
                      </div>
                      <div className="calc__row calc__row--section">
                        <dt>Per drop (ex. VAT)</dt>
                        <dd>{calcPricePerDrop}</dd>
                      </div>
                      <div className="calc__row">
                        <dt>Monthly (ex. VAT)</dt>
                        <dd>{calcPricePerMonth}</dd>
                      </div>
                      <div className="calc__row">
                        <dt>VAT (20%)</dt>
                        <dd>{calcVAT}</dd>
                      </div>
                      <div className="calc__row calc__row--total">
                        <dt>Total / month</dt>
                        <dd>{calcTotal}</dd>
                      </div>
                    </dl>
                    <p className="calc__note">
                      Illustrative only. Final counts confirmed before your first ship date.
                    </p>
                  </aside>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="funnel__pane funnel__success">
                <p className="funnel__success-icon" aria-hidden />
                <h3 className="funnel__success-title">
                  {loggedIn ? "Subscription requested" : "Thanks — we'll be in touch"}
                </h3>
                <p className="funnel__success-copy">
                  {loggedIn
                    ? "Your subscription is pending confirmation. You can view and manage it from your dashboard."
                    : "Your quote has been saved and emailed to you. Create an account to manage and confirm your subscription."}
                </p>
                <div className="funnel__recap">
                  <p className="funnel__recap-title">Your plan (summary)</p>
                  <ul className="funnel__recap-list">
                    <li><strong>Mix:</strong> {ingLabels || "—"}</li>
                    <li><strong>Deliveries:</strong> {freqLabel}</li>
                    <li>
                      <strong>Team:</strong> {plan.team} people ·{" "}
                      <strong>Quantity:</strong> ×{perPersonMult} per person
                    </li>
                    <li>
                      <strong>Est. per drop:</strong>{" "}
                      {plan.shotsPerDrop} × 100ml shots,{" "}
                      {plan.bottlesPerDrop} × 1L bottles
                    </li>
                    <li>
                      <strong>Monthly (inc. VAT):</strong>{" "}
                      {plan.totalPerMonthIncVat > 0 ? fmtGBP(plan.totalPerMonthIncVat) : "—"}
                    </li>
                  </ul>
                </div>
                {loggedIn ? (
                  <a href="/dashboard/subscriptions" className="btn btn--primary">
                    View subscription
                  </a>
                ) : (
                  <a href="/auth/login" className="btn btn--primary">
                    Complete account sign up
                  </a>
                )}
              </div>
            )}

            {submitError && (
              <p className="funnel__error" role="alert">{submitError}</p>
            )}

            {step !== "success" && (
              <div className="funnel__nav">
                <button
                  type="button"
                  className="btn btn--ghost funnel__nav-back"
                  hidden={step === 1}
                  onClick={goBack}
                >
                  Back
                </button>
                {step < MAX_STEP ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={step === 1 && step1Saving}
                    onClick={step === 1 ? handleStep1Continue : goNext}
                  >
                    {step === 1 && step1Saving ? "Saving…" : "Continue"}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={submitPending || !step4Ready}
                  >
                    {submitPending ? "Saving…" : "Submit"}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
