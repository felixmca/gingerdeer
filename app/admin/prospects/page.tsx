import type { Metadata } from "next";
import { CrmProspectsPage } from "@/components/admin/crm-prospects";

export const metadata: Metadata = {
  title: "Prospects — CRM",
};

export default function ProspectsPage() {
  return <CrmProspectsPage />;
}
