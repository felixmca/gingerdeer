"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CATEGORIES,
  LIFECYCLE_LABELS,
  CATEGORY_LABELS,
  type LifecycleStage,
} from "@/lib/prospects";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProspectList {
  id:                  string;
  created_at:          string;
  name:                string;
  description:         string | null;
  list_type:           "manual" | "filter";
  category_filter:     string[];
  lifecycle_filter:    string[];
  sub_category_filter: string[];
  status_filter:       string[];
  contact_count:       number;
}

interface ContactSummary {
  id:             string;
  email:          string;
  name:           string | null;
  organisation:   string | null;
  category:       string;
  lifecycle_stage: string;
  status:         string;
  quality_score:  number;
  added_at?:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// New / Edit List Modal
// ─────────────────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS: LifecycleStage[] = ["contact", "opportunity", "lead", "customer"];

function ListFormModal({
  existing,
  onSave,
  onClose,
}: {
  existing?: ProspectList;
  onSave:    (list: ProspectList) => void;
  onClose:   () => void;
}) {
  const isEdit = Boolean(existing);

  const [name,        setName]        = useState(existing?.name        ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [listType,    setListType]    = useState<"manual" | "filter">(existing?.list_type ?? "manual");
  const [catFilter,   setCatFilter]   = useState<string[]>(existing?.category_filter   ?? []);
  const [lcFilter,    setLcFilter]    = useState<string[]>((existing?.lifecycle_filter ?? []) as string[]);
  const [subCatText,  setSubCatText]  = useState((existing?.sub_category_filter ?? []).join(", "));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function toggleArr<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, val: T) {
    setter((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      list_type: listType,
      category_filter:     listType === "filter" ? catFilter : [],
      lifecycle_filter:    listType === "filter" ? lcFilter  : [],
      sub_category_filter: listType === "filter"
        ? subCatText.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };
    try {
      const url    = isEdit ? `/api/admin/lists/${existing!.id}` : "/api/admin/lists";
      const method = isEdit ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed"); return; }
      onSave(isEdit ? json.list : json.list);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="adm-modal__header">
          <h2 className="adm-modal__title">{isEdit ? "Edit list" : "New list"}</h2>
          <button className="adm-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="adm-modal__body">
          <div className="adm-form-row">
            <label className="adm-label">Name <span className="adm-required">*</span></label>
            <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. London Comedy Clubs Q2" />
          </div>

          <div className="adm-form-row">
            <label className="adm-label">Description</label>
            <input className="adm-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note" />
          </div>

          <div className="adm-form-row">
            <label className="adm-label">Type</label>
            <div style={{ display: "flex", gap: 12 }}>
              {(["manual", "filter"] as const).map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="list_type"
                    value={t}
                    checked={listType === t}
                    onChange={() => setListType(t)}
                  />
                  <span style={{ fontWeight: 500 }}>{t === "manual" ? "Manual" : "Filter-based"}</span>
                  <span style={{ color: "#78716c", fontSize: 12 }}>
                    {t === "manual" ? "Hand-pick contacts" : "Auto-match by criteria"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {listType === "filter" && (
            <>
              <div className="adm-fieldset">
                <div className="adm-fieldset__legend">Categories (leave empty for all)</div>
                <div className="adm-check-group">
                  {CATEGORIES.map((c) => (
                    <label key={c.key} className="adm-check-label">
                      <input
                        type="checkbox"
                        checked={catFilter.includes(c.key)}
                        onChange={() => toggleArr(setCatFilter, c.key)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="adm-fieldset">
                <div className="adm-fieldset__legend">Lifecycle stages (leave empty for all)</div>
                <div className="adm-check-group">
                  {LIFECYCLE_OPTIONS.map((s) => (
                    <label key={s} className="adm-check-label">
                      <input
                        type="checkbox"
                        checked={lcFilter.includes(s)}
                        onChange={() => toggleArr(setLcFilter, s as string)}
                      />
                      {LIFECYCLE_LABELS[s]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="adm-form-row">
                <label className="adm-label">Sub-categories (comma-separated)</label>
                <input
                  className="adm-input"
                  placeholder="e.g. comedy_club, nightclub"
                  value={subCatText}
                  onChange={(e) => setSubCatText(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <p className="adm-error">{error}</p>}
        </div>

        <div className="adm-modal__footer">
          <button className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : (isEdit ? "Save changes" : "Create list")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function ListDetailDrawer({
  list,
  onClose,
  onUpdate,
  onDelete,
}: {
  list:     ProspectList;
  onClose:  () => void;
  onUpdate: (updated: ProspectList) => void;
  onDelete: (id: string) => void;
}) {
  const [contacts, setContacts]     = useState<ContactSummary[]>([]);
  const [count,    setCount]        = useState(0);
  const [loading,  setLoading]      = useState(true);
  const [editOpen, setEditOpen]     = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error,    setError]        = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/lists/${list.id}`)
      .then((r) => r.json())
      .then((json) => {
        setContacts(json.contacts ?? []);
        setCount(json.count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [list.id]);

  async function handleRemove(contactId: string) {
    const res = await fetch(`/api/admin/lists/${list.id}/members`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contact_ids: [contactId] }),
    });
    if (res.ok) {
      setContacts((cs) => cs.filter((c) => c.id !== contactId));
      setCount((n) => n - 1);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete list "${list.name}"? Contacts are not affected.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/lists/${list.id}`, { method: "DELETE" });
    if (res.ok) { onDelete(list.id); onClose(); }
    else { setError("Delete failed"); setDeleting(false); }
  }

  return (
    <>
      {editOpen && (
        <ListFormModal
          existing={list}
          onSave={(updated) => { onUpdate(updated); setEditOpen(false); }}
          onClose={() => setEditOpen(false)}
        />
      )}
      <div className="adm-drawer adm-drawer--open">
        <div className="adm-drawer__backdrop" onClick={onClose} />
        <div className="adm-drawer__panel">
          <div className="adm-drawer__header">
            <div>
              <h2 className="adm-drawer__title">{list.name}</h2>
              <p className="adm-drawer__subtitle">
                {list.list_type === "manual" ? "Manual list" : "Filter-based list"} · {count} contact{count !== 1 ? "s" : ""}
              </p>
            </div>
            <button className="adm-drawer__close" onClick={onClose}>✕</button>
          </div>

          <div className="adm-drawer__body">
            {list.description && (
              <p style={{ color: "#78716c", fontSize: 13, marginBottom: 12 }}>{list.description}</p>
            )}

            {list.list_type === "filter" && (
              <div className="adm-drawer__meta" style={{ marginBottom: 16 }}>
                {list.category_filter?.length > 0 && (
                  <span>Categories: {list.category_filter.map((k) => CATEGORY_LABELS[k] ?? k).join(", ")}</span>
                )}
                {list.lifecycle_filter?.length > 0 && (
                  <span>Stages: {list.lifecycle_filter.map((s) => LIFECYCLE_LABELS[s as LifecycleStage] ?? s).join(", ")}</span>
                )}
                {list.sub_category_filter?.length > 0 && (
                  <span>Sub-categories: {list.sub_category_filter.join(", ")}</span>
                )}
              </div>
            )}

            {loading ? (
              <p className="adm-loading">Loading contacts…</p>
            ) : contacts.length === 0 ? (
              <p className="adm-empty" style={{ marginTop: 24 }}>
                {list.list_type === "manual"
                  ? "No contacts in this list yet. Add contacts from the Prospects page."
                  : "No active contacts match these filters."}
              </p>
            ) : (
              <table className="adm-table adm-table--compact">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Organisation</th>
                    <th>Category</th>
                    <th>Stage</th>
                    {list.list_type === "manual" && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="adm-table__mono">{c.email}</td>
                      <td>{c.organisation ?? c.name ?? "—"}</td>
                      <td>{CATEGORY_LABELS[c.category] ?? c.category ?? "—"}</td>
                      <td>{LIFECYCLE_LABELS[c.lifecycle_stage as LifecycleStage] ?? c.lifecycle_stage}</td>
                      {list.list_type === "manual" && (
                        <td>
                          <button
                            className="adm-btn adm-btn--ghost adm-btn--sm"
                            style={{ color: "#dc2626" }}
                            onClick={() => handleRemove(c.id)}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {error && <p className="adm-error">{error}</p>}
          </div>

          <div className="adm-drawer__footer">
            <button
              className="adm-btn adm-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete list"}
            </button>
            <div className="adm-drawer__footer-right">
              <button className="adm-btn adm-btn--ghost" onClick={onClose}>Close</button>
              <button className="adm-btn adm-btn--primary" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function CrmListsPage() {
  const [lists,   setLists]   = useState<ProspectList[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ProspectList | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/lists");
      const json = await res.json();
      setLists(json.lists ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  function handleCreated(list: ProspectList) {
    setLists((ls) => [list, ...ls]);
    setTotal((t) => t + 1);
    setCreating(false);
  }

  function handleUpdated(updated: ProspectList) {
    setLists((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(updated);
  }

  function handleDeleted(id: string) {
    setLists((ls) => ls.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
    setSelected(null);
  }

  return (
    <div className="adm-page">
      {creating && (
        <ListFormModal
          onSave={handleCreated}
          onClose={() => setCreating(false)}
        />
      )}

      {/* Header */}
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Lists</h1>
          <p className="adm-page__subtitle">{total.toLocaleString()} list{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="adm-page__actions">
          <button className="adm-btn adm-btn--sm adm-btn--primary" onClick={() => setCreating(true)}>
            + New list
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="adm-loading">Loading…</p>
      ) : lists.length === 0 ? (
        <div className="adm-empty" style={{ marginTop: 48, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "#78716c", marginBottom: 16 }}>
            No lists yet. Create a list to group contacts for targeted campaigns.
          </p>
          <button className="adm-btn adm-btn--primary" onClick={() => setCreating(true)}>
            Create your first list
          </button>
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Contacts</th>
              <th>Description</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr
                key={l.id}
                className="adm-table__row--clickable"
                onClick={() => setSelected(l)}
              >
                <td style={{ fontWeight: 600 }}>{l.name}</td>
                <td>
                  <span className={`adm-badge ${l.list_type === "filter" ? "adm-badge--lifecycle-opportunity" : "adm-badge--status-active"}`}>
                    {l.list_type === "filter" ? "Filter" : "Manual"}
                  </span>
                </td>
                <td>{l.contact_count.toLocaleString()}</td>
                <td style={{ color: "#78716c", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.description ?? "—"}
                </td>
                <td>{fmtDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Drawer */}
      {selected && (
        <ListDetailDrawer
          list={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdated}
          onDelete={handleDeleted}
        />
      )}
    </div>
  );
}
