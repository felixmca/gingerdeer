import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { resolveProspectRecipients } from "@/lib/campaign-recipients";
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
    .select("id, campaign_type, category_filter, lifecycle_filter, sub_category_filter, list_ids, status")
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
      list_ids:            campaign.list_ids ?? [],
    },
  });
}

