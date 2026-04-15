import type { Metadata } from "next";
import CrmReports from "@/components/admin/crm-reports";

export const metadata: Metadata = {
  title: "Reports — CRM",
};

export default function ReportsPage() {
  return <CrmReports />;
}
