/**
 * Shared admin utilities.
 * All functions in this file are server-side only.
 */

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

// ── CRM types ─────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "converted"
  | "lost";

export type LeadSource =
  | "landing_page"
  | "cold_outreach"
  | "referral"
  | "event"
  | "other";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal Sent",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  landing_page: "Landing Page",
  cold_outreach: "Cold Outreach",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#6366f1",
  contacted: "#0ea5e9",
  qualified: "#f59e0b",
  proposal: "#8b5cf6",
  converted: "#22c55e",
  lost: "#ef4444",
};

export interface CRMLead {
  id: string;
  created_at: string;
  email: string;
  company: string;
  role: string | null;
  ingredients: string[];
  frequency: string | null;
  quantity_tier: string | null;
  team_size: number | null;
  shots_per_drop: number;
  bottles_per_drop: number;
  shots_per_month: number;
  bottles_per_month: number;
  price_per_drop_ex_vat: number | null;
  price_per_month_ex_vat: number | null;
  vat_per_month: number | null;
  total_per_month_inc_vat: number | null;
  signup_complete: boolean;
  user_id: string | null;
  // CRM extension columns
  crm_status: LeadStatus;
  crm_source: LeadSource | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
}

export interface CRMNote {
  id: string;
  created_at: string;
  lead_id: string;
  author_id: string;
  author_email: string;
  note: string;
  note_type: "note" | "call" | "email" | "status_change";
}

export interface CRMContact {
  id: string; // auth.users id
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  subscription_count: number;
  active_subscription: boolean;
  mrr: number;
  lead_id: string | null;
  lead_company: string | null;
}

export interface CRMAccount {
  company: string;
  lead_count: number;
  contact_count: number;
  pipeline_mrr: number;
  best_status: LeadStatus;
  latest_activity: string;
}

export interface EmailLog {
  id: string;
  created_at: string;
  to_email: string;
  to_user_id: string | null;
  to_lead_id: string | null;
  subject: string;
  template_name: string;
  campaign_id: string | null;
  status: "sent" | "failed";
  metadata: Record<string, unknown>;
}

export interface EmailCampaign {
  id: string;
  created_at: string;
  name: string;
  subject: string;
  body_html: string;
  target: "all_leads" | "unconverted_leads" | "active_users" | "pending_subs" | "custom";
  status: "draft" | "sent";
  sent_at: string | null;
  sent_by: string | null;
  recipient_count: number;
}

export interface ReportMetrics {
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  pipeline_mrr: number;
  active_mrr: number;
  total_contacts: number;
  pending_subs: number;
  active_subs: number;
  emails_sent_30d: number;
}
