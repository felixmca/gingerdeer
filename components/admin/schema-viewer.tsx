"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  pk?: boolean;
  fk?: string;           // "table_name" or "schema.table_name" for external
  generated?: boolean;
  unique?: boolean;
  default?: string;
  check?: string;
  important?: boolean;   // shown in collapsed ER card
}

interface SchemaTable {
  name: string;
  comment: string;
  rlsPolicies: string[];
  columns: Column[];
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
      { name: "id",                       type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
      { name: "email",                    type: "text",          nullable: false, important: true },
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
      { name: "user_id",                  type: "uuid",          nullable: true,  fk: "auth.users", important: true },
      { name: "crm_status",               type: "text",          nullable: false, default: "'new'", check: "new|contacted|qualified|proposal|converted|lost", important: true },
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
      { name: "id",                       type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "slug",                     type: "text",          nullable: false, unique: true, important: true },
      { name: "name",                     type: "text",          nullable: false, important: true },
      { name: "format",                   type: "text",          nullable: false, check: "shot|share", important: true },
      { name: "size_ml",                  type: "int",           nullable: false },
      { name: "servings_per_unit",        type: "int",           nullable: false, default: "1" },
      { name: "price_ex_vat",             type: "numeric(10,2)", nullable: false, important: true },
      { name: "price_per_serving_ex_vat", type: "numeric(10,2)", nullable: false, generated: true },
      { name: "unit_label",               type: "text",          nullable: false, default: "'unit'" },
      { name: "sort_order",               type: "int",           nullable: false, default: "0" },
      { name: "available",                type: "boolean",       nullable: false, default: "true" },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
    ],
  },
  {
    name: "subscriptions",
    comment: "Subscription plans created by authenticated users via the checkout wizard",
    rlsPolicies: [
      "authenticated → SELECT own (user_id = auth.uid())",
      "Inserts via service role only",
    ],
    columns: [
      { name: "id",                       type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",               type: "timestamptz",   nullable: false, default: "now()" },
      { name: "user_id",                  type: "uuid",          nullable: false, fk: "auth.users", important: true },
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
      { name: "total_per_month_inc_vat",  type: "numeric(10,2)", nullable: true, important: true },
      { name: "status",                   type: "text",          nullable: false, default: "'pending'", check: "pending|active|paused|cancelled", important: true },
      { name: "lead_id",                  type: "uuid",          nullable: true,  fk: "leads" },
      { name: "stripe_customer_id",       type: "text",          nullable: true },
      { name: "stripe_subscription_id",   type: "text",          nullable: true },
      { name: "stripe_checkout_session_id", type: "text",        nullable: true },
      { name: "current_period_end",       type: "timestamptz",   nullable: true },
    ],
  },
  {
    name: "addresses",
    comment: "Billing and delivery addresses saved by authenticated users",
    rlsPolicies: ["authenticated → SELECT / INSERT / UPDATE / DELETE own"],
    columns: [
      { name: "id",         type: "uuid",        nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      { name: "user_id",    type: "uuid",        nullable: false, fk: "auth.users", important: true },
      { name: "type",       type: "text",        nullable: false, check: "billing|delivery", important: true },
      { name: "label",      type: "text",        nullable: true },
      { name: "line1",      type: "text",        nullable: false },
      { name: "line2",      type: "text",        nullable: true },
      { name: "city",       type: "text",        nullable: false },
      { name: "postcode",   type: "text",        nullable: false },
      { name: "country",    type: "text",        nullable: false, default: "'GB'" },
      { name: "is_default", type: "boolean",     nullable: false, default: "false", important: true },
    ],
  },
  {
    name: "orders",
    comment: "One-off item orders created alongside checkout — added to first Stripe invoice",
    rlsPolicies: [
      "authenticated → SELECT own (user_id = auth.uid())",
      "Inserts via service role only",
    ],
    columns: [
      { name: "id",                         type: "uuid",          nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",                 type: "timestamptz",   nullable: false, default: "now()" },
      { name: "user_id",                    type: "uuid",          nullable: false, fk: "auth.users", important: true },
      { name: "items",                      type: "jsonb",         nullable: false, default: "'[]'" },
      { name: "subtotal_ex_vat",            type: "numeric(10,2)", nullable: false },
      { name: "vat",                        type: "numeric(10,2)", nullable: false },
      { name: "total_inc_vat",              type: "numeric(10,2)", nullable: false, important: true },
      { name: "status",                     type: "text",          nullable: false, default: "'pending'", check: "pending|paid|cancelled", important: true },
      { name: "stripe_checkout_session_id", type: "text",          nullable: true },
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
      { name: "id",         type: "uuid",        nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      { name: "lead_id",    type: "uuid",        nullable: false, fk: "leads", important: true },
      { name: "author_id",  type: "uuid",        nullable: false, fk: "auth.users" },
      { name: "note",       type: "text",        nullable: false, important: true },
      { name: "note_type",  type: "text",        nullable: false, default: "'note'", check: "note|call|email|status_change", important: true },
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
      { name: "id",            type: "uuid",        nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",    type: "timestamptz", nullable: false, default: "now()" },
      { name: "to_email",      type: "text",        nullable: false, important: true },
      { name: "to_user_id",    type: "uuid",        nullable: true,  fk: "auth.users" },
      { name: "to_lead_id",    type: "uuid",        nullable: true,  fk: "leads", important: true },
      { name: "subject",       type: "text",        nullable: false },
      { name: "template_name", type: "text",        nullable: false, important: true },
      { name: "campaign_id",   type: "uuid",        nullable: true,  fk: "email_campaigns" },
      { name: "status",        type: "text",        nullable: false, default: "'sent'", check: "sent|failed", important: true },
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
      { name: "id",              type: "uuid",        nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",      type: "timestamptz", nullable: false, default: "now()" },
      { name: "name",            type: "text",        nullable: false, important: true },
      { name: "subject",         type: "text",        nullable: false },
      { name: "body_html",       type: "text",        nullable: false, default: "''" },
      { name: "target",          type: "text",        nullable: false, default: "'unconverted_leads'", check: "all_leads|unconverted_leads|active_users|pending_subs|custom", important: true },
      { name: "status",          type: "text",        nullable: false, default: "'draft'", check: "draft|sent", important: true },
      { name: "sent_at",         type: "timestamptz", nullable: true },
      { name: "sent_by",         type: "uuid",        nullable: true,  fk: "auth.users" },
      { name: "recipient_count", type: "int",         nullable: false, default: "0" },
    ],
  },
  {
    name: "email_automation_rules",
    comment: "DB-driven automation config — defines when and how follow-up emails are triggered",
    rlsPolicies: [
      "No direct client access (service role only)",
    ],
    columns: [
      { name: "id",            type: "uuid",        nullable: false, pk: true,  default: "gen_random_uuid()", important: true },
      { name: "created_at",    type: "timestamptz", nullable: false, default: "now()" },
      { name: "name",          type: "text",        nullable: false, important: true },
      { name: "trigger_event", type: "text",        nullable: false, important: true },
      { name: "delay_hours",   type: "int",         nullable: false, default: "0" },
      { name: "template_name", type: "text",        nullable: false },
      { name: "is_active",     type: "boolean",     nullable: false, default: "true", important: true },
      { name: "conditions",    type: "jsonb",       nullable: true },
    ],
  },
];

// ── ER diagram column layout ───────────────────────────────────────────────────
//
// Layout is chosen so all internal FK lines are horizontal (no same-column loops):
//   Col 0 (dependents)     Col 1 (hubs)       Col 2 (standalone)
//   lead_notes             leads              subscriptions
//   email_logs             email_campaigns    orders
//   email_automation_rules ingredients        addresses
//
// Internal FK lines:
//   lead_notes   → leads           (col 0 → col 1)
//   email_logs   → leads           (col 0 → col 1)
//   email_logs   → email_campaigns (col 0 → col 1)
//   subscriptions → leads          (col 2 → col 1)

const ER_LAYOUT: string[][] = [
  ["lead_notes", "email_logs", "email_automation_rules"],
  ["leads", "email_campaigns", "ingredients"],
  ["subscriptions", "orders", "addresses"],
];

// Precomputed: column index for each table name
const COL_IDX: Record<string, number> = {};
ER_LAYOUT.forEach((col, i) => col.forEach(n => { COL_IDX[n] = i; }));

// Precomputed: all internal FK lines to draw
const LINE_SPECS: Array<{ from: string; to: string; col: string }> = [];
for (const table of TABLES) {
  for (const col of table.columns) {
    if (col.fk && !col.fk.includes(".")) {
      LINE_SPECS.push({ from: table.name, to: col.fk, col: col.name });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "uuid")                   return "schema-type--uuid";
  if (t.startsWith("text[]"))         return "schema-type--array";
  if (t === "text")                   return "schema-type--text";
  if (t === "int" || t === "integer") return "schema-type--int";
  if (t.startsWith("numeric"))        return "schema-type--numeric";
  if (t === "boolean")                return "schema-type--bool";
  if (t.startsWith("timestamptz"))    return "schema-type--ts";
  if (t === "jsonb" || t === "json")  return "schema-type--json";
  return "schema-type--other";
}

function isExternal(fk: string) {
  return fk.includes(".");
}

function buildIncomingMap(tables: SchemaTable[]) {
  const map: Record<string, Array<{ fromTable: string; fromCol: string }>> = {};
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.fk && !isExternal(col.fk)) {
        if (!map[col.fk]) map[col.fk] = [];
        map[col.fk].push({ fromTable: table.name, fromCol: col.name });
      }
    }
  }
  return map;
}

// ── Legend data ────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { badge: "PK",  cls: "er-badge--pk",  desc: "Primary key — unique row identifier" },
  { badge: "FK",  cls: "er-badge--fk",  desc: "Foreign key — references another table in this schema" },
  { badge: "ext", cls: "er-badge--ext", desc: "External FK — references auth.users (Supabase-managed)" },
  { badge: "UQ",  cls: "er-badge--uq",  desc: "Unique constraint" },
  { badge: "gen", cls: "er-badge--gen", desc: "Generated / computed column" },
];

// ── SVG line colours ───────────────────────────────────────────────────────────

// Each FK line gets a distinct colour for readability
const LINE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
function lineColor(idx: number) {
  return LINE_COLORS[idx % LINE_COLORS.length];
}

// ── Interactive ER Diagram ────────────────────────────────────────────────────

interface SvgLine {
  d: string;
  key: string;
  label: string;
  color: string;
}

function InteractiveERDiagram({ tables, layout }: { tables: SchemaTable[]; layout: string[][] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [svgLines, setSvgLines] = useState<SvgLine[]>([]);

  // Refs for DOM measurement
  const gridRef  = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hdRefs   = useRef<Map<string, HTMLButtonElement>>(new Map());

  const incoming = buildIncomingMap(tables);
  const tableMap = Object.fromEntries(tables.map(t => [t.name, t]));

  // ── Line geometry ────────────────────────────────────────────────────────────
  const recalcLines = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const gRect = grid.getBoundingClientRect();
    if (!gRect.width) return;

    const lines: SvgLine[] = [];

    LINE_SPECS.forEach((spec, idx) => {
      const fromCard = cardRefs.current.get(spec.from);
      const toCard   = cardRefs.current.get(spec.to);
      if (!fromCard || !toCard) return;

      const fromHd = hdRefs.current.get(spec.from);
      const toHd   = hdRefs.current.get(spec.to);

      const fC = fromCard.getBoundingClientRect();
      const tC = toCard.getBoundingClientRect();
      const fH = fromHd?.getBoundingClientRect() ?? fC;
      const tH = toHd?.getBoundingClientRect()   ?? tC;

      // All positions relative to the grid container
      const fLeft   = fC.left   - gRect.left;
      const fRight  = fC.right  - gRect.left;
      const fTop    = fC.top    - gRect.top;
      const fBottom = fC.bottom - gRect.top;
      const fMidX   = (fLeft + fRight) / 2;
      const fHdMidY = (fH.top + fH.bottom) / 2 - gRect.top;

      const tLeft   = tC.left   - gRect.left;
      const tRight  = tC.right  - gRect.left;
      const tTop    = tC.top    - gRect.top;
      const tBottom = tC.bottom - gRect.top;
      const tMidX   = (tLeft + tRight) / 2;
      const tHdMidY = (tH.top + tH.bottom) / 2 - gRect.top;

      const fromColI = COL_IDX[spec.from] ?? 0;
      const toColI   = COL_IDX[spec.to]   ?? 0;

      let d: string;

      if (fromColI === toColI) {
        // Same column — loop out the left side
        const loopX = Math.min(fLeft, tLeft) - 36;
        let x1: number, y1: number, x2: number, y2: number;
        if (fTop > tTop) {
          // from card is below to card — exit top, enter bottom
          x1 = fMidX; y1 = fTop;
          x2 = tMidX; y2 = tBottom;
        } else {
          // from card is above to card — exit bottom, enter top
          x1 = fMidX; y1 = fBottom;
          x2 = tMidX; y2 = tTop;
        }
        d = `M ${f(x1)} ${f(y1)} C ${f(loopX)} ${f(y1)}, ${f(loopX)} ${f(y2)}, ${f(x2)} ${f(y2)}`;
      } else if (fromColI > toColI) {
        // From is right of to — exit left edge, enter right edge
        const x1 = fLeft,  y1 = fHdMidY;
        const x2 = tRight, y2 = tHdMidY;
        const dx = (x1 - x2) * 0.45;
        d = `M ${f(x1)} ${f(y1)} C ${f(x1 - dx)} ${f(y1)}, ${f(x2 + dx)} ${f(y2)}, ${f(x2)} ${f(y2)}`;
      } else {
        // From is left of to — exit right edge, enter left edge
        const x1 = fRight, y1 = fHdMidY;
        const x2 = tLeft,  y2 = tHdMidY;
        const dx = (x2 - x1) * 0.45;
        d = `M ${f(x1)} ${f(y1)} C ${f(x1 + dx)} ${f(y1)}, ${f(x2 - dx)} ${f(y2)}, ${f(x2)} ${f(y2)}`;
      }

      lines.push({
        d,
        key:   `${spec.from}.${spec.col}→${spec.to}`,
        label: `${spec.from}.${spec.col} → ${spec.to}`,
        color: lineColor(idx),
      });
    });

    setSvgLines(lines);
  }, []); // reads from refs only — no reactive deps needed

  // Recalc after expand/collapse (card heights change)
  useEffect(() => {
    const t = setTimeout(recalcLines, 60);
    return () => clearTimeout(t);
  }, [expanded, recalcLines]);

  // Recalc on mount + window resize
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    recalcLines();
    const ro = new ResizeObserver(recalcLines);
    ro.observe(grid);
    window.addEventListener("resize", recalcLines);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalcLines);
    };
  }, [recalcLines]);

  const toggle = (name: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div className="er-wrap">

      {/* Legend */}
      <div className="er-legend">
        <span className="er-legend__title">Legend</span>
        {LEGEND_ITEMS.map(item => (
          <span key={item.badge} className="er-legend-item">
            <span className={`er-badge ${item.cls}`}>{item.badge}</span>
            <span className="er-legend-item__desc">{item.desc}</span>
          </span>
        ))}
        <span className="er-legend-item">
          <span className="er-null-pill">?</span>
          <span className="er-legend-item__desc">Nullable field</span>
        </span>
        <span className="er-legend-item">
          <svg width="28" height="10" viewBox="0 0 28 10" fill="none" aria-hidden="true">
            <line x1="0" y1="5" x2="22" y2="5" stroke="#6366f1" strokeWidth="1.5" />
            <path d="M18,2 L26,5 L18,8 z" fill="#6366f1" />
          </svg>
          <span className="er-legend-item__desc">FK relationship line</span>
        </span>
      </div>

      {/* Toolbar */}
      <div className="er-toolbar">
        <span className="er-toolbar__hint">Click any table to expand all fields</span>
        <div className="er-toolbar__btns">
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            onClick={() => setExpanded(new Set(tables.map(t => t.name)))}
          >
            Expand all
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            onClick={() => setExpanded(new Set())}
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Grid + SVG overlay wrapper */}
      <div className="er-grid-wrap" ref={gridRef}>

        {/* SVG relationship lines — sits behind the card grid */}
        <svg className="er-svg" aria-hidden="true">
          <defs>
            {LINE_SPECS.map((_, idx) => (
              <marker
                key={idx}
                id={`er-arr-${idx}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,1 L0,7 L8,4 z" fill={lineColor(idx)} />
              </marker>
            ))}
          </defs>
          {svgLines.map((line, idx) => (
            <g key={line.key}>
              <path
                d={line.d}
                fill="none"
                stroke={line.color}
                strokeWidth="1.5"
                strokeOpacity="0.7"
                markerEnd={`url(#er-arr-${idx})`}
              >
                <title>{line.label}</title>
              </path>
            </g>
          ))}
        </svg>

        {/* Cards */}
        <div className="er-grid">
          {layout.map((col, ci) => (
            <div key={ci} className="er-col">
              {col.map(tableName => {
                const table = tableMap[tableName];
                if (!table) return null;
                const isExp = expanded.has(tableName);
                const shownCols = isExp
                  ? table.columns
                  : table.columns.filter(c => c.important);
                const hiddenCount = isExp ? 0 : table.columns.length - shownCols.length;
                const refs = incoming[tableName] ?? [];

                return (
                  <div
                    key={tableName}
                    ref={el => { if (el) cardRefs.current.set(tableName, el); else cardRefs.current.delete(tableName); }}
                    className={`er-card${isExp ? " er-card--exp" : ""}`}
                  >
                    {/* Header */}
                    <button
                      ref={el => { if (el) hdRefs.current.set(tableName, el); else hdRefs.current.delete(tableName); }}
                      className="er-card__hd"
                      onClick={() => toggle(tableName)}
                    >
                      <div className="er-card__hd-left">
                        <span className="er-card__name">{tableName}</span>
                        <span className="er-card__schema-pill">public</span>
                      </div>
                      <div className="er-card__hd-right">
                        <span className="er-card__col-count">{table.columns.length} cols</span>
                        <svg
                          className={`er-card__chevron${isExp ? " er-card__chevron--open" : ""}`}
                          width="12" height="12" viewBox="0 0 15 15" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M3 5.5l4.5 4.5 4.5-4.5" />
                        </svg>
                      </div>
                    </button>

                    {/* Description (expanded only) */}
                    {isExp && (
                      <p className="er-card__desc">{table.comment}</p>
                    )}

                    {/* Fields */}
                    <div className="er-fields">
                      {shownCols.map(col => (
                        <div key={col.name} className="er-field">
                          {/* Badges */}
                          <div className="er-field__badges">
                            {col.pk && (
                              <span className="er-badge er-badge--pk" title="Primary key">PK</span>
                            )}
                            {col.fk && isExternal(col.fk) && (
                              <span className="er-badge er-badge--ext" title={`→ ${col.fk}`}>ext</span>
                            )}
                            {col.fk && !isExternal(col.fk) && (
                              <span className="er-badge er-badge--fk" title={`→ ${col.fk}`}>FK</span>
                            )}
                            {col.unique && !col.pk && (
                              <span className="er-badge er-badge--uq" title="Unique">UQ</span>
                            )}
                            {col.generated && (
                              <span className="er-badge er-badge--gen" title="Generated column">gen</span>
                            )}
                          </div>

                          {/* Name */}
                          <span className={`er-field__name${col.nullable ? " er-field__name--null" : ""}`}>
                            {col.name}
                            {col.nullable && (
                              <span className="er-null-pill" title="Nullable">?</span>
                            )}
                          </span>

                          {/* Right side — type + details */}
                          <div className="er-field__right">
                            <span className="er-field__type">{col.type}</span>
                            {isExp && col.fk && (
                              <span className="er-field__ref">→ {col.fk}</span>
                            )}
                            {isExp && col.default && (
                              <span className="er-field__default">default: {col.default}</span>
                            )}
                            {isExp && col.check && (
                              <span className="er-field__check">{col.check}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* "+N more" row */}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          className="er-field er-field--more"
                          onClick={() => toggle(tableName)}
                        >
                          + {hiddenCount} more fields
                        </button>
                      )}

                      {/* Incoming FK references (expanded only) */}
                      {isExp && refs.length > 0 && (
                        <div className="er-incoming">
                          <span className="er-incoming__label">Referenced by</span>
                          <div className="er-incoming__ref">
                            {refs.map(ref => (
                              <div key={`${ref.fromTable}.${ref.fromCol}`} className="er-incoming__col">
                                <button
                                  type="button"
                                  onClick={() => toggle(ref.fromTable)}
                                  title={`${ref.fromTable}.${ref.fromCol} → ${tableName}.id`}
                                >
                                  {ref.fromTable}
                                  <span style={{ opacity: 0.6 }}>.{ref.fromCol}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* RLS policies (expanded only) */}
                      {isExp && table.rlsPolicies.length > 0 && (
                        <div className="er-rls">
                          <span className="er-rls__label">RLS</span>
                          {table.rlsPolicies.map(p => (
                            <div key={p} className="er-rls__policy">{p}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* auth.users — external managed table */}
      <div className="er-auth-section">
        <div className="er-card er-card--auth">
          <div className="er-card__hd er-card__hd--static">
            <div className="er-card__hd-left">
              <span className="er-card__name">users</span>
              <span className="er-card__schema-pill er-card__schema-pill--auth">auth</span>
            </div>
            <div className="er-card__hd-right">
              <span className="er-card__col-count">Supabase-managed · service role only</span>
            </div>
          </div>
          <p className="er-card__desc">
            Supabase&apos;s built-in auth table. Not in the <code>public</code> schema —
            not directly queryable from the client. All <span className="er-badge er-badge--ext">ext</span> FK badges in the diagram above reference this table.
          </p>
          <div className="er-fields">
            {[
              { name: "id",                 type: "uuid",        pk: true  },
              { name: "email",              type: "text"                   },
              { name: "created_at",         type: "timestamptz"            },
              { name: "raw_user_meta_data", type: "jsonb"                  },
            ].map(col => (
              <div key={col.name} className="er-field">
                <div className="er-field__badges">
                  {col.pk && <span className="er-badge er-badge--pk">PK</span>}
                </div>
                <span className="er-field__name">{col.name}</span>
                <div className="er-field__right">
                  <span className="er-field__type">{col.type}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="er-incoming">
            <span className="er-incoming__label">Referenced by (ext FK)</span>
            <div className="er-incoming__ref">
              {[
                "leads.user_id", "leads.assigned_to",
                "subscriptions.user_id",
                "orders.user_id",
                "addresses.user_id",
                "lead_notes.author_id",
                "email_logs.to_user_id",
                "email_campaigns.sent_by",
              ].map(ref => (
                <div key={ref} className="er-incoming__col">
                  <span className="er-auth-ref">{ref}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Derived views — not real DB tables */}
      <div className="er-derived-note">
        <strong>Derived CRM views (no physical DB table)</strong>{" "}
        &mdash; these routes query existing tables at runtime:
        <span className="er-derived-note__item">
          <code>/admin/contacts</code> — <code>auth.users</code> joined with <code>subscriptions</code>
        </span>
        <span className="er-derived-note__item">
          <code>/admin/accounts</code> — <code>leads</code> grouped by <code>company</code> field
        </span>
      </div>
    </div>
  );
}

// tiny helper — round to 1 decimal place for compact SVG path strings
function f(n: number) { return n.toFixed(1); }

// ── Main component ────────────────────────────────────────────────────────────

export default function SchemaViewer() {
  const [tab, setTab] = useState<"tables" | "er">("tables");

  return (
    <div className="schema-viewer">
      {/* Header */}
      <div className="schema-viewer__header">
        <div>
          <h1 className="schema-viewer__title">Database Schema</h1>
          <p className="schema-viewer__sub">
            9 tables &middot; public schema &middot; Supabase / PostgreSQL
          </p>
        </div>
        {tab === "tables" && (
          <div className="schema-legend">
            {[
              ["uuid",        "schema-type--uuid"],
              ["text",        "schema-type--text"],
              ["text[]",      "schema-type--array"],
              ["int",         "schema-type--int"],
              ["numeric",     "schema-type--numeric"],
              ["boolean",     "schema-type--bool"],
              ["timestamptz", "schema-type--ts"],
              ["jsonb",       "schema-type--json"],
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
          className={`adm-tab${tab === "tables" ? " adm-tab--active" : ""}`}
          onClick={() => setTab("tables")}
        >
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" />
            <path d="M1 5.5h13M5 5.5v8" />
          </svg>
          Tables
        </button>
        <button
          type="button"
          className={`adm-tab${tab === "er" ? " adm-tab--active" : ""}`}
          onClick={() => setTab("er")}
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
                { name: "id",                 type: "uuid",        pk: true,  nullable: false },
                { name: "email",              type: "text",                   nullable: true },
                { name: "created_at",         type: "timestamptz",            nullable: false },
                { name: "last_sign_in_at",    type: "timestamptz",            nullable: true },
                { name: "raw_user_meta_data", type: "jsonb",                  nullable: false },
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
        <InteractiveERDiagram tables={TABLES} layout={ER_LAYOUT} />
      </div>
    </div>
  );
}
