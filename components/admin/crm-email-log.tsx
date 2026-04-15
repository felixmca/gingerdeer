"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CrmAutomationsTab } from "@/components/admin/crm-automations";
// Styles are in app/globals.css under the "ADMIN CRM SHELL" section.

interface EmailLog {
  id: string;
  created_at: string;
  to_email: string;
  subject: string;
  template_name: string;
  status: "sent" | "failed";
}

interface Campaign {
  id: string;
  created_at: string;
  name: string;
  subject: string;
  target: string;
  status: "draft" | "sent";
  recipient_count: number | null;
  sent_at: string | null;
}

const LIMIT = 50;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TARGET_LABELS: Record<string, string> = {
  all_leads:        "All leads",
  unconverted_leads: "Unconverted leads",
  active_users:     "Active users",
  pending_subs:     "Pending subscriptions",
};


/* ──────────────────────────────────────────────────────────
   Log Tab
────────────────────────────────────────────────────────── */
function LogTab() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [template, setTemplate] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchEmails = useCallback(async (off: number, qv: string, tmpl: string, st: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: qv,
        template: tmpl,
        status: st,
        limit: String(LIMIT),
        offset: String(off),
      });
      const res = await fetch(`/api/admin/emails?${params}`);
      const data = await res.json() as { emails?: EmailLog[]; total?: number } | EmailLog[];
      if (Array.isArray(data)) {
        setEmails(data);
        setTotal(data.length);
      } else {
        setEmails(data.emails ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails(offset, q, template, status);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    setOffset(0);
    fetchEmails(0, q, template, status);
  }

  function goPage(newOffset: number) {
    setOffset(newOffset);
    fetchEmails(newOffset, q, template, status);
  }

  const page = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <>
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search recipient…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
        <input
          className="adm-search"
          type="search"
          placeholder="Template name…"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
        <select
          className="adm-select"
          value={status}
          onChange={(e) => { setStatus(e.target.value); }}
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <button className="adm-btn adm-btn--ghost" onClick={applyFilters}>
          Search
        </button>
      </div>

      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-spinner" />
        ) : emails.length === 0 ? (
          <div className="adm-empty">No emails found.</div>
        ) : (
          <>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Template</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</td>
                    <td>{e.to_email}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</td>
                    <td style={{ color: "var(--color-ink-muted)" }}>{e.template_name}</td>
                    <td>
                      <span className={`adm-badge adm-badge--${e.status}`}>{e.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="adm-pagination">
              <span>
                Page {page} of {totalPages} &middot; {total} total
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={offset === 0}
                  onClick={() => goPage(Math.max(0, offset - LIMIT))}
                >
                  ← Prev
                </button>
                <button
                  disabled={offset + LIMIT >= total}
                  onClick={() => goPage(offset + LIMIT)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Compose Modal
────────────────────────────────────────────────────────── */
function ComposeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [target, setTarget] = useState("all_leads");
  const [sendNow, setSendNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setFormError("Name, subject, and body are required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/emails/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body_html: bodyHtml, target, send_now: sendNow }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? "Failed to create campaign.");
      }
      onSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-modal__overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="adm-modal__box" role="dialog" aria-modal="true" aria-labelledby="compose-title">
        <div className="adm-modal__header">
          <h2 id="compose-title">New Campaign</h2>
          <button className="adm-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="adm-modal__body">
            <div className="adm-form-group">
              <label className="adm-label" htmlFor="c-name">Campaign name</label>
              <input
                id="c-name"
                className="adm-input"
                type="text"
                placeholder="e.g. April re-engagement"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label" htmlFor="c-subject">Subject line</label>
              <input
                id="c-subject"
                className="adm-input"
                type="text"
                placeholder="Your delivery is on its way…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label" htmlFor="c-body">Body HTML</label>
              <textarea
                id="c-body"
                className="adm-textarea"
                placeholder="<p>Hello {{first_name}},</p>…"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label" htmlFor="c-target">Target audience</label>
              <select
                id="c-target"
                className="adm-input adm-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="all_leads">All leads</option>
                <option value="unconverted_leads">Unconverted leads</option>
                <option value="active_users">Active users</option>
                <option value="pending_subs">Pending subscriptions</option>
              </select>
            </div>
            <label className="adm-checkbox-row">
              <input
                type="checkbox"
                checked={sendNow}
                onChange={(e) => setSendNow(e.target.checked)}
              />
              Send immediately after saving
            </label>
            {formError && <p className="adm-form-error">{formError}</p>}
          </div>
          <div className="adm-modal__footer">
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
              {submitting ? "Creating…" : sendNow ? "Send Campaign" : "Save Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Campaigns Tab
────────────────────────────────────────────────────────── */
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/emails/campaigns");
      const data = await res.json() as Campaign[] | { campaigns?: Campaign[] };
      setCampaigns(Array.isArray(data) ? data : data.campaigns ?? []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft campaign?")) return;
    await fetch(`/api/admin/emails/campaigns/${id}`, { method: "DELETE" });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function handleComposeSuccess() {
    setShowCompose(false);
    fetchCampaigns();
  }

  return (
    <>
      <div className="adm-toolbar">
        <span style={{ flex: 1 }} />
        <button className="adm-btn adm-btn--primary" onClick={() => setShowCompose(true)}>
          + New Campaign
        </button>
      </div>

      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-spinner" />
        ) : campaigns.length === 0 ? (
          <div className="adm-empty">No campaigns yet. Create one above.</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Target</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Sent At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.subject}
                  </td>
                  <td style={{ color: "var(--color-ink-muted)" }}>
                    {TARGET_LABELS[c.target] ?? c.target}
                  </td>
                  <td>
                    <span className={`adm-badge adm-badge--${c.status}`}>{c.status}</span>
                  </td>
                  <td>{c.recipient_count ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.sent_at ? fmtDateTime(c.sent_at) : "—"}
                  </td>
                  <td>
                    <div className="adm-action-btns">
                      <button
                        className="adm-btn adm-btn--ghost"
                        style={{ padding: "5px 12px", fontSize: "0.8125rem" }}
                        onClick={() => alert(`View campaign ${c.id} — not yet implemented`)}
                      >
                        View
                      </button>
                      {c.status === "draft" && (
                        <button
                          className="adm-btn adm-btn--danger"
                          style={{ padding: "5px 12px", fontSize: "0.8125rem" }}
                          onClick={() => handleDelete(c.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={handleComposeSuccess}
        />
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   Page
────────────────────────────────────────────────────────── */
export default function CrmEmailsPage() {
  const [tab, setTab] = useState<"log" | "campaigns" | "automations">("log");

  return (
    <>
      <div className="adm-page">
        <h1>Emails</h1>

        <div className="adm-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "log"}
            className={`adm-tabs__btn${tab === "log" ? " adm-tabs__btn--active" : ""}`}
            onClick={() => setTab("log")}
          >
            Log
          </button>
          <button
            role="tab"
            aria-selected={tab === "campaigns"}
            className={`adm-tabs__btn${tab === "campaigns" ? " adm-tabs__btn--active" : ""}`}
            onClick={() => setTab("campaigns")}
          >
            Campaigns
          </button>
          <button
            role="tab"
            aria-selected={tab === "automations"}
            className={`adm-tabs__btn${tab === "automations" ? " adm-tabs__btn--active" : ""}`}
            onClick={() => setTab("automations")}
          >
            Automations
          </button>
        </div>

        {tab === "log" && <LogTab />}
        {tab === "campaigns" && <CampaignsTab />}
        {tab === "automations" && <CrmAutomationsTab />}
      </div>
    </>
  );
}
