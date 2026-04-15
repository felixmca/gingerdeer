import type { Metadata } from "next";
import { CrmContactsTable } from "@/components/admin/crm-contacts-table";

export const metadata: Metadata = {
  title: "Contacts — CRM",
};

export default function ContactsPage() {
  return <CrmContactsTable />;
}
