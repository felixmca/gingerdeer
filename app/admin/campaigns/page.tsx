import type { Metadata } from "next";
import { CrmCampaignsPage } from "@/components/admin/crm-campaigns";

export const metadata: Metadata = {
  title: "Campaigns — CRM",
};

export default function CampaignsPage() {
  return <CrmCampaignsPage />;
}
