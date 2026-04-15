"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string; // auth user id
  email: string;
  full_name?: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  subscription_status?: string | null; // active | pending | null  (kept for spec compat)
  active_subscription?: boolean;       // what the API actually returns
  subscription_count?: number;
  total_per_month_inc_vat?: number | null;
  mrr?: number | null;                 // what the API actually returns
  company?: string;                    // from linked lead (spec field)
  lead_company?: string | null;        // what the API actually returns
  lead_id?: string | null;
}

interface Subscription {
  id: string;
  status: string | null;
  total_per_month_inc_vat: number | null;
  frequency: string | null;
  ingredients?: string[];
  created_at: string;
}

interface Address {
  id: string;
  type: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

interface EmailLog {
  id: string;
  created_at: string;
  subject: string | null;
  template_slug: string | null;
  status: string | null;
}

interface DrawerData {
  contact: Contact;
  subscriptions: Subscription[];
  addresses: Address[];
  lead: Record<string, unknown> | null;
  emailHistory: EmailLog[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMrr(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(val);
}

// Normalise contacts so both API shapes work
function normaliseContact(c: Contact): Contact {
  return {
    ...c,
    company: c.company ?? c.lead_company ?? "—",
    subscription_status: c.subscription_status ?? (c.active_subscription ? "active" : null),
    total_per_month_inc_vat: c.total_per_month_inc_vat ?? c.mrr ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sub-status badge
// ---------------------------------------------------------------------------

function SubBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <span className="adm-badge" style={{ background: "#f5f5f4", color: "#78716c" }}>None</span>;
  }
  const s = status.toLowerCase();
  if (s === "active") {
    return <span className="adm-badge adm-badge--converted">Active</span>;
  }
  if (s === "pending") {
    return <span className="adm-badge adm-badge--proposal">Pending</span>;
  }
  return <span className="adm-badge adm-badge--new">{status}</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CrmContactsTable() {
  // ---- List state ----------------------------------------------------------
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // ---- Drawer state --------------------------------------------------------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // ---- Fetch all contacts on mount ----------------------------------------
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const json = await res.json();
      setContacts((json.contacts ?? []).map(normaliseContact));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ---- Client-side search filter ------------------------------------------
  const filtered =
    q.trim() === ""
      ? contacts
      : contacts.filter((c) => {
          const needle = q.toLowerCase();
          return (
            c.email.toLowerCase().includes(needle) ||
            (c.company ?? "").toLowerCase().includes(needle) ||
            (c.full_name ?? "").toLowerCase().includes(needle)
          );
        });

  // ---- Open drawer ---------------------------------------------------------
  async function openDrawer(contact: Contact) {
    setSelectedId(contact.id);
    setDrawerData(null);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/admin/contacts/${contact.id}`);
      if (!res.ok) throw new Error("Failed to fetch contact detail");
      const json = await res.json();

      // The API returns: { user, subscriptions, addresses, lead, emails }
      const enrichedContact = normaliseContact({
        id: json.user?.id ?? contact.id,
        email: json.user?.email ?? contact.email,
        full_name: json.user?.user_metadata?.full_name ?? contact.full_name,
        created_at: json.user?.created_at ?? contact.created_at,
        last_sign_in_at: json.user?.last_sign_in_at ?? contact.last_sign_in_at,
        active_subscription: (json.subscriptions ?? []).some(
          (s: Subscription) => s.status === "active"
        ),
        mrr: (() => {
          const active = (json.subscriptions ?? []).find(
            (s: Subscription) => s.status === "active"
          );
          return active?.total_per_month_inc_vat ?? null;
        })(),
        lead_company: json.lead?.company ?? contact.lead_company,
        lead_id: json.lead?.id ?? contact.lead_id,
      });

      setDrawerData({
        contact: enrichedContact,
        subscriptions: json.subscriptions ?? [],
        addresses: json.addresses ?? [],
        lead: json.lead ?? null,
        emailHistory: json.emails ?? [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDrawerData(null);
  }

  const drawerOpen = selectedId !== null;

  // ---- Render --------------------------------------------------------------
  return (
    <div className="adm-page">
      {/* Toolbar */}
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search email, name, company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search contacts"
        />
      </div>

      {/* Table */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-empty">
            <span className="adm-spinner" aria-label="Loading" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">No contacts found.</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Date joined</th>
                <th>Email</th>
                <th>Company</th>
                <th>Sub status</th>
                <th>MRR</th>
                <th>Last sign-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => openDrawer(contact)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{fmtDate(contact.created_at)}</td>
                  <td>{contact.email}</td>
                  <td>{contact.company || "—"}</td>
                  <td>
                    <SubBadge status={contact.subscription_status} />
                  </td>
                  <td>{fmtMrr(contact.total_per_month_inc_vat)}</td>
                  <td>{fmtDate(contact.last_sign_in_at)}</td>
                  <td>
                    <button
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDrawer(contact);
                      }}
                      aria-label={`View contact ${contact.email}`}
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
        className={`adm-drawer-overlay${drawerOpen ? " adm-drawer-overlay--open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`adm-drawer${drawerOpen ? " adm-drawer--open" : ""}`}
        aria-label="Contact detail"
      >
        {drawerLoading && (
          <div className="adm-empty" style={{ height: "100%" }}>
            <span className="adm-spinner" aria-label="Loading contact" />
          </div>
        )}

        {!drawerLoading && drawerData && (
          <>
            {/* Header */}
            <div className="adm-drawer__header">
              <div>
                <strong>
                  {drawerData.contact.full_name || drawerData.contact.email}
                </strong>
                {drawerData.contact.full_name && (
                  <>
                    <br />
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--color-ink-muted)",
                      }}
                    >
                      {drawerData.contact.email}
                    </span>
                  </>
                )}
              </div>
              <button
                className="adm-drawer__close"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>

            <div className="adm-drawer__body">
              {/* User info */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">User info</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem 1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-ink-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Joined
                    </div>
                    <div style={{ fontSize: "0.875rem" }}>
                      {fmtDate(drawerData.contact.created_at)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-ink-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Last sign-in
                    </div>
                    <div style={{ fontSize: "0.875rem" }}>
                      {fmtDate(drawerData.contact.last_sign_in_at)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-ink-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Company
                    </div>
                    <div style={{ fontSize: "0.875rem" }}>
                      {drawerData.contact.company || "—"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-ink-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "0.2rem",
                      }}
                    >
                      User ID
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        color: "var(--color-ink-muted)",
                        wordBreak: "break-all",
                      }}
                    >
                      {drawerData.contact.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscriptions */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">
                  Subscriptions ({drawerData.subscriptions.length})
                </span>
                {drawerData.subscriptions.length === 0 ? (
                  <p
                    style={{
                      color: "var(--color-ink-muted)",
                      fontSize: "0.8125rem",
                      margin: "0.5rem 0 0",
                    }}
                  >
                    No subscriptions.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "0.5rem 0 0",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {drawerData.subscriptions.map((sub) => (
                      <li
                        key={sub.id}
                        style={{
                          background: "var(--color-bg)",
                          borderRadius: "var(--radius)",
                          padding: "0.75rem",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.375rem",
                          }}
                        >
                          <SubBadge status={sub.status} />
                          <strong style={{ fontSize: "0.875rem" }}>
                            {fmtMrr(sub.total_per_month_inc_vat)}
                            <span
                              style={{
                                color: "var(--color-ink-muted)",
                                fontWeight: 400,
                              }}
                            >
                              /mo
                            </span>
                          </strong>
                        </div>
                        {sub.frequency && (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--color-ink-muted)",
                            }}
                          >
                            Frequency: {sub.frequency}
                          </div>
                        )}
                        {sub.ingredients && sub.ingredients.length > 0 && (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--color-ink-muted)",
                              marginTop: "0.25rem",
                            }}
                          >
                            Ingredients: {sub.ingredients.join(", ")}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-ink-muted)",
                            marginTop: "0.25rem",
                          }}
                        >
                          Since {fmtDate(sub.created_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Addresses */}
              {drawerData.addresses.length > 0 && (
                <div className="adm-drawer__section">
                  <span className="adm-drawer__label">
                    Addresses ({drawerData.addresses.length})
                  </span>
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "0.5rem 0 0",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {drawerData.addresses.map((addr) => (
                      <li
                        key={addr.id}
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--color-ink)",
                          background: "var(--color-bg)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius)",
                          padding: "0.625rem 0.75rem",
                        }}
                      >
                        {addr.type && (
                          <div
                            style={{
                              fontSize: "0.6875rem",
                              color: "var(--color-ink-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {addr.type}
                          </div>
                        )}
                        <div>
                          {[
                            addr.line1,
                            addr.line2,
                            addr.city,
                            addr.postcode,
                            addr.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linked lead */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">Linked lead</span>
                {drawerData.lead ? (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius)",
                      padding: "0.625rem 0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        {String(drawerData.lead.company ?? "—")}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--color-ink-muted)",
                          marginTop: "0.2rem",
                        }}
                      >
                        Status:{" "}
                        {String(drawerData.lead.crm_status ?? "—")}
                      </div>
                    </div>
                    <a
                      href={`/admin/leads?id=${drawerData.lead.id}`}
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open lead
                    </a>
                  </div>
                ) : (
                  <p
                    style={{
                      color: "var(--color-ink-muted)",
                      fontSize: "0.8125rem",
                      margin: "0.5rem 0 0",
                    }}
                  >
                    No linked lead.
                  </p>
                )}
              </div>

              {/* Email history */}
              <div className="adm-drawer__section">
                <span className="adm-drawer__label">
                  Email history ({drawerData.emailHistory.length})
                </span>
                {drawerData.emailHistory.length === 0 ? (
                  <p
                    style={{
                      color: "var(--color-ink-muted)",
                      fontSize: "0.8125rem",
                      margin: "0.5rem 0 0",
                    }}
                  >
                    No emails sent yet.
                  </p>
                ) : (
                  <ul className="adm-timeline" style={{ marginTop: "0.5rem" }}>
                    {drawerData.emailHistory.map((email) => (
                      <li key={email.id} className="adm-timeline__item">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <span
                            className="adm-timeline__kind"
                            data-kind="email_sent"
                          >
                            Email
                          </span>
                          <time
                            dateTime={email.created_at}
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-ink-muted)",
                            }}
                          >
                            {fmtDatetime(email.created_at)}
                          </time>
                          {email.status && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--color-ink-muted)",
                              }}
                            >
                              · {email.status}
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.875rem",
                            color: "var(--color-ink)",
                          }}
                        >
                          {email.subject ?? email.template_slug ?? "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
