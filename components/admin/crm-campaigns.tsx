"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/prospects";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Campaign {
  id:                   string;
  created_at:           string;
  name:                 string;
  subject:              string;
  body_html:            string;
  preview_text:         string | null;
  campaign_type:        string;
  category_filter:      string[];
  lifecycle_filter:     string[];
  sub_category_filter:  string[];
  cta_label:            string | null;
  cta_url:              string | null;
  secondary_cta_label:  string | null;
  secondary_cta_url:    string | null;
  utm_campaign:         string | null;
  status:               "draft" | "sent";
  sent_at:              string | null;
  recipient_count:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign composer
// ─────────────────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS: LifecycleStage[] = ["contact", "opportunity", "lead", "customer"];

function CampaignComposer({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: Campaign;
  onSaved:  (c: Campaign) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(existing);

  const [fields, setFields] = useState({
    name:                existing?.name                ?? "",
    subject:             existing?.subject             ?? "",
    body_html:           existing?.body_html           ?? "",
    preview_text:        existing?.preview_text        ?? "",
    cta_label:           existing?.cta_label           ?? "",
    cta_url:             existing?.cta_url             ?? "",
    secondary_cta_label: existing?.secondary_cta_label ?? "",
    secondary_cta_url:   existing?.secondary_cta_url   ?? "",
    utm_campaign:        existing?.utm_campaign         ?? "",
  });

  const [categoryFilter,    setCategoryFilter]    = useState<string[]>(existing?.category_filter    ?? []);
  const [lifecycleFilter,   setLifecycleFilter]   = useState<string[]>(existing?.lifecycle_filter   ?? []);
  const [subCatFilter,      setSubCatFilter]      = useState(existing?.sub_category_filter?.join(", ") ?? "");

  const [saving,   setSaving]   = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  function setField(k: string, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  function toggleCategory(key: string) {
    setCategoryFilter((f) =>
      f.includes(key) ? f.filter((k) => k !== key) : [...f, key]
    );
  }
  function toggleLifecycle(key: LifecycleStage) {
    setLifecycleFilter((f) =>
      f.includes(key) ? f.filter((k) => k !== key) : [...f, key]
    );
  }

  async function handleSave() {
    if (!fields.name || !fields.subject || !fields.body_html) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...fields,
      category_filter:     categoryFilter,
      lifecycle_filter:    lifecycleFilter,
      sub_category_filter: subCatFilter.split(",").map((s) => s.trim()).filter(Boolean),
      campaign_type:       "prospect_only",
    };

    try {
      const res = isEdit
        ? await fetch(`/api/admin/campaigns/${existing!.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/campaigns", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save"); return; }
      onSaved(json.campaign);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!existing) return;
    setPreviewing(true);
    try {
      const res  = await fetch(`/api/admin/campaigns/${existing.id}/preview`);
      const json = await res.json();
      if (res.ok) setPreviewCount(json.count);
    } finally {
      setPreviewing(false);
    }
  }

  const isSent = existing?.status === "sent";

  return (
    <div className="adm-composer">
      <div className="adm-composer__header">
        <h2 className="adm-composer__title">{isEdit ? `Edit: ${existing!.name}` : "New campaign"}</h2>
        <button className="adm-drawer__close" onClick={onCancel}>✕</button>
      </div>

      <div className="adm-composer__body">
        {isSent && (
          <div className="adm-info-banner">
            This campaign has been sent and cannot be edited.
          </div>
        )}

        <fieldset className="adm-fieldset" disabled={isSent}>
          <legend className="adm-fieldset__legend">Details</legend>
          <div className="adm-form-grid">
            <div className="adm-form-row">
              <label className="adm-label">Campaign name <span className="adm-required">*</span></label>
              <input className="adm-input" value={fields.name} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Email subject <span className="adm-required">*</span></label>
              <input className="adm-input" value={fields.subject} onChange={(e) => setField("subject", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Preview text</label>
              <input className="adm-input" placeholder="Short teaser shown in inbox preview" value={fields.preview_text} onChange={(e) => setField("preview_text", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">UTM campaign tag</label>
              <input className="adm-input" placeholder="e.g. mum_q2_2026" value={fields.utm_campaign} onChange={(e) => setField("utm_campaign", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="adm-fieldset" disabled={isSent}>
          <legend className="adm-fieldset__legend">Body HTML <span className="adm-required">*</span></legend>
          <p className="adm-hint">
            Write the email body as HTML. Use <code>{"{{name}}"}</code> for personalisation.
            CTA URLs will be replaced with tracked versions automatically.
          </p>
          <textarea
            className="adm-textarea adm-textarea--code adm-textarea--xl"
            value={fields.body_html}
            onChange={(e) => setField("body_html", e.target.value)}
            rows={12}
            spellCheck={false}
          />
        </fieldset>

        <fieldset className="adm-fieldset" disabled={isSent}>
          <legend className="adm-fieldset__legend">CTAs</legend>
          <div className="adm-form-grid">
            <div className="adm-form-row">
              <label className="adm-label">Primary CTA label</label>
              <input className="adm-input" placeholder="e.g. Book a tasting" value={fields.cta_label} onChange={(e) => setField("cta_label", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Primary CTA URL</label>
              <input className="adm-input" placeholder="https://…" value={fields.cta_url} onChange={(e) => setField("cta_url", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Secondary CTA label</label>
              <input className="adm-input" value={fields.secondary_cta_label} onChange={(e) => setField("secondary_cta_label", e.target.value)} />
            </div>
            <div className="adm-form-row">
              <label className="adm-label">Secondary CTA URL</label>
              <input className="adm-input" placeholder="https://…" value={fields.secondary_cta_url} onChange={(e) => setField("secondary_cta_url", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="adm-fieldset" disabled={isSent}>
          <legend className="adm-fieldset__legend">Audience filters</legend>
          <p className="adm-hint">Leave all unchecked to target every active prospect contact.</p>

          <div className="adm-form-row">
            <label className="adm-label">Categories</label>
            <div className="adm-check-group">
              {CATEGORIES.map((c) => (
                <label key={c.key} className="adm-check-label">
                  <input
                    type="checkbox"
                    checked={categoryFilter.includes(c.key)}
                    onChange={() => toggleCategory(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="adm-form-row">
            <label className="adm-label">Lifecycle stages</label>
            <div className="adm-check-group">
              {LIFECYCLE_OPTIONS.map((s) => (
                <label key={s} className="adm-check-label">
                  <input
                    type="checkbox"
                    checked={lifecycleFilter.includes(s)}
                    onChange={() => toggleLifecycle(s)}
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
              placeholder="e.g. golf_club, law_firm"
              value={subCatFilter}
              onChange={(e) => setSubCatFilter(e.target.value)}
            />
          </div>
        </fieldset>

        {/* Preview count */}
        {isEdit && !isSent && (
          <div className="adm-form-row">
            <button
              className="adm-btn adm-btn--ghost adm-btn--sm"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? "Checking…" : "Preview recipient count"}
            </button>
            {previewCount !== null && (
              <span className="adm-hint" style={{ marginLeft: 12 }}>
                {previewCount.toLocaleString()} contacts match these filters
              </span>
            )}
          </div>
        )}

        {error && <p className="adm-error">{error}</p>}
      </div>

      <div className="adm-composer__footer">
        <button className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancel</button>
        {!isSent && (
          <button
            className="adm-btn adm-btn--primary"
            onClick={handleSave}
            disabled={saving || !fields.name || !fields.subject || !fields.body_html}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Send confirmation modal
// ─────────────────────────────────────────────────────────────────────────────

function SendModal({
  campaign,
  onSent,
  onCancel,
}: {
  campaign: Campaign;
  onSent:   (c: Campaign) => void;
  onCancel: () => void;
}) {
  const [count,   setCount]   = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ sent: number; failed: number } | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/campaigns/${campaign.id}/preview`)
      .then((r) => r.json())
      .then((j) => setCount(j.count ?? 0))
      .finally(() => setLoading(false));
  }, [campaign.id]);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/campaigns/${campaign.id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Send failed"); setSending(false); return; }
      setResult({ sent: json.sent, failed: json.failed });
      // Refresh campaign detail
      const refreshRes  = await fetch(`/api/admin/campaigns/${campaign.id}`);
      const refreshJson = await refreshRes.json();
      if (refreshRes.ok) onSent(refreshJson.campaign);
    } catch {
      setError("Network error");
      setSending(false);
    }
  }

  return (
    <div className="adm-modal-backdrop" onClick={onCancel}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="adm-modal__title">Send "{campaign.name}"</h2>

        {loading ? (
          <p className="adm-loading">Resolving recipients…</p>
        ) : result ? (
          <div>
            <p className="adm-success">
              Sent to {result.sent.toLocaleString()} contacts{result.failed > 0 ? `, ${result.failed} failed` : ""}.
            </p>
            <button className="adm-btn adm-btn--ghost" onClick={onCancel}>Close</button>
          </div>
        ) : (
          <>
            <p>
              This will send <strong>{count?.toLocaleString() ?? "…"}</strong> emails immediately.
              Sent campaigns cannot be unsent.
            </p>
            <div className="adm-modal__filters">
              <span className="adm-hint">
                Categories: {campaign.category_filter?.length
                  ? campaign.category_filter.map((k) => CATEGORY_LABELS[k] ?? k).join(", ")
                  : "all"}
              </span>
              <span className="adm-hint">
                Lifecycle: {campaign.lifecycle_filter?.length
                  ? campaign.lifecycle_filter.map((s) => LIFECYCLE_LABELS[s as LifecycleStage] ?? s).join(", ")
                  : "all stages"}
              </span>
            </div>
            {error && <p className="adm-error">{error}</p>}
            <div className="adm-modal__actions">
              <button className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={sending}>Cancel</button>
              <button
                className="adm-btn adm-btn--danger"
                onClick={handleSend}
                disabled={sending || count === 0}
              >
                {sending ? "Sending…" : `Send to ${count?.toLocaleString() ?? "…"} contacts`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export function CrmCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [composing, setComposing] = useState(false);
  const [editing,   setEditing]   = useState<Campaign | null>(null);
  const [sending,   setSending]   = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res  = await fetch(`/api/admin/campaigns?${params}`);
      const json = await res.json();
      setCampaigns(json.campaigns ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  function handleSaved(c: Campaign) {
    setCampaigns((cs) => {
      const idx = cs.findIndex((x) => x.id === c.id);
      if (idx >= 0) { const n = [...cs]; n[idx] = c; return n; }
      return [c, ...cs];
    });
    setComposing(false);
    setEditing(c);   // open composer in edit mode for the newly created draft
  }

  function handleSent(c: Campaign) {
    setCampaigns((cs) => cs.map((x) => (x.id === c.id ? c : x)));
    setSending(null);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft campaign?")) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((cs) => cs.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
      if (editing?.id === id) setEditing(null);
    }
  }

  const showComposer = composing || editing !== null;
  const composerCampaign = editing;

  return (
    <div className="adm-page adm-page--campaigns">
      {/* Header */}
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Campaigns</h1>
          <p className="adm-page__subtitle">{total.toLocaleString()} prospect campaigns</p>
        </div>
        <div className="adm-page__actions">
          <button
            className={`adm-btn adm-btn--sm ${showComposer && !editing ? "adm-btn--primary" : "adm-btn--ghost"}`}
            onClick={() => { setComposing(true); setEditing(null); }}
          >
            + New campaign
          </button>
        </div>
      </div>

      <div className="adm-campaigns-layout">
        {/* List panel */}
        <div className="adm-campaigns-list">
          {/* Filters */}
          <div className="adm-filters adm-filters--compact">
            <select className="adm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          {loading ? (
            <p className="adm-loading">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="adm-empty">No campaigns yet.</p>
          ) : (
            <div className="adm-campaign-cards">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className={`adm-campaign-card${editing?.id === c.id ? " adm-campaign-card--active" : ""}`}
                  onClick={() => { setEditing(c); setComposing(false); }}
                >
                  <div className="adm-campaign-card__header">
                    <span className="adm-campaign-card__name">{c.name}</span>
                    <span className={`adm-badge adm-badge--${c.status}`}>{c.status}</span>
                  </div>
                  <p className="adm-campaign-card__subject">{c.subject}</p>
                  <div className="adm-campaign-card__meta">
                    {c.category_filter?.length > 0
                      ? c.category_filter.map((k) => CATEGORY_LABELS[k] ?? k).join(", ")
                      : "All categories"}
                    {c.status === "sent"
                      ? ` · ${c.recipient_count.toLocaleString()} sent · ${fmtDate(c.sent_at)}`
                      : ` · Draft · ${fmtDate(c.created_at)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composer / detail panel */}
        {showComposer && (
          <div className="adm-campaigns-composer">
            <CampaignComposer
              existing={composerCampaign ?? undefined}
              onSaved={handleSaved}
              onCancel={() => { setComposing(false); setEditing(null); }}
            />

            {editing && editing.status === "draft" && (
              <div className="adm-composer-actions">
                <button
                  className="adm-btn adm-btn--danger"
                  onClick={() => handleDelete(editing.id)}
                >
                  Delete draft
                </button>
                <button
                  className="adm-btn adm-btn--primary"
                  onClick={() => setSending(editing)}
                >
                  Send campaign →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send confirmation modal */}
      {sending && (
        <SendModal
          campaign={sending}
          onSent={handleSent}
          onCancel={() => setSending(null)}
        />
      )}
    </div>
  );
}
