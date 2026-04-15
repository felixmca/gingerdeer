import type { Metadata } from "next";
import CrmEmailsPage from "@/components/admin/crm-email-log";

export const metadata: Metadata = {
  title: "Emails — CRM",
};

export default function EmailsPage() {
  return <CrmEmailsPage />;
}
