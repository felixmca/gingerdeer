"use client";

import { type AddressRow, addressOneLiner, addressBlock } from "@/lib/address";
import { useCallback, useEffect, useState } from "react";

const DRINKS = [
  { key: "allinone",           name: "All-in-one",           accent: "#c2410c", bg: "#fff7ed" },
  { key: "lemon_ginger_honey", name: "Lemon, Ginger, Honey", accent: "#ca8a04", bg: "#fefce8" },
  { key: "apple_ginger",       name: "Apple Ginger",          accent: "#3f6212", bg: "#f7fee7" },
  { key: "turmeric",           name: "Turmeric Boost",        accent: "#d97706", bg: "#fffbeb" },
] as const;

type DrinkKey = typeof DRINKS[number]["key"];

const FORMATS = [
  { key: "shot",  label: "100ml shots",      price: 3.50,  unit: "shot"   },
  { key: "share", label: "1L share bottles", price: 25.00, unit: "bottle" },
] as const;

type FormatKey = typeof FORMATS[number]["key"];

type ModalStep = 1 | 2 | 3 | "success";

const NEW_ADDR_KEY = "__new__";

export interface OneOffOrder {
  id: string;
  drink: DrinkKey;
  format: FormatKey;
  qty: number;
  deliveryDate: string;
  address: string;
  notes: string;
  status: "pending" | "confirmed" | "fulfilled" | "cancelled";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (order: OneOffOrder) => void;
}

function minDeliveryISO() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split("T")[0];
}

export function DbOneOffModal({ open, onClose, onComplete }: Props) {
  const [step, setStep]           = useState<ModalStep>(1);
  const [drink, setDrink]         = useState<DrinkKey | null>(null);
  const [format, setFormat]       = useState<FormatKey | null>(null);
  const [qty, setQty]             = useState(10);
  const [deliveryDate, setDeliveryDate] = useState(minDeliveryISO);
  const [notes, setNotes]         = useState("");
  const [error, setError]         = useState("");

  // Address state
  const [savedAddrs,      setSavedAddrs]      = useState<AddressRow[]>([]);
  const [loadingAddrs,    setLoadingAddrs]    = useState(false);
  const [selectedAddrId,  setSelectedAddrId]  = useState<string>(NEW_ADDR_KEY);
  const [newLine1,  setNewLine1]  = useState("");
  const [newLine2,  setNewLine2]  = useState("");
  const [newCity,   setNewCity]   = useState("");
  const [newPost,   setNewPost]   = useState("");
  const [newLabel,  setNewLabel]  = useState("");
  const [saveAddr,  setSaveAddr]  = useState(true);

  const reset = useCallback(() => {
    setStep(1);
    setDrink(null);
    setFormat(null);
    setQty(10);
    setDeliveryDate(minDeliveryISO());
    setNotes("");
    setError("");
    setSelectedAddrId(NEW_ADDR_KEY);
    setNewLine1(""); setNewLine2(""); setNewCity(""); setNewPost(""); setNewLabel("");
    setSaveAddr(true);
  }, []);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  // Load delivery addresses when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingAddrs(true);
    fetch("/api/address?type=delivery")
      .then((r) => r.json())
      .then((d: { addresses?: AddressRow[] }) => {
        const addrs = d.addresses ?? [];
        setSavedAddrs(addrs);
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.is_default) ?? addrs[0];
          setSelectedAddrId(def.id);
        } else {
          setSelectedAddrId(NEW_ADDR_KEY);
        }
      })
      .catch(() => setSelectedAddrId(NEW_ADDR_KEY))
      .finally(() => setLoadingAddrs(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function handleClose() { reset(); onClose(); }

  function goNext() {
    setError("");
    if (step === 1) {
      if (!drink)  { setError("Choose a drink to continue.");  return; }
      if (!format) { setError("Choose a format to continue."); return; }
    }
    if (step === 2) {
      if (qty < 1)       { setError("Quantity must be at least 1."); return; }
      if (!deliveryDate) { setError("Pick a delivery date.");        return; }
    }
    setStep((s) => (s as number) + 1 as ModalStep);
  }

  function goBack() {
    setError("");
    setStep((s) => (s as number) - 1 as ModalStep);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!drink || !format) return;

    let resolvedAddress = "";

    if (selectedAddrId === NEW_ADDR_KEY) {
      if (!newLine1.trim()) { setError("Enter an address line 1."); return; }
      if (!newCity.trim())  { setError("Enter a city.");            return; }
      if (!newPost.trim())  { setError("Enter a postcode.");        return; }
      resolvedAddress = [newLine1, newLine2, newCity, newPost].filter(Boolean).join(", ");
      // Save address for future use if requested
      if (saveAddr) {
        fetch("/api/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "delivery",
            label: newLabel.trim() || null,
            line1: newLine1.trim(),
            line2: newLine2.trim() || null,
            city:  newCity.trim(),
            postcode: newPost.trim(),
          }),
        }).catch(() => {});
      }
    } else {
      const addr = savedAddrs.find((a) => a.id === selectedAddrId);
      if (!addr) { setError("Select a delivery address."); return; }
      resolvedAddress = addressBlock(addr);
    }

    onComplete({
      id: crypto.randomUUID(),
      drink,
      format,
      qty,
      deliveryDate,
      address: resolvedAddress,
      notes: notes.trim(),
      status: "pending",
    });
    setStep("success");
  }

  if (!open) return null;

  const selectedDrink  = DRINKS.find((d) => d.key === drink);
  const selectedFormat = FORMATS.find((f) => f.key === format);
  const lineTotal      = selectedFormat ? selectedFormat.price * qty : 0;

  const STEP_TITLES: Record<ModalStep, string> = {
    1: "Choose your drink", 2: "Quantity & date", 3: "Delivery details", success: "Order placed",
  };

  const progressPct = step === "success" ? 100 : ((step as number) / 3) * 100;
  const isNewAddr   = selectedAddrId === NEW_ADDR_KEY;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="oneoff-title">
      <button type="button" className="modal__backdrop" aria-label="Close" tabIndex={-1} onClick={handleClose} />
      <div className="modal__panel">
        <button type="button" className="modal__close" onClick={handleClose} aria-label="Close">&times;</button>
        <div className="funnel">
          <div className="funnel__header">
            <p className="funnel__step-label">
              {step === "success" ? "Complete" : `Step ${step} of 3`}
            </p>
            <h2 id="oneoff-title" className="funnel__title">{STEP_TITLES[step]}</h2>
            <div className="funnel__progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step === "success" ? 3 : step as number}>
              <div className="funnel__progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <form className="funnel__form" onSubmit={handleSubmit} noValidate>

            {/* Step 1 */}
            {step === 1 && (
              <div className="funnel__pane">
                <fieldset className="field field--fieldset">
                  <legend className="field__label">Drink</legend>
                  <div className="oneoff-drink-grid">
                    {DRINKS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`oneoff-drink-card${drink === d.key ? " oneoff-drink-card--active" : ""}`}
                        style={{ background: d.bg, borderColor: drink === d.key ? d.accent : undefined }}
                        onClick={() => setDrink(d.key)}
                        aria-pressed={drink === d.key}
                      >
                        <div
                          className="oneoff-drink-bottle"
                          style={{
                            background: `linear-gradient(180deg, color-mix(in srgb, ${d.accent} 35%, #fff) 0%, ${d.accent} 55%, color-mix(in srgb, ${d.accent} 60%, #000) 100%)`,
                            boxShadow: `0 4px 10px color-mix(in srgb, ${d.accent} 25%, transparent)`,
                          }}
                        />
                        <span className="oneoff-drink-name" style={{ color: drink === d.key ? d.accent : undefined }}>
                          {d.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="field field--fieldset" style={{ marginTop: "1.25rem" }}>
                  <legend className="field__label">Format</legend>
                  <div className="choice-grid">
                    {FORMATS.map((f) => (
                      <label key={f.key} className="choice">
                        <input type="radio" name="oneoff_format" checked={format === f.key} onChange={() => setFormat(f.key)} />
                        <span className="choice__card">
                          {f.label}
                          <small>£{f.price.toFixed(2)} ex. VAT per {f.unit}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="funnel__pane">
                {selectedDrink && selectedFormat && (
                  <div className="oneoff-recap-pill" style={{ borderColor: `color-mix(in srgb, ${selectedDrink.accent} 30%, transparent)`, background: selectedDrink.bg }}>
                    <span style={{ color: selectedDrink.accent, fontWeight: 700 }}>{selectedDrink.name}</span>
                    <span className="oneoff-recap-sep">·</span>
                    <span>{selectedFormat.label}</span>
                    <span className="oneoff-recap-sep">·</span>
                    <span>£{selectedFormat.price.toFixed(2)} / {selectedFormat.unit}</span>
                  </div>
                )}

                <label className="field" style={{ marginTop: "1.25rem" }}>
                  <span className="field__label">Quantity</span>
                  <div className="oneoff-qty-row">
                    <button type="button" className="oneoff-qty-btn" onClick={() => setQty((q) => Math.max(1, q - (q > 20 ? 5 : 1)))} aria-label="Decrease">−</button>
                    <input type="number" className="oneoff-qty-input" min={1} max={9999} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
                    <button type="button" className="oneoff-qty-btn" onClick={() => setQty((q) => q + (q >= 20 ? 5 : 1))} aria-label="Increase">+</button>
                    {selectedFormat && <span className="oneoff-qty-unit">{selectedFormat.unit}{qty !== 1 ? "s" : ""}</span>}
                  </div>
                </label>

                {selectedFormat && (
                  <div className="oneoff-line-total">
                    <span>Subtotal (ex. VAT)</span>
                    <strong>£{lineTotal.toFixed(2)}</strong>
                  </div>
                )}

                <label className="field" style={{ marginTop: "1.25rem" }}>
                  <span className="field__label">Delivery date</span>
                  <p className="field__hint">Allow at least 3 business days from today.</p>
                  <input type="date" value={deliveryDate} min={minDeliveryISO()} onChange={(e) => setDeliveryDate(e.target.value)} />
                </label>
              </div>
            )}

            {/* Step 3 — Address selector */}
            {step === 3 && (
              <div className="funnel__pane">

                {/* Address picker */}
                <div className="field">
                  <span className="field__label">Delivery address</span>
                  {loadingAddrs ? (
                    <p className="field__hint">Loading saved addresses…</p>
                  ) : (
                    <>
                      {savedAddrs.length > 0 && (
                        <div className="addr-select-wrap">
                          <select
                            className="addr-select"
                            value={selectedAddrId}
                            onChange={(e) => setSelectedAddrId(e.target.value)}
                          >
                            {savedAddrs.map((a) => (
                              <option key={a.id} value={a.id}>
                                {addressOneLiner(a)}
                              </option>
                            ))}
                            <option disabled>──────────────</option>
                            <option value={NEW_ADDR_KEY}>Enter a new address…</option>
                          </select>
                        </div>
                      )}

                      {/* Inline form for new address */}
                      {isNewAddr && (
                        <div className={`addr-new-form${savedAddrs.length > 0 ? " addr-new-form--indent" : ""}`}>
                          {savedAddrs.length === 0 && (
                            <p className="addr-new-form__hint">No saved addresses yet. Enter one below.</p>
                          )}
                          <label className="addr-form__field addr-form__field--full">
                            <span className="addr-form__label">Line 1 <span className="addr-form__required">*</span></span>
                            <input type="text" value={newLine1} placeholder="22 Tech Street, Floor 3" onChange={(e) => setNewLine1(e.target.value)} />
                          </label>
                          <label className="addr-form__field addr-form__field--full" style={{ marginTop: "0.6rem" }}>
                            <span className="addr-form__label">Line 2 <span className="addr-form__optional">(optional)</span></span>
                            <input type="text" value={newLine2} placeholder="Building, unit, etc." onChange={(e) => setNewLine2(e.target.value)} />
                          </label>
                          <div className="addr-new-form__grid">
                            <label className="addr-form__field">
                              <span className="addr-form__label">City <span className="addr-form__required">*</span></span>
                              <input type="text" value={newCity} placeholder="London" onChange={(e) => setNewCity(e.target.value)} />
                            </label>
                            <label className="addr-form__field">
                              <span className="addr-form__label">Postcode <span className="addr-form__required">*</span></span>
                              <input type="text" value={newPost} placeholder="EC1A 1BB" onChange={(e) => setNewPost(e.target.value)} />
                            </label>
                          </div>
                          <label className="addr-form__field addr-form__field--full" style={{ marginTop: "0.6rem" }}>
                            <span className="addr-form__label">Label <span className="addr-form__optional">(optional)</span></span>
                            <input type="text" value={newLabel} placeholder="e.g. Main Office" onChange={(e) => setNewLabel(e.target.value)} />
                          </label>
                          <label className="addr-form__check" style={{ marginTop: "0.75rem" }}>
                            <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} />
                            <span>Save this address to my account</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <label className="field" style={{ marginTop: "1rem" }}>
                  <span className="field__label">Notes for delivery <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                  <textarea rows={2} placeholder="Leave with reception. Fridge on the left." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>

                {/* Order summary */}
                {selectedDrink && selectedFormat && (
                  <div className="oneoff-summary">
                    <p className="oneoff-summary__title">Order summary</p>
                    <dl className="oneoff-summary__dl">
                      <div><dt>Drink</dt><dd style={{ color: selectedDrink.accent }}>{selectedDrink.name}</dd></div>
                      <div><dt>Format</dt><dd>{selectedFormat.label}</dd></div>
                      <div><dt>Quantity</dt><dd>{qty} {selectedFormat.unit}{qty !== 1 ? "s" : ""}</dd></div>
                      <div><dt>Delivery date</dt><dd>{new Date(deliveryDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
                      <div className="oneoff-summary__total"><dt>Subtotal (ex. VAT)</dt><dd>£{lineTotal.toFixed(2)}</dd></div>
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* Success */}
            {step === "success" && (
              <div className="funnel__pane funnel__success">
                <p className="funnel__success-icon" aria-hidden />
                <h3 className="funnel__success-title">Order confirmed</h3>
                <p className="funnel__success-copy">
                  We've received your one-off order and will confirm it within 1 business day.
                </p>
                <button type="button" className="btn btn--primary" onClick={handleClose}>Done</button>
              </div>
            )}

            {error && <p className="funnel__error" role="alert">{error}</p>}

            {step !== "success" && (
              <div className="funnel__nav">
                <button type="button" className="btn btn--ghost funnel__nav-back" hidden={step === 1} onClick={goBack}>Back</button>
                {(step as number) < 3 ? (
                  <button type="button" className="btn btn--primary" onClick={goNext}>Continue</button>
                ) : (
                  <button type="submit" className="btn btn--primary">Place order</button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
