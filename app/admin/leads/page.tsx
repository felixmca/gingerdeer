import type { Metadata } from "next";
import { CrmLeadsTable } from "@/components/admin/crm-leads-table";

export const metadata: Metadata = {
  title: "Leads — CRM",
};

export default function LeadsPage() {
  return <CrmLeadsTable />;
}
