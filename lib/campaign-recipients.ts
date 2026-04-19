import { isSendable } from "@/lib/prospects";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type CampaignFilters = {
  campaign_type:        string;
  category_filter:      string[];
  lifecycle_filter:     string[];
  sub_category_filter:  string[];
  list_ids?:            string[];
};

export async function resolveProspectRecipients(
  service: ServiceClient,
  campaign: CampaignFilters,
): Promise<{ id: string; email: string; name: string | null; contact_id: string }[]> {

  // List-based targeting
  if (campaign.list_ids && campaign.list_ids.length > 0) {
    const { data: members } = await service
      .from("prospect_list_members")
      .select("contact_id, prospect_contacts(id, email, name, status, lifecycle_stage)")
      .in("list_id", campaign.list_ids);

    if (!members) return [];
    return members
      .filter((m) => {
        const c = (m.prospect_contacts as unknown) as { status: string; lifecycle_stage: string } | null;
        return c && isSendable({ status: c.status as "active" | "unsubscribed" | "bounced" | "invalid" | "do_not_contact" | "review_needed", lifecycle_stage: c.lifecycle_stage as "pre_opp" | "opp" | "lead" | "customer" | "suppressed" });
      })
      .map((m) => {
        const c = (m.prospect_contacts as unknown) as { id: string; email: string; name: string | null };
        return { id: c.id, email: c.email, name: c.name, contact_id: c.id };
      });
  }

  // Filter-based targeting
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
