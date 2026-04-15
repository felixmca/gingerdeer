import type { Metadata } from "next";
import AiQuery from "@/components/admin/ai-query";

export const metadata: Metadata = {
  title: "Query — CRM",
};

export default function QueryPage() {
  return <AiQuery />;
}
