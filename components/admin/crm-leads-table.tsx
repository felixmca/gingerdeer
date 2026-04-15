"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "converted"
  | "lost";

type LeadSource =
  | "landing_page"
  | "cold_outreach"
  | "referral"
  | "event"
  | "other";

interface Lead {
  id: string;
  created_at: string;
  email: string;
  company: string;
  role: string | null;
  ingredients: string[];
  frequency: string | null;
  quantity_tier: string | null;
  team_size: number | null;
  total_per_month_inc_vat: number | null;
  signup_complete: boolean;
  crm_status: LeadStatus;
  crm_source: LeadSource | null;
  last_contacted_at: string | null;
}

// Matches the lead_notes table columns returned by the API
interface LeadNote {
  id: string;
  created_at: string;
  note: string;          // API returns "note", not "body"
  note_type: "note" | "status_change" | "email_sent"; // API returns "note_type"
  author_id: string | null;
  author_email?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  converted: "Converted",
  lost: "Lost",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  landing_page: "Landing page",
  cold_outreach: "Cold outreach",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMrr(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(val);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`adm-badge adm-badge--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Note kind badge
// ---------------------------------------------------------------------------

function KindBadge({ kind }: { kind: LeadNote["note_type"] }) {
  const labels: Record<LeadNote["note_type"], string> = {
    note: "Note",
    status_change: "Status",
    email_sent: "Email",
  };
  return (
    <span
      className="adm-timeline__kind"
      data-kind={kind}
    >
      {labels[kind]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CrmLeadsTable() {
  // ---- List state ----------------------------------------------------------
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // ---- Drawer state --------------------------------------------------------
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerNotes, setDrawerNotes] = useState<LeadNote[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [patchLoading, setPatchLoading] = useState(false);

  // ---- Debounce ref --------------------------------------------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Fetch leads ---------------------------------------------------------
  const fetchLeads = useCallback(
    async (search: string, status: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (status) params.set("status", status);
        const res = await fetch(`/api/admin/leads?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch leads");
        const json = await res.json();
        setLeads(json.leads ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchLeads("", "");
  }, [fetchLeads]);

  // Debounced search re-fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLeads(q, statusFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, statusFilter, fetchLeads]);

  // ---- Open drawer ---------------------------------------------------------
  async function openDrawer(lead: Lead) {
    setSelectedLead(lead);
    setDrawerNotes([]);
    setNoteText("");
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`);
      if (!res.ok) throw new Error("Failed to fetch lead detail");
      const json = await res.json();
      setDrawerNotes(json.notes ?? []);
      // Update lead data in case anything changed server-side
      if (json.lead) {
        setSelectedLead(json.lead);
        setLeads((prev) =>
          prev.map((l) => (l.id === json.lead.id ? json.lead : l))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedLead(null);
    setDrawerNotes([]);
    setNoteText("");
  }

  // ---- Patch status --------------------------------------------------------
  async function patchStatus(id: string, crm_status: LeadStatus) {
    setPatchLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crm_status }),
      });
      if (!res.ok) throw new Error("PATCH failed");
      const json = await res.json();
      if (json.lead) {
        setSelectedLead(json.lead);
        setLeads((prev) =>
          prev.map((l) => (l.id === json.lead.id ? json.lead : l))
        );
      }
      // Refresh notes so the status_change note appears
      const notesRes = await fetch(`/api/admin/leads/${id}`);
      if (notesRes.ok) {
        const nd = await notesRes.json();
        setDrawerNotes(nd.notes ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPatchLoading(false);
    }
  }

  // ---- Mark contacted ------------------------------------------------------
  async function markContacted() {
    if (!selectedLead) return;
    setPatchLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crm_status: "contacted",
          last_contacted_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("PATCH failed");
      const json = await res.json();
      if (json.lead) {
        setSelectedLead(json.lead);
        setLeads((prev) =>
          prev.map((l) => (l.id === json.lead.id ? json.lead : l))
        );
      }
      const notesRes = await fetch(`/api/admin/leads/${selectedLead.id}`);
      if (notesRes.ok) {
        const nd = await notesRes.json();
        setDrawerNotes(nd.notes ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPatchLoading(false);
    }
  }

  // ---- Add note ------------------------------------------------------------
  async function addNote() {
    if (!selectedLead || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim(), note_type: "note" }),
      });
      if (!res.ok) throw new Error("POST failed");
      const json = await res.json();
      if (json.note) {
        setDrawerNotes((prev) => [json.note, ...prev]);
      }
      setNoteText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="adm-page">
      {/* Toolbar */}
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search company, email, role…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search leads"
        />
        <select
          className="adm-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Table */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-empty">
            <span className="adm-spinner" aria-label="Loading" />
          </div>
        ) : leads.length === 0 ? (
          <div className="adm-empty">No leads found.</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Source</th>
                <th>Team size</th>
                <th>MRR</th>
                <th>Converted?</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => openDrawer(lead)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{fmtDate(lead.created_at)}</td>
                  <td>{lead.company || "—"}</td>
                  <td>{lead.email}</td>
                  <td>
                    <StatusBadge status={lead.crm_status} />
                  </td>
                  <td>
                    {lead.crm_source
                      ? SOURCE_LABELS[lead.crm_source]
                      : "—"}
                  </td>
                  <td>{lead.team_size ?? "—"}</td>
                  <td>{fmtMrr(lead.total_per_month_inc_vat)}</td>
                  <td>{lead.signup_complete ? "Yes" : "No"}</td>
                  <td>
                    <button
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDrawer(lead);
                      }}
                      aria-label={`Open detail for ${lead.company}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer overlay */}
      <div
        className={`adm-drawer-overlay${selectedLead ? " adm-drawer-overlay--open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`adm-drawer${selectedLead ? " adm-drawer--open" : ""}`}
        aria-label="Lead detail"
      >
        {selectedLead && (
          <>
            {/* Header */}
            <div className="adm-drawer__header">
              <div>
                <strong>{selectedLead.company || "—"}</strong>
                <br />
                <span style={{ fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
                  {selectedLead.email}
                </span>
              </div>
              <button
                className="adm-drawer__close"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="adm-drawer__body">
              {/* Status control */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">CRM Status</span>
                <select
                  className="adm-select"
                  value={selectedLead.crm_status}
                  disabled={patchLoading}
                  onChange={(e) =>
                    patchStatus(selectedLead.id, e.target.value as LeadStatus)
                  }
                  aria-label="Change CRM status"
                >
                  {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Last contacted */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Last contacted</span>
                <span className="adm-drawer__value">
                  {fmtDate(selectedLead.last_contacted_at)}
                </span>
              </div>

              {/* Key info */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Frequency</span>
                <span className="adm-drawer__value">
                  {selectedLead.frequency ?? "—"}
                </span>
              </div>
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Team size</span>
                <span className="adm-drawer__value">
                  {selectedLead.team_size ?? "—"}
                </span>
              </div>
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">MRR (inc. VAT)</span>
                <span className="adm-drawer__value">
                  {fmtMrr(selectedLead.total_per_month_inc_vat)}
                </span>
              </div>
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Signup complete</span>
                <span className="adm-drawer__value">
                  {selectedLead.signup_complete ? "Yes" : "No"}
                </span>
              </div>
              {selectedLead.ingredients?.length > 0 && (
                <div className="adm-drawer__section">
                  <span className="adm-drawer__label">Ingredients</span>
                  <span className="adm-drawer__value">
                    {selectedLead.ingredients.join(", ")}
                  </span>
                </div>
              )}

              {/* Mark contacted button */}
              <div className="adm-drawer__section">
                <button
                  className="adm-btn adm-btn--primary adm-btn--sm"
                  onClick={markContacted}
                  disabled={patchLoading}
                >
                  {patchLoading ? "Saving…" : "Mark Contacted"}
                </button>
              </div>

              {/* Activity timeline */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Activity</span>
                {drawerLoading ? (
                  <span className="adm-spinner" aria-label="Loading notes" />
                ) : drawerNotes.length === 0 ? (
                  <p style={{ color: "var(--color-ink-muted)", fontSize: "0.8125rem", margin: 0 }}>
                    No activity yet.
                  </p>
                ) : (
                  <ul className="adm-timeline">
                    {drawerNotes.map((n) => (
                      <li key={n.id} className="adm-timeline__item">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <KindBadge kind={n.note_type} />
                          <time
                            dateTime={n.created_at}
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-ink-muted)",
                            }}
                          >
                            {fmtDate(n.created_at)}
                          </time>
                          {n.author_email && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--color-ink-muted)",
                              }}
                            >
                              · {n.author_email}
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.875rem",
                            color: "var(--color-ink)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {n.note}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Add note form */}
              <div className="adm-note-form">
                <span className="adm-drawer__label">Add note</span>
                <textarea
                  className="adm-search"
                  rows={3}
                  placeholder="Write a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={savingNote}
                  style={{ resize: "vertical", fontFamily: "var(--font-sans)" }}
                  aria-label="Note text"
                />
                <button
                  className="adm-btn adm-btn--primary adm-btn--sm"
                  onClick={addNote}
                  disabled={savingNote || !noteText.trim()}
                >
                  {savingNote ? "Saving…" : "Add Note"}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
