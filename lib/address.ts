export interface AddressRow {
  id: string;
  created_at: string;
  user_id: string;
  type: "billing" | "delivery";
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
  is_default: boolean;
}

/** "Main Office — 22 Tech St, London, EC1A 1BB" */
export function addressOneLiner(
  a: Pick<AddressRow, "label" | "line1" | "line2" | "city" | "postcode">
): string {
  const parts = [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ");
  return a.label ? `${a.label} — ${parts}` : parts;
}

/** Multi-line block for display */
export function addressBlock(
  a: Pick<AddressRow, "line1" | "line2" | "city" | "postcode">
): string {
  return [a.line1, a.line2, `${a.city}, ${a.postcode}`].filter(Boolean).join("\n");
}
