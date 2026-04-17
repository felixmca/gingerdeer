/**
 * lib/prospects.ts
 * TypeScript types and helpers for the prospecting + marketing engine.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Audience category definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryMeta {
  key: string;
  label: string;
  description: string;
  example_sub_categories: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    key: "mum",
    label: "Mum",
    description: "Upscale hospitality & culture — galleries, private members clubs, fine dining, boutique hotels, arts venues",
    example_sub_categories: ["gallery", "private_members_club", "arts_venue", "fine_dining", "boutique_hotel"],
  },
  {
    key: "dad",
    label: "Dad",
    description: "Corporate offices & professional services — law firms, finance, tech companies, HR & office managers",
    example_sub_categories: ["law_firm", "hedge_fund", "tech_office", "consultancy", "coworking", "corporate_hq"],
  },
  {
    key: "flame",
    label: "Flame",
    description: "Universities & campus life — student unions, events teams, campus cafés, sports clubs",
    example_sub_categories: ["university", "student_society", "student_union", "campus_cafe", "sports_club"],
  },
  {
    key: "candice",
    label: "Candice",
    description: "Nightlife & entertainment — bars, comedy clubs, music venues, nightclubs, event promoters",
    example_sub_categories: ["comedy_club", "nightclub", "cocktail_bar", "pub", "music_venue", "event_promoter"],
  },
  {
    key: "grandad",
    label: "Grandad",
    description: "Leisure & wellness — golf clubs, tennis clubs, spas, gyms, yoga studios, leisure centres",
    example_sub_categories: ["golf_club", "tennis_club", "spa", "gym", "yoga_studio", "leisure_centre"],
  },
];

export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.key, c]));
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
);

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle stages
// ─────────────────────────────────────────────────────────────────────────────

export type LifecycleStage = "contact" | "opportunity" | "lead" | "customer" | "suppressed";

export const LIFECYCLE_STAGES: { key: LifecycleStage; label: string; description: string }[] = [
  { key: "contact",     label: "Contact",     description: "Sourced — in the marketing database" },
  { key: "opportunity", label: "Opportunity", description: "Clicked a tracked CTA in a campaign email" },
  { key: "lead",        label: "Lead",        description: "Created a pending subscription or added to basket" },
  { key: "customer",    label: "Customer",    description: "Paid for a subscription or one-off order" },
  { key: "suppressed",  label: "Suppressed",  description: "Excluded from all sends" },
];

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = Object.fromEntries(
  LIFECYCLE_STAGES.map((s) => [s.key, s.label])
) as Record<LifecycleStage, string>;

// ─────────────────────────────────────────────────────────────────────────────
// Contact status (deliverability / suppression)
// ─────────────────────────────────────────────────────────────────────────────

export type ContactStatus =
  | "active"
  | "unsubscribed"
  | "bounced"
  | "invalid"
  | "do_not_contact"
  | "review_needed";

export const STATUS_LABELS: Record<ContactStatus, string> = {
  active:          "Active",
  unsubscribed:    "Unsubscribed",
  bounced:         "Bounced",
  invalid:         "Invalid",
  do_not_contact:  "Do not contact",
  review_needed:   "Needs review",
};

export const SENDABLE_STATUSES: ContactStatus[] = ["active"];

// ─────────────────────────────────────────────────────────────────────────────
// Source types
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual:      "Manual entry",
  csv_import:  "CSV import",
  ai_extract:  "AI extract",
  web_scrape:  "Web scrape",
  linkedin:    "LinkedIn",
  referral:    "Referral",
};

// ─────────────────────────────────────────────────────────────────────────────
// Database types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProspectContact {
  id:                   string;
  created_at:           string;
  updated_at:           string;
  // Identity
  name:                 string | null;
  email:                string;
  role:                 string | null;
  organisation:         string | null;
  website:              string | null;
  phone:                string | null;
  // Location
  city:                 string | null;
  borough:              string | null;
  country:              string;
  // Segmentation
  category:             string;
  sub_category:         string | null;
  tags:                 string[];
  // Source
  source_type:          string;
  source_url:           string | null;
  source_domain:        string | null;
  acquisition_method:   string | null;
  source_raw:           string | null;
  // Email metadata
  email_type:           string | null;
  email_confidence:     number | null;
  email_verified:       boolean;
  email_verified_at:    string | null;
  // Lifecycle
  lifecycle_stage:      LifecycleStage;
  lifecycle_updated_at: string;
  last_campaign_id:     string | null;
  // Status
  status:               ContactStatus;
  // Quality
  quality_score:        number;
  reviewed:             boolean;
  reviewed_by:          string | null;
  reviewed_at:          string | null;
  // CRM links
  lead_id:              string | null;
  user_id:              string | null;
  // Notes
  notes:                string | null;
  // Dedupe
  email_hash:           string;
  domain_hash:          string | null;
}

export type ProspectContactInsert = Omit<ProspectContact,
  "id" | "created_at" | "updated_at" | "reviewed" | "reviewed_by" | "reviewed_at" |
  "email_verified" | "email_verified_at" | "lifecycle_updated_at" | "lifecycle_stage" |
  "quality_score" | "status" | "lead_id" | "user_id"
> & Partial<Pick<ProspectContact,
  "lifecycle_stage" | "quality_score" | "status" | "lead_id" | "user_id"
>>;

// ─────────────────────────────────────────────────────────────────────────────
// Campaign types (extended)
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id:                   string;
  created_at:           string;
  name:                 string;
  subject:              string;
  body_html:            string;
  preview_text:         string | null;
  // Legacy target (leads_only sends)
  target:               string;
  // New prospect targeting
  campaign_type:        "prospect_only" | "leads_only" | "mixed";
  category_filter:      string[];
  lifecycle_filter:     string[];
  sub_category_filter:  string[];
  // CTA config
  cta_label:            string | null;
  cta_url:              string | null;
  secondary_cta_label:  string | null;
  secondary_cta_url:    string | null;
  // UTM
  utm_campaign:         string | null;
  // Status
  status:               "draft" | "sent";
  sent_at:              string | null;
  sent_by:              string | null;
  recipient_count:      number;
  // Aggregated stats
  click_count:          number;
  open_count:           number;
  conversion_count:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical dedupe key: lowercase trimmed email */
export function emailHash(email: string): string {
  return email.toLowerCase().trim();
}

/** Extract domain part of an email for company-level grouping */
export function emailDomainHash(email: string): string {
  const at = email.indexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase().trim();
}

/** Heuristic quality score (0–100) for a new contact record */
export function computeQualityScore(fields: {
  name?: string | null;
  role?: string | null;
  organisation?: string | null;
  website?: string | null;
  phone?: string | null;
  source_url?: string | null;
  email_confidence?: number | null;
}): number {
  let score = 30; // base
  if (fields.name?.trim())         score += 15;
  if (fields.role?.trim())         score += 10;
  if (fields.organisation?.trim()) score += 15;
  if (fields.website?.trim())      score += 5;
  if (fields.phone?.trim())        score += 5;
  if (fields.source_url?.trim())   score += 10;
  if ((fields.email_confidence ?? 0) >= 0.8) score += 10;
  return Math.min(score, 100);
}

/** Check whether a contact is eligible to receive campaign emails */
export function isSendable(contact: Pick<ProspectContact, "status" | "lifecycle_stage">): boolean {
  return (
    SENDABLE_STATUSES.includes(contact.status) &&
    contact.lifecycle_stage !== "suppressed"
  );
}

/** Build the tracked CTA URL for embedding in campaign emails */
export function buildTrackingUrl(
  appUrl: string,
  trackingToken: string,
  slot: "primary" | "secondary" | "unsubscribe"
): string {
  return `${appUrl}/api/track/click/${trackingToken}?slot=${slot}`;
}
