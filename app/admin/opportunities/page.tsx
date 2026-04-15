import type { Metadata } from "next";
import CrmOpportunities from "@/components/admin/crm-opportunities";

export const metadata: Metadata = {
  title: "Opportunities — CRM",
};

export default function OpportunitiesPage() {
  return <CrmOpportunities />;
}
