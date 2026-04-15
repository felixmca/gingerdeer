"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  pk?: boolean;
  fk?: string;
  generated?: boolean;
  unique?: boolean;
  default?: string;
  check?: string;
}

interface SchemaTable {
  name: string;
  comment: string;
  rlsPolicies: string[];
  columns: Column[];
}

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
}

// ── Static schema data ────────────────────────────────────────────────────────

const TABLES: SchemaTable[] = [
  {
    name: "leads",
    comment: "B2B funnel signups — written by anon visitors and updated after sign-up",
    rlsPolicies: [
      "anon → INSERT (open)",
      "authenticated → SELECT own (user_id = auth.uid())",
      "authenticated → UPDATE own",
    ],
    columns: [
      { name: "id",                       type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()" },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
      { name: "email",                    type: "text",          nullable: false },
      { name: "company",                  type: "text",          nullable: false },
      { name: "role",                     type: "text",          nullable: true },
      { name: "ingredients",              type: "text[]",        nullable: false, default: "'{}'" },
      { name: "frequency",                type: "text",          nullable: true,  check: "weekly|biweekly|monthly" },
      { name: "quantity_tier",            type: "text",          nullable: true,  check: "0.5|1.0|1.5|2.0" },
      { name: "team_size",                type: "int",           nullable: true },
      { name: "shots_per_drop",           type: "int",           nullable: false, default: "0" },
      { name: "bottles_per_drop",         type: "int",           nullable: false, default: "0" },
      { name: "shots_per_month",          type: "int",           nullable: false, default: "0" },
      { name: "bottles_per_month",        type: "int",           nullable: false, default: "0" },
      { name: "price_per_drop_ex_vat",    type: "numeric(10,2)", nullable: true },
      { name: "price_per_month_ex_vat",   type: "numeric(10,2)", nullable: true },
      { name: "vat_per_month",            type: "numeric(10,2)", nullable: true },
      { name: "total_per_month_inc_vat",  type: "numeric(10,2)", nullable: true },
      { name: "signup_complete",          type: "boolean",       nullable: false, default: "false" },
      { name: "user_id",                  type: "uuid",          nullable: true,  fk: "auth.users" },
      { name: "crm_status",               type: "text",          nullable: false, default: "'new'", check: "new|contacted|qualified|proposal|converted|lost" },
      { name: "crm_source",               type: "text",          nullable: true,  check: "landing_page|cold_outreach|referral|event|other" },
      { name: "assigned_to",              type: "uuid",          nullable: true,  fk: "auth.users" },
      { name: "last_contacted_at",        type: "timestamptz",   nullable: true },
    ],
  },
  {
    name: "ingredients",
    comment: "Product catalogue — one row per purchasable SKU (shot or share bottle)",
    rlsPolicies: [
      "anon + authenticated → SELECT (available = true)",
      "No client-side writes (service role only)",
    ],
    columns: [
      { name: "id",                       type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()" },
      { name: "slug",                     type: "text",          nullable: false, unique: true },
      { name: "name",                     type: "text",          nullable: false },
      { name: "format",                   type: "text",          nullable: false, check: "shot|share" },
      { name: "size_ml",                  type: "int",           nullable: false },
      { name: "servings_per_unit",        type: "int",           nullable: false, default: "1" },
      { name: "price_ex_vat",             type: "numeric(10,2)", nullable: false },
      { name: "price_per_serving_ex_vat", type: "numeric(10,2)", nullable: false, generated: true },
      { name: "unit_label",               type: "text",          nullable: false, default: "'unit'" },
      { name: "sort_order",               type: "int",           nullable: false, default: "0" },
      { name: "available",                type: "boolean",       nullable: false, default: "true" },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
    ],
  },
  {
    name: "subscriptions",
    comment: "Subscription plans created by authenticated users via the funnel",
    rlsPolicies: [
      "authenticated → SELECT own (user_id = auth.uid())",
      "Inserts via service role only",
    ],
    columns: [
      { name: "id",                       type: "uuid",          nullable: false, pk: true, default: "gen_random_uuid()" },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
      { name: "user_id",                  type: "uuid",          nullable: false, fk: "auth.users" },
      { name: "ingredients",              type: "text[]",        nullable: false, default: "'{}'" },
      { name: "frequency",                type: "text",          nullable: false, check: "weekly|biweekly|monthly" },
      { name: "team_size",                type: "int",           nullable: false, default: "1" },
      { name: "quantity_tier",            type: "text",          nullable: false, default: "'1'" },
      { name: "shots_per_drop",           type: "int",           nullable: false, default: "0" },
      { name: "bottles_per_drop",         type: "int",           nullable: false, default: "0" },
      { name: "shots_per_month",          type: "int",           nullable: false, default: "0" },
      { name: "bottles_per_month",        type: "int",           nullable: false, default: "0" },
      { name: "price_per_drop_ex_vat",    type: "numeric(10,2)", nullable: true },
      { name: "price_per_month_ex_vat",   type: "numeric(10,2)", nullable: true },
      { name: "vat_per_month",            type: "numeric(10,2)", nullable: true },
      { name: "total_per_month_inc_vat",  type: "numeric(10,2)", nullable: true },
      { name: "status",                   type: "text",          nullable: false, default: "'pending'", check: "pending|active|paused|cancelled" },
      { name: "lead_id",                  type: "uuid",          nullable: true,  fk: "leads" },
    ],
  },
  {
    name: "addresses",
    comment: "Billing and delivery addresses saved by authenticated users",
    rlsPolicies: ["authenticated → SELECT / INSERT / UPDATE / DELETE own"],
    columns: [
      { name: "id",         type: "uuid",        nullable: false, pk: true, default: "gen_random_uuid()" },
      { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      { name: "user_id",    type: "uuid",        nullable: false, fk: "auth.users" },
      { name: "type",       type: "text",        nullable: false, check: "billing|delivery" },
      { name: "label",      type: "text",        nullable: true },
      { name: "line1",      type: "text",        nullable: false },
      { name: "line2",      type: "text",        nullable: true },
      { name: "city",       type: "text",        nullable: false },
      { name: "postcode",   type: "text",        nullable: false },
      { name: "country",    type: "text",        nullable: false, default: "'GB'" },
      { name: "is_default", type: "boolean",     nullable: false, default: "false" },
    ],
  },
  {
    name: "lead_notes",
    comment: "CRM activity log — notes and touchpoints on leads",
    rlsPolicies: [
      "No direct client access (service role only)",
      "authenticated → SELECT (read-only via RLS)",
    ],
    columns: [
      { name: "id",         type: "uuid",        nullable: false, pk: true, default: "gen_random_uuid()" },
      { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      { name: "lead_id",    type: "uuid",        nullable: false, fk: "leads" },
      { name: "author_id",  type: "uuid",        nullable: false, fk: "auth.users" },
      { name: "note",       type: "text",        nullable: false },
      { name: "note_type",  type: "text",        nullable: false, default: "'note'", check: "note|call|email|status_change" },
    ],
  },
  {
    name: "email_logs",
    comment: "Record of every email sent by the system (automated + campaigns)",
    rlsPolicies: [
      "No direct client access (service role only)",
      "authenticated → SELECT (read-only via RLS)",
    ],
    columns: [
      { name: "id",            type: "uuid",        nullable: false, pk: true, default: "gen_random_uuid()" },
      { name: "created_at",    type: "timestamptz", nullable: false, default: "now()" },
      { name: "to_email",      type: "text",        nullable: false },
      { name: "to_user_id",    type: "uuid",        nullable: true,  fk: "auth.users" },
      { name: "to_lead_id",    type: "uuid",        nullable: true,  fk: "leads" },
      { name: "subject",       type: "text",        nullable: false },
      { name: "template_name", type: "text",        nullable: false },
      { name: "campaign_id",   type: "uuid",        nullable: true,  fk: "email_campaigns" },
      { name: "status",        type: "text",        nullable: false, default: "'sent'", check: "sent|failed" },
      { name: "metadata",      type: "jsonb",       nullable: false, default: "'{}'" },
    ],
  },
  {
    name: "email_campaigns",
    comment: "Admin-composed bulk email campaigns",
    rlsPolicies: [
      "No direct client access (service role only)",
      "authenticated → SELECT (read-only via RLS)",
    ],
    columns: [
      { name: "id",              type: "uuid",        nullable: false, pk: true, default: "gen_random_uuid()" },
      { name: "created_at",      type: "timestamptz", nullable: false, default: "now()" },
      { name: "name",            type: "text",        nullable: false },
      { name: "subject",         type: "text",        nullable: false },
      { name: "body_html",       type: "text",        nullable: false, default: "''" },
      { name: "target",          type: "text",        nullable: false, default: "'unconverted_leads'", check: "all_leads|unconverted_leads|active_users|pending_subs|custom" },
      { name: "status",          type: "text",        nullable: false, default: "'draft'", check: "draft|sent" },
      { name: "sent_at",         type: "timestamptz", nullable: true },
      { name: "sent_by",         type: "uuid",        nullable: true,  fk: "auth.users" },
      { name: "recipient_count", type: "int",         nullable: false, default: "0" },
    ],
  },
];

// ── Mermaid ER diagram definition ─────────────────────────────────────────────

const ER_DIAGRAM = `erDiagram
    auth_users {
        uuid id PK
        text email
        timestamptz created_at
        jsonb raw_user_meta_data
    }
    leads {
        uuid id PK
        text email
        text company
        text crm_status
        boolean signup_complete
        uuid user_id FK
        uuid assigned_to FK
    }
    subscriptions {
        uuid id PK
        uuid user_id FK
        uuid lead_id FK
        text status
        numeric total_per_month_inc_vat
    }
    addresses {
        uuid id PK
        uuid user_id FK
        text type
        boolean is_default
    }
    lead_notes {
        uuid id PK
        uuid lead_id FK
        uuid author_id FK
        text note_type
    }
    email_logs {
        uuid id PK
        text to_email
        uuid to_user_id FK
        uuid to_lead_id FK
        uuid campaign_id FK
        text status
    }
    email_campaigns {
        uuid id PK
        uuid sent_by FK
        text status
        text target
    }
    ingredients {
        uuid id PK
        text slug
        text format
        numeric price_ex_vat
        boolean available
    }

    auth_users ||--o{ leads : "user_id"
    auth_users ||--o{ leads : "assigned_to"
    auth_users ||--o{ subscriptions : "user_id"
    auth_users ||--o{ addresses : "user_id"
    auth_users ||--o{ lead_notes : "author_id"
    auth_users ||--o{ email_logs : "to_user_id"
    auth_users ||--o{ email_campaigns : "sent_by"
    leads      ||--o{ subscriptions  : "lead_id"
    leads      ||--o{ lead_notes     : "lead_id"
    leads      ||--o{ email_logs     : "to_lead_id"
    email_campaigns ||--o{ email_logs : "campaign_id"`;

// ── Mermaid renderer ──────────────────────────────────────────────────────────

function MermaidRenderer({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render(mermaid: MermaidApi) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          er: { diagramPadding: 48, layoutDirection: "TB", minEntityWidth: 120, minEntityHeight: 40 },
          themeVariables: {
            background: "#fffdf9",
            primaryColor: "#fef9f5",
            primaryBorderColor: "#d97706",
            primaryTextColor: "#1c1917",
            lineColor: "#c2410c",
            secondaryColor: "#f7f4ef",
            tertiaryColor: "#dbeafe",
            attributeBackgroundColorEven: "#fffdf9",
            attributeBackgroundColorOdd: "#f7f4ef",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "13px",
            edgeLabelBackground: "#fff9f5",
          },
        });
        const uid = "er-" + Math.random().toString(36).slice(2, 8);
        const { svg } = await mermaid.render(uid, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.setAttribute("width", "100%");
            svgEl.removeAttribute("height");
            svgEl.style.height = "auto";
            svgEl.style.maxWidth = "100%";
          }
          setStatus("done");
        }
      } catch (e) {
        if (!cancelled) {
          setErrMsg(String(e));
          setStatus("error");
        }
      }
    }

    const win = window as Window & { mermaid?: MermaidApi };

    if (win.mermaid) {
      render(win.mermaid);
      return () => { cancelled = true; };
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => { if (win.mermaid) render(win.mermaid); };
    script.onerror = () => {
      if (!cancelled) {
        setErrMsg("Could not load Mermaid from CDN. Check your internet connection.");
        setStatus("error");
      }
    };
    document.head.appendChild(script);

    return () => { cancelled = true; };
  }, [chart]);

  return (
    <div className="schema-er-wrap">
      {status === "loading" && (
        <div className="schema-er-loading">
          <div className="adm-spinner" />
          <span>Rendering diagram…</span>
        </div>
      )}
      {status === "error" && (
        <div className="schema-er-error">
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6" /><path d="M7.5 5v3.5M7.5 10.5v.5" />
          </svg>
          {errMsg}
        </div>
      )}
      <div
        ref={containerRef}
        className="schema-er-diagram"
        style={{ display: status === "done" ? "block" : "none" }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "uuid")                 return "schema-type--uuid";
  if (t.startsWith("text[]"))       return "schema-type--array";
  if (t === "text")                 return "schema-type--text";
  if (t === "int" || t === "integer") return "schema-type--int";
  if (t.startsWith("numeric"))      return "schema-type--numeric";
  if (t === "boolean")              return "schema-type--bool";
  if (t.startsWith("timestamptz"))  return "schema-type--ts";
  if (t === "jsonb" || t === "json") return "schema-type--json";
  return "schema-type--other";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SchemaViewer() {
  const [tab, setTab] = useState<"tables" | "er">("tables");
  // Lazy-mount the ER tab: once opened, keep mounted so Mermaid doesn't re-render
  const [erMounted, setErMounted] = useState(false);

  function switchTab(t: "tables" | "er") {
    setTab(t);
    if (t === "er") setErMounted(true);
  }

  return (
    <div className="schema-viewer">
      {/* Header */}
      <div className="schema-viewer__header">
        <div>
          <h1 className="schema-viewer__title">Database Schema</h1>
          <p className="schema-viewer__sub">
            7 tables &middot; public schema &middot; Supabase / PostgreSQL
          </p>
        </div>
        {tab === "tables" && (
          <div className="schema-legend">
            {[
              ["uuid", "schema-type--uuid"],
              ["text", "schema-type--text"],
              ["text[]", "schema-type--array"],
              ["int", "schema-type--int"],
              ["numeric", "schema-type--numeric"],
              ["boolean", "schema-type--bool"],
              ["timestamptz", "schema-type--ts"],
              ["jsonb", "schema-type--json"],
            ].map(([label, cls]) => (
              <span key={label} className={`schema-type ${cls}`}>{label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="adm-tabs schema-viewer__tabs">
        <button
          type="button"
          className={`adm-tabs__btn${tab === "tables" ? " adm-tabs__btn--active" : ""}`}
          onClick={() => switchTab("tables")}
        >
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" />
            <path d="M1 5.5h13M5 5.5v8" />
          </svg>
          Tables
        </button>
        <button
          type="button"
          className={`adm-tabs__btn${tab === "er" ? " adm-tabs__btn--active" : ""}`}
          onClick={() => switchTab("er")}
        >
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="1" y="1" width="5" height="4" rx="1" />
            <rect x="9" y="1" width="5" height="4" rx="1" />
            <rect x="5" y="10" width="5" height="4" rx="1" />
            <path d="M3.5 5v2.5H7.5M11.5 5v2.5H7.5M7.5 7.5V10" />
          </svg>
          ER Diagram
        </button>
      </div>

      {/* ── Tables tab ── */}
      <div style={{ display: tab === "tables" ? "block" : "none" }}>
        <div className="schema-ext-note">
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6" /><path d="M7.5 7v4M7.5 4.5v.5" />
          </svg>
          All tables have RLS enabled. API writes use the service role (bypasses RLS).{" "}
          <code>auth.users</code> is in Supabase&apos;s <code>auth</code> schema — shown
          below as an external reference.
        </div>

        <div className="schema-grid">
          {TABLES.map((table) => (
            <div key={table.name} className="schema-card">
              <div className="schema-card__header">
                <div className="schema-card__name-row">
                  <span className="schema-card__table-name">{table.name}</span>
                  <span className="schema-card__col-count">{table.columns.length} cols</span>
                </div>
                <p className="schema-card__comment">{table.comment}</p>
              </div>

              <div className="schema-card__cols">
                {table.columns.map((col) => (
                  <div key={col.name} className={`schema-col${col.pk ? " schema-col--pk" : ""}`}>
                    <span className="schema-col__name">
                      {col.pk && (
                        <svg width="10" height="10" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Primary key" className="schema-col__pk-icon">
                          <circle cx="5.5" cy="5.5" r="3.5" /><path d="M8.5 8.5l5 5M11 9.5l1.5 1.5M10 10.5l1.5 1.5" />
                        </svg>
                      )}
                      {col.name}
                    </span>
                    <div className="schema-col__right">
                      <span className={`schema-type ${typeClass(col.type)}`}>{col.type}</span>
                      {col.pk       && <span className="schema-badge schema-badge--pk">PK</span>}
                      {col.fk       && <span className="schema-badge schema-badge--fk">→ {col.fk}</span>}
                      {col.generated && <span className="schema-badge schema-badge--gen">generated</span>}
                      {col.unique && !col.pk && <span className="schema-badge schema-badge--unique">unique</span>}
                      {col.nullable
                        ? <span className="schema-badge schema-badge--null">null</span>
                        : <span className="schema-badge schema-badge--notnull">not null</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="schema-card__rls">
                <span className="schema-card__rls-label">RLS</span>
                <div className="schema-card__rls-policies">
                  {table.rlsPolicies.map((p) => (
                    <span key={p} className="schema-card__rls-policy">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* auth.users external reference card */}
        <div className="schema-ext-table">
          <div className="schema-card schema-card--external">
            <div className="schema-card__header">
              <div className="schema-card__name-row">
                <span className="schema-card__table-name">auth.users</span>
                <span className="schema-badge schema-badge--ext">external</span>
              </div>
              <p className="schema-card__comment">
                Supabase managed auth table — accessible via service role only
              </p>
            </div>
            <div className="schema-card__cols">
              {([
                { name: "id",                 type: "uuid",        pk: true  },
                { name: "email",              type: "text"                   },
                { name: "created_at",         type: "timestamptz"            },
                { name: "last_sign_in_at",    type: "timestamptz"            },
                { name: "raw_user_meta_data", type: "jsonb"                  },
              ] as Column[]).map((col) => (
                <div key={col.name} className={`schema-col${col.pk ? " schema-col--pk" : ""}`}>
                  <span className="schema-col__name">{col.name}</span>
                  <div className="schema-col__right">
                    <span className={`schema-type ${typeClass(col.type)}`}>{col.type}</span>
                    {col.pk && <span className="schema-badge schema-badge--pk">PK</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ER Diagram tab ── */}
      <div style={{ display: tab === "er" ? "block" : "none" }}>
        {erMounted && <MermaidRenderer chart={ER_DIAGRAM} />}
      </div>
    </div>
  );
}
