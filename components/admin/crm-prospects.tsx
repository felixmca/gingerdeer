"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  LIFECYCLE_LABELS,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type ProspectContact,
  type LifecycleStage,
  type ContactStatus,
} from "@/lib/prospects";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

function qualityColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#ca8a04";
  return "#dc2626";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LifecycleBadge({ stage }: { stage: LifecycleStage }) {
  return (
    <span className={`adm-badge adm-badge--lifecycle-${stage}`}>
      {LIFECYCLE_LABELS[stage] ?? stage}
    </span>
  );
}

function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span className={`adm-badge adm-badge--status-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Extract panel
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedContact {
  email: string;
  name?: string | null;
  role?: string | null;
  organisation?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  borough?: string | null;
  category?: string | null;
  sub_category?: string | null;
  email_type?: string | null;
  email_confidence?: number | null;
  notes?: string | null;
  source_url?: string | null;
  source_type?: string;
  source_raw?: string;
}

function AiExtractPanel({
  onImport,
}: {
  onImport: (contacts: ExtractedContact[], queryId: string | null) => void;
}) {
  const [text, setText]           = useState("");
  const [category, setCategory]   = useState("");
  const [subCat, setSubCat]       = useState("");
  const [location, setLocation]   = useState("London");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading]     = useState(false);
  const [extracted, setExtracted] = useState<ExtractedContact[]>([]);
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [error, setError]         = useState<string | null>(null);
  const [mode, setMode]           = useState<"extract" | "research" | null>(null);
  const [queryId, setQueryId]     = useState<string | null>(null);

  // Research mode = no text, or text is a short plain-English query (no @ or http)
  const isResearchMode =
    !text.trim() ||
    (text.length < 200 && !text.includes("@") && !text.includes("http") && text.split("\n").length < 5);

  async function handleExtract() {
    if (!category) return;
    setLoading(true);
    setError(null);
    setExtracted([]);
    setSelected(new Set());
    setMode(null);
    try {
      const res = await fetch("/api/admin/prospects/extract", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text:         text.trim() || undefined,
          category,
          sub_category: subCat,
          source_url:   sourceUrl,
          location,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Extraction failed"); return; }
      setExtracted(json.contacts ?? []);
      setMode(json.mode ?? "extract");
      setQueryId(json.query_id ?? null);
      setSelected(new Set((json.contacts ?? []).map((_: unknown, i: number) => i)));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    if (selected.size === extracted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(extracted.map((_, i) => i)));
    }
  }

  function handleConfirmImport() {
    const rows = extracted.filter((_, i) => selected.has(i));
    onImport(rows, queryId);
    setExtracted([]);
    setSelected(new Set());
    setText("");
    setMode(null);
  }

  return (
    <div className="adm-extract-panel">
      <h3 className="adm-extract-panel__title">AI Extract</h3>
      <p className="adm-extract-panel__desc">
        {isResearchMode
          ? "Research mode — Claude will suggest real venues matching your category and location from its training knowledge. Emails are inferred patterns, not verified."
          : "Extraction mode — Claude will parse the pasted text and pull out any email contacts it finds."}
      </p>

      <div className="adm-form-row">
        <label className="adm-label">Default category <span className="adm-required">*</span></label>
        <select
          className="adm-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">— choose —</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label} — {c.description}</option>
          ))}
        </select>
      </div>

      <div className="adm-form-row">
        <label className="adm-label">Sub-category</label>
        <input
          className="adm-input"
          placeholder="e.g. golf_club, law_firm, tennis_club"
          value={subCat}
          onChange={(e) => setSubCat(e.target.value)}
        />
      </div>

      <div className="adm-form-row">
        <label className="adm-label">Location</label>
        <input
          className="adm-input"
          placeholder="London"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="adm-form-row">
        <label className="adm-label">Source URL</label>
        <input
          className="adm-input"
          placeholder="https://..."
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>

      <div className="adm-form-row">
        <label className="adm-label">
          Text or search query{" "}
          <span className="adm-hint" style={{ display: "inline", marginTop: 0 }}>
            (optional — leave blank or type a query like "tennis clubs in London")
          </span>
        </label>
        <textarea
          className="adm-textarea adm-textarea--tall"
          placeholder="Paste website content, Google Maps text, LinkedIn page copy, event listing..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
        />
        {text.length > 0 && (
          <span className="adm-hint">{text.length.toLocaleString()} / 20,000 chars</span>
        )}
      </div>

      {error && <p className="adm-error">{error}</p>}

      <button
        className="adm-btn adm-btn--primary"
        onClick={handleExtract}
        disabled={loading || !category}
      >
        {loading
          ? (isResearchMode ? "Researching…" : "Extracting…")
          : (isResearchMode ? "Research contacts" : "Extract contacts")}
      </button>

      {extracted.length > 0 && (
        <div className="adm-extract-results">
          <div className="adm-extract-results__header">
            <span>
              {extracted.length} contact{extracted.length !== 1 ? "s" : ""}{" "}
              {mode === "research" ? "suggested" : "found"}
            </span>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={toggleAll}>
              {selected.size === extracted.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          {mode === "research" && (
            <div className="adm-extract-results__warning">
              Research mode — emails are inferred from venue domains, not verified.
              Confidence scores are intentionally low. Verify before sending campaigns.
            </div>
          )}

          <table className="adm-table adm-table--compact">
            <thead>
              <tr>
                <th></th>
                <th>Email</th>
                <th>Organisation</th>
                <th>Role</th>
                <th>Category</th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {extracted.map((c, i) => (
                <tr
                  key={i}
                  className={selected.has(i) ? "" : "adm-table__row--muted"}
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      next.has(i) ? next.delete(i) : next.add(i);
                      return next;
                    })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="adm-table__mono">{c.email}</td>
                  <td>{c.organisation ?? c.name ?? "—"}</td>
                  <td>{c.role ?? "—"}</td>
                  <td>{CATEGORY_LABELS[c.category ?? ""] ?? c.category ?? "—"}</td>
                  <td style={{ color: (c.email_confidence ?? 0) >= 0.7 ? "#16a34a" : "#ca8a04" }}>
                    {c.email_confidence != null
                      ? `${Math.round(c.email_confidence * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="adm-extract-results__footer">
            <button
              className="adm-btn adm-btn--primary"
              disabled={selected.size === 0}
              onClick={handleConfirmImport}
            >
              Import {selected.size} selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Import panel
// ─────────────────────────────────────────────────────────────────────────────

function CsvImportPanel({ onDone }: { onDone: () => void }) {
  const [category, setCategory] = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{
    imported: number; skipped_duplicates: number; errors: unknown[];
  } | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function handleImport() {
    if (!file || !category) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { setError("CSV must have a header row and at least one data row"); return; }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { if (vals[i]) obj[h] = vals[i]; });
        return obj;
      });

      const res = await fetch("/api/admin/prospects/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows, category }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Import failed"); return; }
      setResult(json);
      onDone();
    } catch {
      setError("Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adm-import-panel">
      <h3 className="adm-import-panel__title">CSV Import</h3>
      <p className="adm-import-panel__desc">
        Upload a CSV with columns: <code>email</code>, <code>name</code>, <code>role</code>,{" "}
        <code>organisation</code>, <code>website</code>, <code>phone</code>, <code>city</code>,{" "}
        <code>borough</code>, <code>sub_category</code>, <code>notes</code>.
        The <code>email</code> column is required.
      </p>

      <div className="adm-form-row">
        <label className="adm-label">Default category <span className="adm-required">*</span></label>
        <select className="adm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— choose —</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label} — {c.description}</option>
          ))}
        </select>
      </div>

      <div className="adm-form-row">
        <label className="adm-label">CSV file <span className="adm-required">*</span></label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="adm-file-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error  && <p className="adm-error">{error}</p>}
      {result && (
        <p className="adm-success">
          Imported {result.imported} contacts · {result.skipped_duplicates} duplicates skipped
          {result.errors.length > 0 ? ` · ${result.errors.length} errors` : ""}
        </p>
      )}

      <button
        className="adm-btn adm-btn--primary"
        onClick={handleImport}
        disabled={loading || !file || !category}
      >
        {loading ? "Importing…" : "Import CSV"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add single contact form
// ─────────────────────────────────────────────────────────────────────────────

function AddContactForm({ onDone }: { onDone: () => void }) {
  const [fields, setFields] = useState({
    email: "", name: "", role: "", organisation: "", website: "",
    phone: "", city: "London", borough: "", category: "", sub_category: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set(k: string, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  async function handleAdd() {
    if (!fields.email || !fields.category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prospects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...fields, source_type: "manual" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to add contact"); return; }
      if (json.duplicate) {
        setError(`Already exists (lifecycle: ${json.existing?.lifecycle_stage ?? "unknown"})`);
        return;
      }
      onDone();
      setFields({
        email: "", name: "", role: "", organisation: "", website: "",
        phone: "", city: "London", borough: "", category: "", sub_category: "", notes: "",
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adm-add-form">
      <h3 className="adm-add-form__title">Add contact</h3>

      <div className="adm-form-grid">
        <div className="adm-form-row">
          <label className="adm-label">Email <span className="adm-required">*</span></label>
          <input className="adm-input" type="email" value={fields.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Name</label>
          <input className="adm-input" value={fields.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Role</label>
          <input className="adm-input" value={fields.role} onChange={(e) => set("role", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Organisation</label>
          <input className="adm-input" value={fields.organisation} onChange={(e) => set("organisation", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Website</label>
          <input className="adm-input" value={fields.website} onChange={(e) => set("website", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Phone</label>
          <input className="adm-input" type="tel" value={fields.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">City</label>
          <input className="adm-input" value={fields.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Borough</label>
          <input className="adm-input" value={fields.borough} onChange={(e) => set("borough", e.target.value)} />
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Category <span className="adm-required">*</span></label>
          <select className="adm-select" value={fields.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">— choose —</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label} — {c.description}</option>
            ))}
          </select>
        </div>
        <div className="adm-form-row">
          <label className="adm-label">Sub-category</label>
          <input className="adm-input" placeholder="e.g. golf_club" value={fields.sub_category} onChange={(e) => set("sub_category", e.target.value)} />
        </div>
      </div>

      <div className="adm-form-row">
        <label className="adm-label">Notes</label>
        <textarea className="adm-textarea" value={fields.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </div>

      {error && <p className="adm-error">{error}</p>}

      <button
        className="adm-btn adm-btn--primary"
        onClick={handleAdd}
        disabled={loading || !fields.email || !fields.category}
      >
        {loading ? "Adding…" : "Add contact"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Drawer
// ─────────────────────────────────────────────────────────────────────────────

function ContactDrawer({
  contact,
  onClose,
  onUpdate,
  onDelete,
}: {
  contact: ProspectContact;
  onClose:  () => void;
  onUpdate: (updated: ProspectContact) => void;
  onDelete: (id: string) => void;
}) {
  const [patch, setPatch]       = useState<Record<string, unknown>>({});
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function field(k: keyof ProspectContact) {
    return (patch[k] !== undefined ? patch[k] : contact[k]) as string | null;
  }
  function set(k: string, v: unknown) {
    setPatch((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/prospects/${contact.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed"); return; }
      onUpdate(json.contact);
      setPatch({});
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${contact.email}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/prospects/${contact.id}`, { method: "DELETE" });
      if (!res.ok) { setError("Delete failed"); return; }
      onDelete(contact.id);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  const isDirty = Object.keys(patch).length > 0;

  return (
    <div className="adm-drawer adm-drawer--open">
      <div className="adm-drawer__backdrop" onClick={onClose} />
      <div className="adm-drawer__panel">
        <div className="adm-drawer__header">
          <div>
            <h2 className="adm-drawer__title">{contact.email}</h2>
            <p className="adm-drawer__subtitle">
              {contact.organisation ?? contact.name ?? "No organisation"}
              {contact.category ? ` · ${CATEGORY_LABELS[contact.category] ?? contact.category}` : ""}
            </p>
          </div>
          <button className="adm-drawer__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="adm-drawer__body">
          {/* Status row */}
          <div className="adm-drawer__status-row">
            <LifecycleBadge stage={contact.lifecycle_stage} />
            <StatusBadge    status={contact.status} />
            <span className="adm-score" style={{ color: qualityColor(contact.quality_score) }}>
              Q{contact.quality_score}
            </span>
          </div>

          <div className="adm-form-grid">
            <div className="adm-form-row">
              <label className="adm-label">Name</label>
              <input className="adm-input" value={field("name") ?? ""} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Role</label>
              <input className="adm-input" value={field("role") ?? ""} onChange={(e) => set("role", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Organisation</label>
              <input className="adm-input" value={field("organisation") ?? ""} onChange={(e) => set("organisation", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Website</label>
              <input className="adm-input" value={field("website") ?? ""} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Phone</label>
              <input className="adm-input" type="tel" value={field("phone") ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">City</label>
              <input className="adm-input" value={field("city") ?? ""} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Borough</label>
              <input className="adm-input" value={field("borough") ?? ""} onChange={(e) => set("borough", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Category</label>
              <select
                className="adm-select"
                value={(patch["category"] as string | undefined) ?? contact.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label} — {c.description}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Sub-category</label>
              <input className="adm-input" value={field("sub_category") ?? ""} onChange={(e) => set("sub_category", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Lifecycle stage</label>
              <select
                className="adm-select"
                value={(patch["lifecycle_stage"] as string | undefined) ?? contact.lifecycle_stage}
                onChange={(e) => set("lifecycle_stage", e.target.value)}
              >
                {(["contact","opportunity","lead","customer","suppressed"] as LifecycleStage[]).map((s) => (
                  <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Status</label>
              <select
                className="adm-select"
                value={(patch["status"] as string | undefined) ?? contact.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="adm-form-row">
            <label className="adm-label">Notes</label>
            <textarea
              className="adm-textarea"
              value={(patch["notes"] as string | undefined) ?? contact.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>

          {/* Meta */}
          <div className="adm-drawer__meta">
            <span>Source: {SOURCE_TYPE_LABELS[contact.source_type] ?? contact.source_type}</span>
            <span>Added: {fmtDate(contact.created_at)}</span>
            {contact.email_confidence != null && (
              <span>Email conf: {Math.round(contact.email_confidence * 100)}%</span>
            )}
          </div>

          {error && <p className="adm-error">{error}</p>}
        </div>

        <div className="adm-drawer__footer">
          <button
            className="adm-btn adm-btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <div className="adm-drawer__footer-right">
            <button className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              className="adm-btn adm-btn--primary"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

type Panel = "none" | "add" | "csv" | "extract";

export function CrmProspectsPage() {
  const [contacts, setContacts]         = useState<ProspectContact[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [q, setQ]                       = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset]             = useState(0);
  const [panel, setPanel]               = useState<Panel>("none");
  const [selected, setSelected]         = useState<ProspectContact | null>(null);
  const LIMIT = 100;

  const fetchRef = useRef(0);

  const fetchContacts = useCallback(async () => {
    const fetchId = ++fetchRef.current;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (q)               params.set("q",            q);
    if (categoryFilter)  params.set("category",     categoryFilter);
    if (lifecycleFilter) params.set("lifecycle",    lifecycleFilter);
    if (statusFilter)    params.set("status",       statusFilter);
    try {
      const res  = await fetch(`/api/admin/prospects?${params}`);
      const json = await res.json();
      if (fetchId !== fetchRef.current) return;
      setContacts(json.contacts ?? []);
      setTotal(json.total ?? 0);
    } finally {
      if (fetchId === fetchRef.current) setLoading(false);
    }
  }, [q, categoryFilter, lifecycleFilter, statusFilter, offset]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  function handleImportExtracted(rows: ExtractedContact[], queryId: string | null) {
    fetch("/api/admin/prospects/import", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rows, extract_query_id: queryId }),
    })
      .then((r) => r.json())
      .then(() => { fetchContacts(); setPanel("none"); })
      .catch(() => {});
  }

  function handleUpdate(updated: ProspectContact) {
    setContacts((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  }

  function handleDelete(id: string) {
    setContacts((cs) => cs.filter((c) => c.id !== id));
    setTotal((t) => t - 1);
  }

  const pages = Math.ceil(total / LIMIT);
  const page  = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="adm-page">
      {/* Header */}
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Prospects</h1>
          <p className="adm-page__subtitle">{total.toLocaleString()} contacts</p>
        </div>
        <div className="adm-page__actions">
          <button
            className={`adm-btn adm-btn--sm ${panel === "add" ? "adm-btn--primary" : "adm-btn--ghost"}`}
            onClick={() => setPanel(panel === "add" ? "none" : "add")}
          >
            + Add
          </button>
          <button
            className={`adm-btn adm-btn--sm ${panel === "csv" ? "adm-btn--primary" : "adm-btn--ghost"}`}
            onClick={() => setPanel(panel === "csv" ? "none" : "csv")}
          >
            CSV import
          </button>
          <button
            className={`adm-btn adm-btn--sm ${panel === "extract" ? "adm-btn--primary" : "adm-btn--ghost"}`}
            onClick={() => setPanel(panel === "extract" ? "none" : "extract")}
          >
            AI extract
          </button>
        </div>
      </div>

      {/* Side panels */}
      {panel === "add"     && <AddContactForm    onDone={() => { fetchContacts(); setPanel("none"); }} />}
      {panel === "csv"     && <CsvImportPanel    onDone={() => { fetchContacts(); setPanel("none"); }} />}
      {panel === "extract" && <AiExtractPanel    onImport={handleImportExtracted} />}

      {/* Filters */}
      <div className="adm-filters">
        <input
          className="adm-input adm-input--search"
          placeholder="Search email, name, organisation…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
        />
        <select className="adm-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label} — {c.description}</option>
          ))}
        </select>
        <select className="adm-select" value={lifecycleFilter} onChange={(e) => { setLifecycleFilter(e.target.value); setOffset(0); }}>
          <option value="">All stages</option>
          {(["contact","opportunity","lead","customer","suppressed"] as LifecycleStage[]).map((s) => (
            <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>
          ))}
        </select>
        <select className="adm-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="adm-loading">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="adm-empty">No contacts found.</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Organisation</th>
              <th>Category</th>
              <th>Lifecycle</th>
              <th>Status</th>
              <th>Score</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                className="adm-table__row--clickable"
                onClick={() => setSelected(c)}
              >
                <td className="adm-table__mono">{c.email}</td>
                <td>{c.name ?? "—"}</td>
                <td>{c.organisation ?? "—"}</td>
                <td>{CATEGORY_LABELS[c.category] ?? c.category}</td>
                <td><LifecycleBadge stage={c.lifecycle_stage} /></td>
                <td><StatusBadge    status={c.status} /></td>
                <td>
                  <span style={{ color: qualityColor(c.quality_score), fontWeight: 600 }}>
                    {c.quality_score}
                  </span>
                </td>
                <td>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="adm-pagination">
          <button
            className="adm-btn adm-btn--sm adm-btn--ghost"
            disabled={page === 1}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          >
            ← Prev
          </button>
          <span className="adm-pagination__label">Page {page} of {pages}</span>
          <button
            className="adm-btn adm-btn--sm adm-btn--ghost"
            disabled={page >= pages}
            onClick={() => setOffset(offset + LIMIT)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Contact drawer */}
      {selected && (
        <ContactDrawer
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
