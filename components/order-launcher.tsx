"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { type AddressRow, addressOneLiner } from "@/lib/address";
import {
  PRODUCTS,
  PRODUCT_BY_SLUG,
  FORMAT_META,
  computeSubscriptionPrice,
  computeOneOffPrice,
  type Format,
} from "@/lib/products";
import { FREQ_LABEL } from "@/lib/funnel-logic";
import type { Frequency } from "@/lib/funnel-logic";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// ── Standalone embedded checkout panel (used by dashboard/checkout/page.tsx) ─

export function EmbeddedCheckoutPanel({
  clientSecret,
  onBack,
}: {
  clientSecret: string;
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ marginBottom: "1rem" }}
          onClick={onBack}
        >
          ← Back
        </button>
      )}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderType = "subscription" | "one_off";

type OLStep =
  | "type"
  | "products"
  | "sub-plan"
  | "off-date"
  | "address"
  | "review"
  | "identity"
  | "payment";

export interface LineItem {
  productSlug: string;
  format: Format;
  quantity: number;
}

interface LookupAddr {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  display: string;
}

interface BasketEntry {
  id: string;
  mode: "subscription" | "one_off";
  lineItems: LineItem[];
  frequency?: Frequency;
  preferredDay?: string;
  deliveryDate?: string;
  deliveryNotes?: string;
  addressId?: string;
  newAddress?: {
    line1: string; line2?: string; city: string; postcode: string;
    label?: string; saveToAccount?: boolean;
  };
  pricing: { totalPerMonthIncVat?: number; totalIncVat?: number };
  createdAt: string;
}

interface PendingSubRow {
  id: string;
  product_slug: string;
  frequency: string;
  total_per_month_inc_vat: number;
  status: string;
}

const MIN_QTY: Record<Format, number> = { shot: 20, share: 2 };

const FREQ_OPTIONS: { value: Frequency; label: string; sub: string }[] = [
  { value: "weekly",   label: "Weekly",        sub: "Delivered every week" },
  { value: "biweekly", label: "Every 2 weeks", sub: "Delivered fortnightly" },
  { value: "monthly",  label: "Monthly",       sub: "Once a month" },
];

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

const NEW_ADDR_KEY = "__new__";

// ── Helpers ───────────────────────────────────────────────────────────────────

function minDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split("T")[0];
}

function totalLineItemsCount(items: LineItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function sumSubPricePreview(items: LineItem[], freq: Frequency): number {
  if (!items.length) return 0;
  return items.reduce((acc, i) => {
    return acc + computeSubscriptionPrice(i.format, i.quantity, freq).totalPerMonthIncVat;
  }, 0);
}

function sumOneOffPricePreview(items: LineItem[]): number {
  if (!items.length) return 0;
  return items.reduce((acc, i) => {
    return acc + computeOneOffPrice(i.format, i.quantity).totalIncVat;
  }, 0);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OrderLauncherProps {
  open: boolean;
  onClose: () => void;
  preselectedType?: OrderType;
  preselectedProductSlug?: string;
  loggedIn: boolean;
  userEmail?: string;
  userCompany?: string;
  /**
   * When provided (e.g. from the /dashboard/checkout page), called with the
   * Stripe clientSecret instead of writing to sessionStorage and pushing to
   * /dashboard/checkout. This avoids the same-URL no-op navigation bug where
   * router.push() on the current route does not remount the component.
   */
  onClientSecret?: (secret: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderLauncher({
  open,
  onClose,
  preselectedType,
  preselectedProductSlug,
  loggedIn,
  userEmail = "",
  userCompany = "",
  onClientSecret,
}: OrderLauncherProps) {
  const router = useRouter();

  // Journey
  const [step, setStep]           = useState<OLStep>("type");
  const [orderType, setOrderType] = useState<OrderType | null>(null);

  // Multi-product cart
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Subscription plan
  const [frequency,    setFrequency]    = useState<Frequency>("monthly");
  const [preferredDay, setPreferredDay] = useState<string>("Mon");

  // One-off
  const [deliveryDate, setDeliveryDate] = useState(minDateISO());

  // Address
  const [savedAddrs,     setSavedAddrs]     = useState<AddressRow[]>([]);
  const [loadingAddrs,   setLoadingAddrs]   = useState(false);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showNewAddrForm, setShowNewAddrForm] = useState(false);

  // Postcode lookup
  const [lookupPostcode,   setLookupPostcode]   = useState("");
  const [lookupResults,    setLookupResults]    = useState<LookupAddr[]>([]);
  const [lookupLoading,    setLookupLoading]    = useState(false);
  const [lookupError,      setLookupError]      = useState("");
  const [lookupOpen,       setLookupOpen]       = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  // New address form fields
  const [newLine1,  setNewLine1]  = useState("");
  const [newLine2,  setNewLine2]  = useState("");
  const [newCity,   setNewCity]   = useState("");
  const [newPost,   setNewPost]   = useState("");
  const [newLabel,  setNewLabel]  = useState("");
  const [saveAddr,  setSaveAddr]  = useState(true);
  const [notes,     setNotes]     = useState("");

  // Pending subscriptions (shown on review step)
  const [pendingSubs, setPendingSubs] = useState<PendingSubRow[]>([]);

  // Identity (anonymous users)
  const [anonEmail,   setAnonEmail]   = useState(userEmail);
  const [anonCompany, setAnonCompany] = useState(userCompany);
  const [anonRole,    setAnonRole]    = useState("");

  // Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // UI
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState("");

  // ── Reset ────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    const initStep: OLStep = preselectedType ? "products" : "type";
    setStep(initStep);
    setOrderType(preselectedType ?? null);

    if (preselectedProductSlug) {
      const p = PRODUCT_BY_SLUG[preselectedProductSlug];
      if (p) {
        setLineItems([{ productSlug: p.slug, format: "shot", quantity: MIN_QTY.shot }]);
      } else {
        setLineItems([]);
      }
    } else {
      setLineItems([]);
    }

    setFrequency("monthly");
    setPreferredDay("Mon");
    setDeliveryDate(minDateISO());
    setSavedAddrs([]);
    setLoadingAddrs(false);
    setSelectedAddrId(null);
    setShowNewAddrForm(false);
    setLookupPostcode("");
    setLookupResults([]);
    setLookupLoading(false);
    setLookupError("");
    setLookupOpen(false);
    setAddressConfirmed(false);
    setNewLine1(""); setNewLine2(""); setNewCity(""); setNewPost("");
    setNewLabel(""); setSaveAddr(true); setNotes("");
    setPendingSubs([]);
    setAnonEmail(userEmail);
    setAnonCompany(userCompany);
    setAnonRole("");
    setClientSecret(null);
    setError("");
    setLoading(false);
    setToast("");
  }, [preselectedType, preselectedProductSlug, userEmail, userCompany]);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Scroll lock
  useEffect(() => {
    if (!open) { document.body.classList.remove("modal-open"); return; }
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  // Load saved addresses when reaching address step
  useEffect(() => {
    if (!open || !loggedIn || step !== "address") return;
    setLoadingAddrs(true);
    fetch("/api/address?type=delivery")
      .then((r) => r.json())
      .then((d: { addresses?: AddressRow[] }) => {
        const addrs = d.addresses ?? [];
        setSavedAddrs(addrs);
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.is_default) ?? addrs[0];
          setSelectedAddrId(def.id);
          setShowNewAddrForm(false);
        } else {
          setSelectedAddrId(null);
          setShowNewAddrForm(true);
        }
      })
      .catch(() => { setShowNewAddrForm(true); })
      .finally(() => setLoadingAddrs(false));
  }, [open, loggedIn, step]);

  // Load pending subscriptions on review step
  useEffect(() => {
    if (!open || !loggedIn || step !== "review" || orderType !== "subscription") return;
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d: { subscriptions?: PendingSubRow[] }) => {
        const pending = (d.subscriptions ?? []).filter((s) => s.status === "pending");
        setPendingSubs(pending);
      })
      .catch(() => {});
  }, [open, loggedIn, step, orderType]);

  // Debounce postcode lookup — fires 600ms after user stops typing (min 5 chars)
  const lookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const pc = lookupPostcode.replace(/\s/g, "");
    if (pc.length < 5) return; // UK postcodes are 5–7 chars without space
    if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
    lookupDebounceRef.current = setTimeout(() => {
      handlePostcodeLookup();
    }, 600);
    return () => {
      if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupPostcode]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function handleClose() { reset(); onClose(); }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Line item management ──────────────────────────────────────────────────────

  function addProduct(slug: string) {
    setLineItems((prev) => {
      if (prev.find((i) => i.productSlug === slug)) return prev;
      return [...prev, { productSlug: slug, format: "shot", quantity: MIN_QTY.shot }];
    });
  }

  function removeProduct(slug: string) {
    setLineItems((prev) => prev.filter((i) => i.productSlug !== slug));
  }

  function setItemFormat(slug: string, fmt: Format) {
    setLineItems((prev) =>
      prev.map((i) =>
        i.productSlug === slug
          ? { ...i, format: fmt, quantity: Math.max(MIN_QTY[fmt], i.quantity) }
          : i
      )
    );
  }

  function setItemQty(slug: string, qty: number) {
    setLineItems((prev) =>
      prev.map((i) => {
        if (i.productSlug !== slug) return i;
        const min = MIN_QTY[i.format];
        return { ...i, quantity: Math.max(min, qty) };
      })
    );
  }

  function incrementQty(slug: string, delta: number) {
    setLineItems((prev) =>
      prev.map((i) => {
        if (i.productSlug !== slug) return i;
        const min = MIN_QTY[i.format];
        const step = i.format === "shot" ? 5 : 1;
        return { ...i, quantity: Math.max(min, i.quantity + step * Math.sign(delta)) };
      })
    );
  }

  // ── Address helpers ───────────────────────────────────────────────────────────

  async function handlePostcodeLookup() {
    const pc = lookupPostcode.trim();
    if (!pc) { setLookupError("Enter a postcode to search."); return; }
    setLookupLoading(true);
    setLookupError("");
    setLookupResults([]);
    setLookupOpen(false);
    try {
      const res = await fetch(`/api/address/lookup?postcode=${encodeURIComponent(pc)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      const results: LookupAddr[] = json.addresses ?? [];
      if (results.length === 0) {
        setLookupError("No addresses found for this postcode.");
      } else {
        setLookupResults(results);
        setLookupOpen(true);
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Address lookup failed.");
    } finally {
      setLookupLoading(false);
    }
  }

  function applyLookupResult(addr: LookupAddr) {
    setNewLine1(addr.line1);
    setNewLine2(addr.line2 || "");
    setNewCity(addr.city);
    setNewPost(addr.postcode);
    setLookupOpen(false);
    setAddressConfirmed(true);
  }

  function validateAddress(): { ok: boolean; err?: string } {
    if (selectedAddrId && selectedAddrId !== NEW_ADDR_KEY) return { ok: true };
    if (!newLine1.trim()) return { ok: false, err: "Enter address line 1." };
    if (!newCity.trim())  return { ok: false, err: "Enter a city." };
    if (!newPost.trim())  return { ok: false, err: "Enter a postcode." };
    return { ok: true };
  }

  function buildAddressPayload() {
    if (selectedAddrId && selectedAddrId !== NEW_ADDR_KEY) {
      return { addressId: selectedAddrId };
    }
    return {
      newAddress: {
        line1:         newLine1.trim(),
        line2:         newLine2.trim() || undefined,
        city:          newCity.trim(),
        postcode:      newPost.trim(),
        label:         newLabel.trim() || undefined,
        saveToAccount: loggedIn ? saveAddr : false,
      },
    };
  }

  function resolvedAddrLine(): string {
    if (selectedAddrId && selectedAddrId !== NEW_ADDR_KEY) {
      const a = savedAddrs.find((x) => x.id === selectedAddrId);
      return a ? addressOneLiner(a) : "—";
    }
    return [newLine1, newCity, newPost].filter(Boolean).join(", ") || "—";
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  function goBack() {
    setError("");
    const back: Partial<Record<OLStep, OLStep>> = {
      "products":  "type",
      "sub-plan":  "products",
      "off-date":  "products",
      "address":   orderType === "subscription" ? "sub-plan" : "off-date",
      "review":    "address",
      "identity":  "review",
    };
    const prev = back[step];
    if (prev) setStep(prev);
  }

  function advance() {
    setError("");

    if (step === "type") {
      if (!orderType) { setError("Choose an order type to continue."); return; }
      setStep("products"); return;
    }

    if (step === "products") {
      if (lineItems.length === 0) { setError("Add at least one product to continue."); return; }
      const invalid = lineItems.find((i) => i.quantity < MIN_QTY[i.format]);
      if (invalid) {
        const p = PRODUCT_BY_SLUG[invalid.productSlug];
        const min = MIN_QTY[invalid.format];
        setError(`${p?.name ?? invalid.productSlug}: minimum ${min} ${invalid.format === "shot" ? "shots" : "bottles"}.`);
        return;
      }
      setStep(orderType === "subscription" ? "sub-plan" : "off-date"); return;
    }

    if (step === "sub-plan") {
      if (!frequency) { setError("Choose a delivery frequency."); return; }
      setStep("address"); return;
    }

    if (step === "off-date") {
      if (!deliveryDate) { setError("Choose a delivery date."); return; }
      setStep("address"); return;
    }

    if (step === "address") {
      const v = validateAddress();
      if (!v.ok) { setError(v.err!); return; }
      setStep("review"); return;
    }

    if (step === "review") {
      // "Continue" on review step = Pay now
      if (!loggedIn) { setStep("identity"); return; }
      handlePayNow(); return;
    }

    if (step === "identity") {
      handleIdentitySubmit(); return;
    }
  }

  // ── Payment / save / basket actions ──────────────────────────────────────────

  async function handlePayNow() {
    setLoading(true);
    setError("");
    try {
      const body = buildCheckoutBody();
      const res  = await fetch("/api/checkout/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start checkout.");

      if (onClientSecret) {
        // Already on the checkout page — hand the secret back directly so the
        // page can render the Stripe embed without any navigation. Using
        // router.push("/dashboard/checkout") here would be a same-URL no-op
        // and the page's useEffect would never re-run to read sessionStorage.
        handleClose();
        onClientSecret(json.clientSecret);
      } else {
        // Coming from another page (e.g. /dashboard/juice-types) — store in
        // sessionStorage and navigate; the checkout page will pick it up on mount.
        sessionStorage.setItem("ol_client_secret", json.clientSecret);
        sessionStorage.setItem("ol_order_type", orderType!);
        handleClose();
        router.push("/dashboard/checkout");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveForLater() {
    setLoading(true);
    setError("");
    try {
      const body = { ...buildCheckoutBody(), saveDraft: true };
      const res  = await fetch("/api/checkout/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save.");
      showToast("Saved! You can activate it from your dashboard.");
      setTimeout(() => { handleClose(); router.push("/dashboard/subscriptions"); }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleAddToBasket() {
    const entry: BasketEntry = {
      id: crypto.randomUUID(),
      mode: orderType as "subscription" | "one_off",
      lineItems,
      ...(orderType === "subscription"
        ? { frequency: frequency!, preferredDay }
        : { deliveryDate }),
      deliveryNotes: notes.trim() || undefined,
      ...buildAddressPayload(),
      pricing:
        orderType === "subscription"
          ? { totalPerMonthIncVat: parseFloat(sumSubPricePreview(lineItems, frequency).toFixed(2)) }
          : { totalIncVat: parseFloat(sumOneOffPricePreview(lineItems).toFixed(2)) },
      createdAt: new Date().toISOString(),
    } as BasketEntry;

    try {
      const existing: BasketEntry[] = JSON.parse(localStorage.getItem("ol_basket") ?? "[]");
      existing.push(entry);
      localStorage.setItem("ol_basket", JSON.stringify(existing));
    } catch { /* storage unavailable */ }

    showToast("Added to basket.");
    setTimeout(() => handleClose(), 1800);
  }

  function buildCheckoutBody() {
    const base: Record<string, unknown> = {
      mode:      orderType,
      lineItems,
      deliveryNotes: notes.trim() || undefined,
      ...buildAddressPayload(),
    };
    if (orderType === "subscription") {
      base.frequency    = frequency;
      base.preferredDay = preferredDay;
    } else {
      base.deliveryDate = deliveryDate;
    }
    return base;
  }

  // ── Anonymous identity ────────────────────────────────────────────────────────

  async function handleIdentitySubmit() {
    if (!anonEmail.trim())   { setError("Enter your work email."); return; }
    if (!anonCompany.trim()) { setError("Enter your company name."); return; }
    setLoading(true);
    setError("");

    try {
      localStorage.setItem("ol_pending_plan", JSON.stringify({
        orderType, lineItems, frequency, preferredDay, deliveryDate, notes,
      }));
    } catch { /* storage unavailable */ }

    try {
      await fetch("/api/lead", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:   anonEmail.trim(),
          company: anonCompany.trim(),
          role:    anonRole.trim() || null,
        }),
      });
    } catch { /* best-effort */ }

    setLoading(false);
    handleClose();
    router.push("/auth/login?next=/dashboard/checkout");
  }

  // ── Layout helpers ────────────────────────────────────────────────────────────

  const wideSteps: OLStep[] = ["products", "sub-plan", "review"];
  const isWide = wideSteps.includes(step);

  const STEP_TITLES: Record<OLStep, string> = {
    "type":     "How would you like to order?",
    "products": "Choose your juice",
    "sub-plan": "Set up your subscription",
    "off-date": "When should we deliver?",
    "address":  "Delivery address",
    "review":   orderType === "subscription" ? "Review your subscription" : "Review your order",
    "identity": "Create your account",
    "payment":  "Complete payment",
  };

  const subSteps: OLStep[] = loggedIn
    ? ["type", "products", "sub-plan", "address", "review"]
    : ["type", "products", "sub-plan", "address", "review", "identity"];
  const offSteps: OLStep[] = loggedIn
    ? ["type", "products", "off-date", "address", "review"]
    : ["type", "products", "off-date", "address", "review", "identity"];
  const activeSteps = orderType === "subscription" ? subSteps
                    : orderType === "one_off"       ? offSteps
                    : (["type"] as OLStep[]);
  const stepIdx    = (activeSteps as string[]).indexOf(step);
  const progressPct = step === "payment" ? 100
    : stepIdx >= 0 ? ((stepIdx + 1) / activeSteps.length) * 100
    : (1 / 5) * 100;

  // Subscription pricing preview (summed across all line items)
  const subTotalPerMonth = sumSubPricePreview(lineItems, frequency);
  const oneOffTotal      = sumOneOffPricePreview(lineItems);

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ol-title">
      <button
        type="button"
        className="modal__backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={handleClose}
      />
      <div className={`modal__panel${isWide ? " modal__panel--wide" : ""}`}>
        <button type="button" className="modal__close" onClick={handleClose} aria-label="Close">
          &times;
        </button>

        {/* ── Payment step: full-bleed Stripe embed ── */}
        {step === "payment" && clientSecret && (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}

        {/* ── All other steps ── */}
        {step !== "payment" && (
          <div className="funnel">
            <div className="funnel__header">
              <p className="funnel__step-label">
                {orderType === "subscription" ? "Subscription"
                  : orderType === "one_off"   ? "One-off order"
                  : "New order"}
              </p>
              <h2 id="ol-title" className="funnel__title">{STEP_TITLES[step]}</h2>
              <div
                className="funnel__progress"
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="funnel__progress-bar" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="funnel__form">

              {/* ══════════════ STEP: type ══════════════ */}
              {step === "type" && (
                <div className="funnel__pane">
                  <div className="ol-type-grid">
                    {([
                      { type: "subscription" as OrderType, icon: "↻", label: "Subscribe", sub: "Recurring deliveries — weekly, fortnightly, or monthly." },
                      { type: "one_off"      as OrderType, icon: "→", label: "One-off order", sub: "A single delivery with no ongoing commitment." },
                    ] as const).map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        className={`ol-type-card${orderType === opt.type ? " ol-type-card--active" : ""}`}
                        onClick={() => setOrderType(opt.type)}
                        aria-pressed={orderType === opt.type}
                      >
                        <span className="ol-type-card__icon" aria-hidden="true">{opt.icon}</span>
                        <span className="ol-type-card__label">{opt.label}</span>
                        <span className="ol-type-card__sub">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════════════ STEP: products ══════════════ */}
              {step === "products" && (
                <div className="funnel__pane">
                  <ul className="ol-product-list">
                    {PRODUCTS.map((p) => {
                      const item = lineItems.find((i) => i.productSlug === p.slug);
                      const active = !!item;
                      return (
                        <li
                          key={p.slug}
                          className={`ol-product-row${active ? " ol-product-row--active" : ""}`}
                          style={{
                            "--ol-row-accent": p.accent,
                            "--ol-row-bg":     p.bg,
                          } as React.CSSProperties}
                        >
                          {/* Row head */}
                          <div className="ol-product-row__head">
                            <div
                              className="ol-product-row__bottle"
                              aria-hidden="true"
                              style={{
                                background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 35%, #fff) 0%, ${p.accent} 55%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                              }}
                            />
                            <div className="ol-product-row__meta">
                              <span className="ol-product-row__name">{p.name}</span>
                              <span className="ol-product-row__tagline">{p.tagline}</span>
                              <span className="ol-product-row__ingredients">
                                {p.ingredientsList.join(" · ")}
                              </span>
                            </div>

                            {!active ? (
                              <button
                                type="button"
                                className="ol-product-row__add"
                                onClick={() => addProduct(p.slug)}
                                aria-label={`Add ${p.name}`}
                              >
                                + Add
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ol-product-row__remove"
                                onClick={() => removeProduct(p.slug)}
                                aria-label={`Remove ${p.name}`}
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          {/* Controls (only when active) */}
                          {active && item && (
                            <div className="ol-product-row__controls">
                              {/* Format chips */}
                              <div className="ol-product-row__format-row">
                                {(["shot", "share"] as Format[]).map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    className={`ol-product-row__fmt-chip${item.format === f ? " ol-product-row__fmt-chip--active" : ""}`}
                                    onClick={() => setItemFormat(p.slug, f)}
                                  >
                                    {f === "shot" ? "100ml shot" : "1L bottle"}
                                    <span style={{ opacity: 0.6, marginLeft: "0.3em" }}>
                                      £{FORMAT_META[f].price.toFixed(2)}/{FORMAT_META[f].unitLabel}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              <div className="ol-product-row__sep" />

                              {/* Qty stepper */}
                              <div className="ol-product-row__qty-row">
                                <button
                                  type="button"
                                  className="ol-product-row__qty-btn"
                                  aria-label="Decrease"
                                  onClick={() => incrementQty(p.slug, -1)}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  className="ol-product-row__qty-input"
                                  min={MIN_QTY[item.format]}
                                  value={item.quantity}
                                  onChange={(e) => setItemQty(p.slug, parseInt(e.target.value) || MIN_QTY[item.format])}
                                />
                                <button
                                  type="button"
                                  className="ol-product-row__qty-btn"
                                  aria-label="Increase"
                                  onClick={() => incrementQty(p.slug, 1)}
                                >
                                  +
                                </button>
                                <span className="ol-product-row__qty-unit">
                                  {item.format === "shot" ? "shots" : "bottles"}
                                  &nbsp;
                                  <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>
                                    min {MIN_QTY[item.format]}
                                  </span>
                                </span>

                                {/* Per-item price preview */}
                                <span className="ol-product-row__line-price">
                                  {orderType === "subscription"
                                    ? `£${computeSubscriptionPrice(item.format, item.quantity, frequency).totalPerMonthIncVat.toFixed(2)}/mo`
                                    : `£${computeOneOffPrice(item.format, item.quantity).totalIncVat.toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Cart bar */}
                  {lineItems.length > 0 ? (
                    <div className="ol-cart-bar">
                      <span className="ol-cart-bar__label">
                        {lineItems.length} blend{lineItems.length !== 1 ? "s" : ""}
                        {" · "}
                        {totalLineItemsCount(lineItems)} units
                      </span>
                      <span className="ol-cart-bar__total">
                        {orderType === "subscription"
                          ? `£${subTotalPerMonth.toFixed(2)}/mo inc. VAT`
                          : `£${oneOffTotal.toFixed(2)} inc. VAT`}
                      </span>
                    </div>
                  ) : (
                    <div className="ol-cart-bar">
                      <span className="ol-cart-bar__empty">
                        Add at least one blend to continue
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════ STEP: sub-plan ══════════════ */}
              {step === "sub-plan" && (
                <div className="funnel__pane ol-plan-layout">
                  <div className="ol-plan-form">
                    <fieldset className="field field--fieldset">
                      <legend className="field__label">Delivery frequency</legend>
                      <div className="ol-plan-grid">
                        {FREQ_OPTIONS.map((opt) => (
                          <button
                            key={String(opt.value)}
                            type="button"
                            className={`ol-plan-card${frequency === opt.value ? " ol-plan-card--active" : ""}`}
                            onClick={() => setFrequency(opt.value)}
                          >
                            <span className="ol-plan-card__label">{opt.label}</span>
                            <span className="ol-plan-card__sub">{opt.sub}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="field field--fieldset" style={{ marginTop: "1.5rem" }}>
                      <legend className="field__label">Preferred delivery day</legend>
                      <div className="ol-plan-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                        {DAY_OPTIONS.map((day) => (
                          <button
                            key={day}
                            type="button"
                            className={`ol-plan-card${preferredDay === day ? " ol-plan-card--active" : ""}`}
                            style={{ padding: "0.6rem 0.5rem" }}
                            onClick={() => setPreferredDay(day)}
                          >
                            <span className="ol-plan-card__label" style={{ fontSize: "0.9rem" }}>{day}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  {/* Price summary sidebar */}
                  {lineItems.length > 0 && (
                    <aside className="ol-plan-aside">
                      <p className="ol-plan-aside__title">Monthly estimate</p>
                      {lineItems.map((item) => {
                        const p = PRODUCT_BY_SLUG[item.productSlug];
                        const pr = computeSubscriptionPrice(item.format, item.quantity, frequency);
                        return (
                          <div key={item.productSlug} className="ol-plan-aside__row">
                            <span>{p?.name} ({item.quantity} {item.format === "shot" ? "shots" : "bottles"})</span>
                            <span>£{pr.totalPerMonthIncVat.toFixed(2)}</span>
                          </div>
                        );
                      })}
                      <div className="ol-plan-aside__total">
                        <span>Total / month</span>
                        <strong>£{subTotalPerMonth.toFixed(2)}</strong>
                      </div>
                      <p className="ol-plan-aside__note">Inc. 20% VAT · {FREQ_LABEL[frequency ?? "monthly"] ?? "Monthly"} delivery</p>
                    </aside>
                  )}
                </div>
              )}

              {/* ══════════════ STEP: off-date ══════════════ */}
              {step === "off-date" && (
                <div className="funnel__pane">
                  <div className="ol-off-date">
                    <label className="field">
                      <span className="field__label">Delivery date</span>
                      <p className="field__hint">Choose a date at least 3 days from today.</p>
                      <input
                        type="date"
                        value={deliveryDate}
                        min={minDateISO()}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </label>
                  </div>

                  {lineItems.length > 0 && (
                    <div className="ol-plan-aside" style={{ marginTop: "1.25rem" }}>
                      <p className="ol-plan-aside__title">Order summary</p>
                      {lineItems.map((item) => {
                        const p = PRODUCT_BY_SLUG[item.productSlug];
                        const pr = computeOneOffPrice(item.format, item.quantity);
                        return (
                          <div key={item.productSlug} className="ol-plan-aside__row">
                            <span>{p?.name} ({item.quantity} {item.format === "shot" ? "shots" : "bottles"})</span>
                            <span>£{pr.totalIncVat.toFixed(2)}</span>
                          </div>
                        );
                      })}
                      <div className="ol-plan-aside__total">
                        <span>Total</span>
                        <strong>£{oneOffTotal.toFixed(2)}</strong>
                      </div>
                      <p className="ol-plan-aside__note">Inc. 20% VAT · one-off delivery</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════ STEP: address ══════════════ */}
              {step === "address" && (
                <div className="funnel__pane">
                  {loadingAddrs ? (
                    <p className="field__hint">Loading saved addresses…</p>
                  ) : (
                    <>
                      {/* Saved address cards */}
                      {savedAddrs.length > 0 && (
                        <ul className="ol-addr-list">
                          {savedAddrs.map((a) => (
                            <li key={a.id}>
                              <button
                                type="button"
                                className={`ol-addr-card${selectedAddrId === a.id ? " ol-addr-card--selected" : ""}`}
                                onClick={() => { setSelectedAddrId(a.id); setShowNewAddrForm(false); }}
                              >
                                <span className="ol-addr-card__radio" aria-hidden="true" />
                                <span className="ol-addr-card__body">
                                  {a.label && <span className="ol-addr-card__label">{a.label}</span>}
                                  <span className="ol-addr-card__detail">
                                    {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ")}
                                  </span>
                                  {a.is_default && <span className="ol-addr-card__badge">Default</span>}
                                </span>
                              </button>
                            </li>
                          ))}

                          {/* Add new button */}
                          <li>
                            <button
                              type="button"
                              className={`ol-addr-new-btn${showNewAddrForm ? " ol-addr-new-btn--active" : ""}`}
                              onClick={() => {
                                setShowNewAddrForm(true);
                                setSelectedAddrId(NEW_ADDR_KEY);
                                setAddressConfirmed(false);
                              }}
                            >
                              + Add a new address
                            </button>
                          </li>
                        </ul>
                      )}

                      {/* New address form (shown if no saved addresses OR user chose to add new) */}
                      {(showNewAddrForm || savedAddrs.length === 0) && (
                        <div className="ol-addr-lookup">
                          {!addressConfirmed ? (
                            <>
                              {/* Postcode search */}
                              <div className="ol-addr-lookup__row">
                                <input
                                  type="text"
                                  className="ol-addr-lookup__input"
                                  placeholder="Start typing a postcode…"
                                  value={lookupPostcode}
                                  onChange={(e) => {
                                    setLookupPostcode(e.target.value);
                                    setLookupError("");
                                    setLookupOpen(false);
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePostcodeLookup(); } }}
                                />
                                <button
                                  type="button"
                                  className="ol-addr-lookup__btn"
                                  onClick={handlePostcodeLookup}
                                  disabled={lookupLoading}
                                >
                                  {lookupLoading ? "Searching…" : "Search"}
                                </button>
                              </div>

                              {lookupError && (
                                <p className="ol-addr-lookup__error">{lookupError}</p>
                              )}

                              {/* Results dropdown */}
                              {lookupOpen && lookupResults.length > 0 && (
                                <select
                                  className="ol-addr-select"
                                  size={Math.min(lookupResults.length + 1, 6)}
                                  onChange={(e) => {
                                    const idx = parseInt(e.target.value);
                                    if (!isNaN(idx)) applyLookupResult(lookupResults[idx]);
                                  }}
                                  defaultValue=""
                                >
                                  <option value="" disabled>Select your address…</option>
                                  {lookupResults.map((a, idx) => (
                                    <option key={idx} value={idx}>{a.display}</option>
                                  ))}
                                </select>
                              )}

                              {/* Manual fallback fields */}
                              <div className="ol-addr-lookup__fields">
                                <label className="addr-form__field addr-form__field--full">
                                  <span className="addr-form__label">Line 1 *</span>
                                  <input
                                    type="text"
                                    value={newLine1}
                                    placeholder="22 Tech Street, Floor 3"
                                    onChange={(e) => setNewLine1(e.target.value)}
                                  />
                                </label>
                                <label className="addr-form__field addr-form__field--full" style={{ marginTop: "0.5rem" }}>
                                  <span className="addr-form__label">Line 2 <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                                  <input
                                    type="text"
                                    value={newLine2}
                                    placeholder="Building, unit, floor"
                                    onChange={(e) => setNewLine2(e.target.value)}
                                  />
                                </label>
                                <div className="addr-new-form__grid" style={{ marginTop: "0.5rem" }}>
                                  <label className="addr-form__field">
                                    <span className="addr-form__label">City *</span>
                                    <input type="text" value={newCity} placeholder="London" onChange={(e) => setNewCity(e.target.value)} />
                                  </label>
                                  <label className="addr-form__field">
                                    <span className="addr-form__label">Postcode *</span>
                                    <input type="text" value={newPost} placeholder="EC1A 1BB" onChange={(e) => setNewPost(e.target.value)} />
                                  </label>
                                </div>
                                <label className="addr-form__field addr-form__field--full" style={{ marginTop: "0.5rem" }}>
                                  <span className="addr-form__label">Label <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                                  <input type="text" value={newLabel} placeholder="e.g. Main Office" onChange={(e) => setNewLabel(e.target.value)} />
                                </label>
                                {loggedIn && (
                                  <label className="addr-form__check" style={{ marginTop: "0.75rem" }}>
                                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} />
                                    <span>Save this address to my account</span>
                                  </label>
                                )}
                              </div>
                            </>
                          ) : (
                            /* Confirmed address display */
                            <div className="ol-addr-lookup__confirmed">
                              <div>
                                <strong>{newLine1}</strong>
                                {newLine2 && <div>{newLine2}</div>}
                                <div>{newCity}, {newPost}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddressConfirmed(false)}
                                style={{ fontSize: "0.8125rem", opacity: 0.65, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Delivery notes */}
                  <label className="field" style={{ marginTop: "1.25rem" }}>
                    <span className="field__label">
                      Delivery notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                    </span>
                    <textarea
                      rows={2}
                      value={notes}
                      placeholder="e.g. Leave with reception, buzz flat 4"
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {/* ══════════════ STEP: review ══════════════ */}
              {step === "review" && (
                <div className="funnel__pane">
                  {/* Pending subscription suggestion */}
                  {pendingSubs.length > 0 && (
                    <div className="ol-pending-banner">
                      <span className="ol-pending-banner__icon" aria-hidden="true">⚡</span>
                      <div className="ol-pending-banner__body">
                        <p className="ol-pending-banner__title">
                          You have {pendingSubs.length} pending subscription{pendingSubs.length > 1 ? "s" : ""}
                        </p>
                        <p className="ol-pending-banner__sub">
                          Pay for existing subscriptions before adding new ones.
                        </p>
                        <a className="ol-pending-banner__link" href="/dashboard/subscriptions">
                          View pending subscriptions →
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Order summary */}
                  <div className="ol-plan-aside" style={{ marginBottom: "1.25rem" }}>
                    <p className="ol-plan-aside__title">
                      {orderType === "subscription" ? "Subscription summary" : "Order summary"}
                    </p>
                    {lineItems.map((item) => {
                      const p = PRODUCT_BY_SLUG[item.productSlug];
                      return (
                        <div key={item.productSlug} className="ol-plan-aside__row">
                          <span>
                            {p?.name} — {item.quantity} {item.format === "shot" ? "shots" : "bottles"}
                            {" "}({FORMAT_META[item.format].label})
                          </span>
                          <span>
                            {orderType === "subscription"
                              ? `£${computeSubscriptionPrice(item.format, item.quantity, frequency).totalPerMonthIncVat.toFixed(2)}/mo`
                              : `£${computeOneOffPrice(item.format, item.quantity).totalIncVat.toFixed(2)}`}
                          </span>
                        </div>
                      );
                    })}
                    <div className="ol-plan-aside__total">
                      <span>{orderType === "subscription" ? "Total / month" : "Total"}</span>
                      <strong>
                        {orderType === "subscription"
                          ? `£${subTotalPerMonth.toFixed(2)}`
                          : `£${oneOffTotal.toFixed(2)}`}
                      </strong>
                    </div>
                    {orderType === "subscription" && (
                      <p className="ol-plan-aside__note">
                        Inc. 20% VAT · {FREQ_LABEL[frequency ?? "monthly"] ?? "Monthly"} · {preferredDay}s
                      </p>
                    )}
                    {orderType === "one_off" && deliveryDate && (
                      <p className="ol-plan-aside__note">
                        Inc. 20% VAT · Delivery: {new Date(deliveryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                    <div className="ol-plan-aside__row" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.5rem" }}>
                      <span style={{ opacity: 0.65 }}>Delivery to</span>
                      <span style={{ opacity: 0.65, textAlign: "right", maxWidth: "60%" }}>{resolvedAddrLine()}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {loggedIn ? (
                    <div className="ol-review-actions">
                      {orderType === "subscription" && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={handleSaveForLater}
                          disabled={loading}
                        >
                          Save for later
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={handleAddToBasket}
                        disabled={loading}
                      >
                        Add to basket
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handlePayNow}
                        disabled={loading}
                      >
                        {loading ? "Please wait…" : "Pay now →"}
                      </button>
                    </div>
                  ) : (
                    <p className="field__hint" style={{ textAlign: "center" }}>
                      <a href={`/auth/login?next=/dashboard`} style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                        Sign in
                      </a>{" "}
                      to save, basket, or pay — or click Continue to create an account.
                    </p>
                  )}

                  {toast && <div className="ol-toast">{toast}</div>}
                </div>
              )}

              {/* ══════════════ STEP: identity ══════════════ */}
              {step === "identity" && (
                <div className="funnel__pane">
                  <p className="field__hint" style={{ marginBottom: "1.25rem" }}>
                    Create a free account to complete your order and manage deliveries.
                  </p>
                  <label className="field">
                    <span className="field__label">Work email *</span>
                    <input
                      type="email"
                      value={anonEmail}
                      placeholder="you@company.com"
                      onChange={(e) => setAnonEmail(e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ marginTop: "0.75rem" }}>
                    <span className="field__label">Company name *</span>
                    <input
                      type="text"
                      value={anonCompany}
                      placeholder="Acme Ltd"
                      onChange={(e) => setAnonCompany(e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ marginTop: "0.75rem" }}>
                    <span className="field__label">Your role <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                    <input
                      type="text"
                      value={anonRole}
                      placeholder="e.g. Office Manager, HR Lead"
                      onChange={(e) => setAnonRole(e.target.value)}
                    />
                  </label>
                </div>
              )}

            </div>

            {/* ── Footer: error + navigation ── */}
            {error && (
              <p className="funnel__error" role="alert">{error}</p>
            )}

            <div className="funnel__footer">
              {step !== "type" && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={goBack}>
                  ← Back
                </button>
              )}
              {/* Don't show Continue on review step (logged in) — actions are inline */}
              {!(step === "review" && loggedIn) && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={advance}
                  disabled={loading}
                >
                  {loading ? "Please wait…"
                    : step === "identity" ? "Continue to sign up →"
                    : step === "review"   ? "Continue to sign up →"
                    : "Continue"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
