import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { isSendable } from "@/lib/prospects";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}

/**
 * GET /api/admin/campaigns/[id]/preview
 *
 * Resolve and return the recipient list for a campaign WITHOUT sending.
 * Used by the admin UI to show "X contacts will receive this" before confirming send.
 *
 * Returns:
 *   { count, sample: ProspectContact[] (first 20), filters_applied }
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { data: campaign, error: campErr } = await service
    .from("email_campaigns")
    .select("id, campaign_type, category_filter, lifecycle_filter, sub_category_filter, status")
    .eq("id", id)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const recipients = await resolveProspectRecipients(service, campaign);

  return NextResponse.json({
    count:            recipients.length,
    sample:           recipients.slice(0, 20),
    filters_applied: {
      category_filter:     campaign.category_filter ?? [],
      lifecycle_filter:    campaign.lifecycle_filter ?? [],
      sub_category_filter: campaign.sub_category_filter ?? [],
    },
  });
}

// ── Shared resolver ──────────────────────────────────────────────────────────

type CampaignFilters = {
  campaign_type:        string;
  category_filter:      string[];
  lifecycle_filter:     string[];
  sub_category_filter:  string[];
};

type ServiceClient = ReturnType<typeof import("@/lib/supabase/service").createServiceClient>;

export async function resolveProspectRecipients(
  service: ServiceClient,
  campaign: CampaignFilters,
): Promise<{ id: string; email: string; name: string | null; contact_id: string }[]> {
  let query = service
    .from("prospect_contacts")
    .select("id, email, name, status, lifecycle_stage")
    .eq("status", "active");

  if (campaign.category_filter?.length > 0) {
    query = query.in("category", campaign.category_filter);
  }
  if (campaign.lifecycle_filter?.length > 0) {
    query = query.in("lifecycle_stage", campaign.lifecycle_filter);
  }
  if (campaign.sub_category_filter?.length > 0) {
    query = query.in("sub_category", campaign.sub_category_filter);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((c) => isSendable({ status: c.status, lifecycle_stage: c.lifecycle_stage }))
    .map((c) => ({ id: c.id, email: c.email, name: c.name, contact_id: c.id }));
}
