"use client";

import { type AddressRow, addressBlock, addressOneLiner } from "@/lib/address";
import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "account" | "addresses";

interface AddrForm {
  label: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  is_default: boolean;
}

const EMPTY_FORM: AddrForm = {
  label: "", line1: "", line2: "", city: "", postcode: "", country: "GB", is_default: false,
};

function formFromRow(r: AddressRow): AddrForm {
  return {
    label:      r.label      ?? "",
    line1:      r.line1,
    line2:      r.line2      ?? "",
    city:       r.city,
    postcode:   r.postcode,
    country:    r.country,
    is_default: r.is_default,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialDisplayName: string;
  email: string;
}

// ── Address section ───────────────────────────────────────────────────────────

interface AddrSectionProps {
  title: string;
  type: "billing" | "delivery";
  addresses: AddressRow[];
  editingId: string | null;
  addingType: "billing" | "delivery" | null;
  form: AddrForm;
  formSaving: boolean;
  formError: string;
  onStartAdd: (type: "billing" | "delivery") => void;
  onStartEdit: (a: AddressRow) => void;
  onFormChange: (f: AddrForm) => void;
  onFormSubmit: () => void;
  onFormCancel: () => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function AddrSection({
  title, type, addresses, editingId, addingType, form,
  formSaving, formError, onStartAdd, onStartEdit, onFormChange,
  onFormSubmit, onFormCancel, onDelete, onSetDefault,
}: AddrSectionProps) {
  const mine = addresses.filter((a) => a.type === type);
  const showForm = addingType === type || mine.some((a) => a.id === editingId);

  return (
    <div className="settings-section">
      <p className="settings-section__title">{title}</p>

      {mine.length === 0 && !showForm && (
        <div className="addr-empty">No {type} addresses saved yet.</div>
      )}

      <div className="addr-list">
        {mine.map((a) =>
          a.id === editingId ? (
            <div key={a.id} className="addr-form">
              <p className="addr-form__title">Edit address</p>
              <AddrFormFields form={form} onChange={onFormChange} />
              {formError && <p className="funnel__error" role="alert">{formError}</p>}
              <div className="addr-form__actions">
                <button type="button" className="btn btn--primary btn--sm" disabled={formSaving} onClick={onFormSubmit}>
                  {formSaving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onFormCancel}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="addr-card">
              <div className="addr-card__header">
                <span className="addr-card__label">{a.label || a.line1}</span>
                {a.is_default && <span className="addr-card__default">Default</span>}
              </div>
              <p className="addr-card__lines">{addressBlock(a)}</p>
              <div className="addr-card__actions">
                {!a.is_default && (
                  <button type="button" className="btn btn--ghost btn--xs" onClick={() => onSetDefault(a.id)}>
                    Set as default
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => onStartEdit(a)}>Edit</button>
                <button type="button" className="btn btn--ghost btn--xs addr-card__delete" onClick={() => onDelete(a.id)}>Delete</button>
              </div>
            </div>
          )
        )}

        {addingType === type && (
          <div className="addr-form">
            <p className="addr-form__title">New {type} address</p>
            <AddrFormFields form={form} onChange={onFormChange} />
            {formError && <p className="funnel__error" role="alert">{formError}</p>}
            <div className="addr-form__actions">
              <button type="button" className="btn btn--primary btn--sm" disabled={formSaving} onClick={onFormSubmit}>
                {formSaving ? "Saving…" : "Add address"}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onFormCancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {!showForm && (
        <button type="button" className="btn btn--ghost btn--sm addr-add-btn" onClick={() => onStartAdd(type)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Add {type} address
        </button>
      )}
    </div>
  );
}

// ── Shared address form fields ────────────────────────────────────────────────

function AddrFormFields({ form, onChange }: { form: AddrForm; onChange: (f: AddrForm) => void }) {
  function set(field: keyof AddrForm, value: string | boolean) {
    onChange({ ...form, [field]: value });
  }

  return (
    <div className="addr-form__fields">
      <label className="addr-form__field">
        <span className="addr-form__label">Label <span className="addr-form__optional">(optional)</span></span>
        <input type="text" value={form.label} placeholder="e.g. Main Office" onChange={(e) => set("label", e.target.value)} />
      </label>
      <label className="addr-form__field addr-form__field--full">
        <span className="addr-form__label">Address line 1 <span className="addr-form__required">*</span></span>
        <input type="text" value={form.line1} placeholder="22 Tech Street, Floor 3" onChange={(e) => set("line1", e.target.value)} />
      </label>
      <label className="addr-form__field addr-form__field--full">
        <span className="addr-form__label">Address line 2 <span className="addr-form__optional">(optional)</span></span>
        <input type="text" value={form.line2} placeholder="Building name, unit, etc." onChange={(e) => set("line2", e.target.value)} />
      </label>
      <div className="addr-form__row">
        <label className="addr-form__field">
          <span className="addr-form__label">City <span className="addr-form__required">*</span></span>
          <input type="text" value={form.city} placeholder="London" onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className="addr-form__field">
          <span className="addr-form__label">Postcode <span className="addr-form__required">*</span></span>
          <input type="text" value={form.postcode} placeholder="EC1A 1BB" onChange={(e) => set("postcode", e.target.value)} />
        </label>
      </div>
      <label className="addr-form__check">
        <input type="checkbox" checked={form.is_default} onChange={(e) => set("is_default", e.target.checked)} />
        <span>Set as default</span>
      </label>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DbSettingsPage({ initialDisplayName, email }: Props) {
  const [tab, setTab] = useState<Tab>("account");

  // Account tab
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [acctSaving, setAcctSaving] = useState(false);
  const [acctMsg, setAcctMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // Addresses tab
  const [addresses,    setAddresses]    = useState<AddressRow[]>([]);
  const [loadingAddrs, setLoadingAddrs] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [addingType,   setAddingType]   = useState<"billing" | "delivery" | null>(null);
  const [form,         setForm]         = useState<AddrForm>(EMPTY_FORM);
  const [formSaving,   setFormSaving]   = useState(false);
  const [formError,    setFormError]    = useState("");

  // Load addresses when Addresses tab first opens
  useEffect(() => {
    if (tab !== "addresses") return;
    setLoadingAddrs(true);
    fetch("/api/address")
      .then((r) => r.json())
      .then((d: { addresses?: AddressRow[] }) => setAddresses(d.addresses ?? []))
      .catch(() => {})
      .finally(() => setLoadingAddrs(false));
  }, [tab]);

  // ── Account handlers ──────────────────────────────────────────────────────

  async function saveAccount() {
    setAcctSaving(true);
    setAcctMsg(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? "Failed to save.");
      }
      setAcctMsg({ ok: true, text: "Changes saved." });
    } catch (err) {
      setAcctMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    }
    setAcctSaving(false);
  }

  // ── Address handlers ──────────────────────────────────────────────────────

  function cancelForm() {
    setEditingId(null);
    setAddingType(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function startAdd(type: "billing" | "delivery") {
    cancelForm();
    setAddingType(type);
    setForm({ ...EMPTY_FORM });
  }

  function startEdit(a: AddressRow) {
    cancelForm();
    setEditingId(a.id);
    setForm(formFromRow(a));
  }

  async function submitForm() {
    if (!form.line1.trim()) { setFormError("Address line 1 is required."); return; }
    if (!form.city.trim())  { setFormError("City is required."); return; }
    if (!form.postcode.trim()) { setFormError("Postcode is required."); return; }

    setFormSaving(true);
    setFormError("");

    const isEdit = editingId !== null;
    const type   = isEdit ? addresses.find((a) => a.id === editingId)?.type : addingType;

    try {
      const url    = isEdit ? `/api/address/${editingId}` : "/api/address";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(!isEdit && { type }),
          label:      form.label.trim()    || null,
          line1:      form.line1.trim(),
          line2:      form.line2.trim()    || null,
          city:       form.city.trim(),
          postcode:   form.postcode.trim(),
          country:    form.country.trim()  || "GB",
          is_default: form.is_default,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? "Failed to save.");
      }
      const j = await res.json() as { address: AddressRow };
      setAddresses((prev) =>
        isEdit
          ? prev.map((a) => a.id === editingId ? j.address : (form.is_default && a.type === type ? { ...a, is_default: false } : a))
          : [j.address, ...(form.is_default ? prev.map((a) => a.type === type ? { ...a, is_default: false } : a) : prev)]
      );
      cancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setFormSaving(false);
  }

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return;
    const res = await fetch(`/api/address/${id}`, { method: "DELETE" });
    if (res.ok) setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function setDefault(id: string) {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    const res = await fetch(`/api/address/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (res.ok) {
      setAddresses((prev) =>
        prev.map((x) => x.type === a.type ? { ...x, is_default: x.id === id } : x)
      );
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">Settings</h1>

      {/* Tabs */}
      <div className="settings-tabs" role="tablist">
        {(["account", "addresses"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`settings-tab${tab === t ? " settings-tab--active" : ""}`}
            onClick={() => { cancelForm(); setTab(t); }}
          >
            {t === "account" ? "Account" : "Addresses"}
          </button>
        ))}
      </div>

      {/* Account tab */}
      {tab === "account" && (
        <div className="settings-card" role="tabpanel">
          <div className="settings-section">
            <label className="addr-form__field addr-form__field--full">
              <span className="addr-form__label">Display name</span>
              <input
                type="text"
                value={displayName}
                placeholder="Your name"
                onChange={(e) => { setDisplayName(e.target.value); setAcctMsg(null); }}
              />
            </label>
            <label className="addr-form__field addr-form__field--full" style={{ marginTop: "0.75rem" }}>
              <span className="addr-form__label">Email</span>
              <input type="email" value={email} readOnly style={{ opacity: 0.6, cursor: "default" }} />
            </label>
            {acctMsg && (
              <p className={acctMsg.ok ? "settings-msg settings-msg--ok" : "funnel__error"} role="alert">
                {acctMsg.text}
              </p>
            )}
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ marginTop: "1.25rem" }}
              disabled={acctSaving}
              onClick={saveAccount}
            >
              {acctSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Addresses tab */}
      {tab === "addresses" && (
        <div className="settings-card" role="tabpanel">
          {loadingAddrs ? (
            <p className="settings-loading">Loading addresses…</p>
          ) : (
            <>
              <AddrSection
                title="Delivery addresses"
                type="delivery"
                addresses={addresses}
                editingId={editingId}
                addingType={addingType}
                form={form}
                formSaving={formSaving}
                formError={formError}
                onStartAdd={startAdd}
                onStartEdit={startEdit}
                onFormChange={setForm}
                onFormSubmit={submitForm}
                onFormCancel={cancelForm}
                onDelete={deleteAddress}
                onSetDefault={setDefault}
              />
              <AddrSection
                title="Billing addresses"
                type="billing"
                addresses={addresses}
                editingId={editingId}
                addingType={addingType}
                form={form}
                formSaving={formSaving}
                formError={formError}
                onStartAdd={startAdd}
                onStartEdit={startEdit}
                onFormChange={setForm}
                onFormSubmit={submitForm}
                onFormCancel={cancelForm}
                onDelete={deleteAddress}
                onSetDefault={setDefault}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
