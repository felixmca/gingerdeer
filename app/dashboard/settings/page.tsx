import { createClient } from "@/lib/supabase/server";
import { DbSettingsPage } from "@/components/db-settings-page";

export const metadata = { title: "Settings — Juice for Teams" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const initialDisplayName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";

  return <DbSettingsPage initialDisplayName={initialDisplayName} email={email} />;
}
