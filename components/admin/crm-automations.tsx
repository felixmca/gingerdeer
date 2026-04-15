"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TriggerEvent =
  | "lead_created"
  | "lead_created_existing_user"
  | "funnel_complete"
  | "subscription_created"
  | "lead_age_hours"
  | "pending_sub_age_hours"
  | "manual";

interface AutomationRule {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  trigger_event: TriggerEvent;
  delay_hours: number;
  template_name: string;
  subject: string;
  body_html: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_META: Record<TriggerEvent, { label: string; color: string; icon: string; group: string }> = {
  lead_created:                { label: "Lead created",              color: "#4f46e5", icon: "👤", group: "Instant" },
  lead_created_existing_user:  { label: "Lead — existing user",      color: "#7c3aed", icon: "🔄", group: "Instant" },
  funnel_complete:             { label: "Funnel completed",          color: "#0891b2", icon: "✅", group: "Instant" },
  subscription_created:        { label: "Subscription created",      color: "#059669", icon: "📦", group: "Instant" },
  lead_age_hours:              { label: "Lead age (hours)",          color: "#d97706", icon: "⏰", group: "Time-based" },
  pending_sub_age_hours:       { label: "Pending sub age (hours)",   color: "#dc2626", icon: "⏳", group: "Time-based" },
  manual:                      { label: "Manual / API trigger",      color: "#64748b", icon: "🔧", group: "Manual" },
};

const TRIGGER_OPTIONS = Object.entries(TRIGGER_META).map(([value, meta]) => ({
  value: value as TriggerEvent,
  label: meta.label,
  group: meta.group,
}));

function fmtDelay(hours: number): string {
  if (hours === 0) return "Immediately";
  if (hours < 24) return `After ${hours}h`;
  const days = hours / 24;
  return `After ${days % 1 === 0 ? days : days.toFixed(1)}d`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Rule Form (create / edit modal) ─────────────────────────────────────────

const BLANK: Omit<AutomationRule, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: "",
  trigger_event: "lead_created",
  delay_hours: 0,
  template_name: "",
  subject: "",
  body_html: "",
  enabled: true,
  conditions: {},
};

function RuleFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<AutomationRule> | null;
  onClose: () => void;
  onSave: (rule: AutomationRule) => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.trigger_event || !form.template_name.trim() || !form.subject.trim()) {
      setError("Name, trigger, template name, and subject are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = isEdit
        ? `/api/admin/emails/automations/${initial!.id}`
        : "/api/admin/emails/automations";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          trigger_event: form.trigger_event,
          delay_hours: Number(form.delay_hours),
          template_name: form.template_name.trim(),
          subject: form.subject.trim(),
          body_html: form.body_html,
          enabled: form.enabled,
        }),
      });
      const json = await res.json() as { rule?: AutomationRule; error?: string };
      if (!res.ok || !json.rule) throw new Error(json.error ?? "Failed to save");
      onSave(json.rule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const showDelay = form.trigger_event === "lead_age_hours" || form.trigger_event === "pending_sub_age_hours";

  return (
    <div className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="auto-modal-title">
      <div className="adm-modal__overlay" onClick={onClose} />
      <div className="adm-modal__box" style={{ width: "min(680px, 100%)" }}>
        <div className="adm-modal__header">
          <h2 className="adm-modal__title" id="auto-modal-title">
            {isEdit ? "Edit automation rule" : "New automation rule"}
          </h2>
          <button className="adm-drawer__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="adm-modal__body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <div className="adm-form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="adm-label" htmlFor="ar-name">Rule name</label>
                <input id="ar-name" className="adm-input" type="text"
                  placeholder="e.g. Lead 24h Follow-up"
                  value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div className="adm-form-group">
                <label className="adm-label" htmlFor="ar-trigger">Trigger event</label>
                <select id="ar-trigger" className="adm-input adm-select"
                  value={form.trigger_event}
                  onChange={(e) => set("trigger_event", e.target.value as TriggerEvent)}>
                  {(["Instant", "Time-based", "Manual"] as const).map((group) => (
                    <optgroup key={group} label={group}>
                      {TRIGGER_OPTIONS.filter((o) => o.group === group).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="adm-form-group">
                <label className="adm-label" htmlFor="ar-delay">
                  Delay {showDelay ? "(hours after trigger)" : "(hours — 0 = immediate)"}
                </label>
                <input id="ar-delay" className="adm-input" type="number" min="0"
                  value={form.delay_hours}
                  onChange={(e) => set("delay_hours", Number(e.target.value))}
                  disabled={!showDelay && form.trigger_event !== "manual"}
                />
              </div>

              <div className="adm-form-group">
                <label className="adm-label" htmlFor="ar-template">Template name</label>
                <input id="ar-template" className="adm-input" type="text"
                  placeholder="e.g. lead_followup_24h"
                  value={form.template_name} onChange={(e) => set("template_name", e.target.value)} />
              </div>

              <div className="adm-form-group">
                <label className="adm-label" htmlFor="ar-enabled">Status</label>
                <select id="ar-enabled" className="adm-input adm-select"
                  value={form.enabled ? "true" : "false"}
                  onChange={(e) => set("enabled", e.target.value === "true")}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              <div className="adm-form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="adm-label" htmlFor="ar-subject">Email subject</label>
                <input id="ar-subject" className="adm-input" type="text"
                  placeholder="e.g. Did you get a chance to look at your quote?"
                  value={form.subject} onChange={(e) => set("subject", e.target.value)} />
              </div>

              <div className="adm-form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="adm-label" htmlFor="ar-desc">Description (internal)</label>
                <input id="ar-desc" className="adm-input" type="text"
                  placeholder="Brief note on what this rule does and when"
                  value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="adm-form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="adm-label" htmlFor="ar-body">Body HTML (optional override)</label>
                <textarea id="ar-body" className="adm-textarea" style={{ minHeight: 120, fontFamily: "monospace" }}
                  placeholder="Leave blank to use the hardcoded template in lib/email.ts"
                  value={form.body_html} onChange={(e) => set("body_html", e.target.value)} />
              </div>
            </div>

            {error && <p className="adm-form-error" style={{ marginTop: "0.5rem" }}>{error}</p>}
          </div>

          <div className="adm-modal__footer">
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = TRIGGER_META[rule.trigger_event];
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    await onToggle();
    setToggling(false);
  }

  return (
    <div className={`auto-card${rule.enabled ? "" : " auto-card--disabled"}`}>
      {/* Left: trigger pill */}
      <div className="auto-card__trigger" style={{ borderColor: meta.color }}>
        <span className="auto-card__trigger-icon">{meta.icon}</span>
        <div>
          <div className="auto-card__trigger-label" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <div className="auto-card__delay">
            {fmtDelay(rule.delay_hours)}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div className="auto-card__arrow" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 10h12M12 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Center: rule info */}
      <div className="auto-card__body">
        <div className="auto-card__name">{rule.name}</div>
        {rule.description && (
          <div className="auto-card__desc">{rule.description}</div>
        )}
        <div className="auto-card__meta">
          <span className="auto-card__template">{rule.template_name}</span>
          <span className="auto-card__subject" title={rule.subject}>↳ {rule.subject}</span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="auto-card__controls">
        <button
          className={`auto-toggle${rule.enabled ? " auto-toggle--on" : ""}`}
          onClick={handleToggle}
          disabled={toggling}
          aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
          title={rule.enabled ? "Click to disable" : "Click to enable"}
        >
          <span className="auto-toggle__knob" />
        </button>
        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem" }}>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onEdit}>Edit</button>
          <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={onDelete}>Delete</button>
        </div>
        <div className="auto-card__updated">Updated {fmtDate(rule.updated_at)}</div>
      </div>
    </div>
  );
}

// ─── Main Automations Tab ─────────────────────────────────────────────────────

export function CrmAutomationsTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AutomationRule> | null | "new">(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/emails/automations");
      const json = await res.json() as { rules?: AutomationRule[] };
      setRules(json.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function handleToggle(rule: AutomationRule) {
    const res = await fetch(`/api/admin/emails/automations/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    const json = await res.json() as { rule?: AutomationRule };
    if (json.rule) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? json.rule! : r));
    }
  }

  async function handleDelete(rule: AutomationRule) {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/emails/automations/${rule.id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
  }

  function handleSave(saved: AutomationRule) {
    setRules((prev) => {
      const exists = prev.find((r) => r.id === saved.id);
      return exists ? prev.map((r) => r.id === saved.id ? saved : r) : [...prev, saved];
    });
    setEditing(null);
  }

  // Group rules by trigger group
  const groups: Record<string, AutomationRule[]> = {};
  for (const rule of rules) {
    const group = TRIGGER_META[rule.trigger_event]?.group ?? "Other";
    (groups[group] ??= []).push(rule);
  }
  const GROUP_ORDER = ["Instant", "Time-based", "Manual", "Other"];

  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="auto-tab">
      {/* Header row */}
      <div className="auto-header">
        <div>
          <h2 className="auto-header__title">Email Automations</h2>
          <p className="auto-header__sub">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
            {" · "}
            <span style={{ color: "#059669", fontWeight: 600 }}>{activeCount} active</span>
            {activeCount < rules.length && (
              <span style={{ color: "var(--color-ink-muted)" }}>
                {" · "}{rules.length - activeCount} disabled
              </span>
            )}
          </p>
        </div>
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing("new")}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6.5 1v11M1 6.5h11" />
          </svg>
          New rule
        </button>
      </div>

      {/* Legend */}
      <div className="auto-legend">
        {Object.entries(TRIGGER_META).map(([key, meta]) => (
          <span key={key} className="auto-legend__item">
            <span className="auto-legend__dot" style={{ background: meta.color }} />
            {meta.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="adm-spinner" />
      ) : rules.length === 0 ? (
        <div className="adm-empty">
          <p className="adm-empty__title">No automation rules</p>
          <p>Create your first rule to start automating emails.</p>
        </div>
      ) : (
        GROUP_ORDER.filter((g) => groups[g]?.length).map((group) => (
          <div key={group} className="auto-group">
            <div className="auto-group__header">
              <span className="auto-group__label">{group} triggers</span>
              <span className="auto-group__count">{groups[group].length}</span>
            </div>
            <div className="auto-group__cards">
              {groups[group].map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={() => handleToggle(rule)}
                  onEdit={() => setEditing(rule)}
                  onDelete={() => handleDelete(rule)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Form modal */}
      {editing !== null && (
        <RuleFormModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
