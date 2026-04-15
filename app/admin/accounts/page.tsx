import type { Metadata } from "next";
import CrmAccountsTable from "@/components/admin/crm-accounts-table";

export const metadata: Metadata = {
  title: "Accounts — CRM",
};

export default function AccountsPage() {
  return <CrmAccountsTable />;
}
