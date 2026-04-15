import type { Metadata } from "next";
import SchemaViewer from "@/components/admin/schema-viewer";

export const metadata: Metadata = {
  title: "Schema — CRM",
};

export default function SchemaPage() {
  return <SchemaViewer />;
}
