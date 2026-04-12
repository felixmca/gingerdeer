/**
 * Shared types and display metadata for subscriptions.
 * Used by both the subscription list page and the detail modal.
 */

import { FREQ_LABEL, INGREDIENT_META } from "./funnel-logic";

export type SubStatus = "pending" | "active" | "paused" | "cancelled";

export const STATUS_LABELS: Record<SubStatus, string> = {
  pending:   "Pending",
  active:    "Active",
  paused:    "Paused",
  cancelled: "Cancelled",
};

/** Full subscription row as returned by GET /api/subscription */
export interface SubRow {
  id: string;
  created_at: string;
  ingredients: string[];
  frequency: string;
  team_size: number;
  quantity_tier: string;
  shots_per_drop: number;
  bottles_per_drop: number;
  shots_per_month: number;
  bottles_per_month: number;
  price_per_drop_ex_vat: number | null;
  price_per_month_ex_vat: number | null;
  vat_per_month: number | null;
  total_per_month_inc_vat: number | null;
  status: SubStatus;
}

export const SLUG_META: Record<string, { name: string; accent: string; bg: string }> = {
  allinone_shot:            { name: "All-in-one",           accent: "#c2410c", bg: "#fff7ed" },
  allinone_share:           { name: "All-in-one",           accent: "#c2410c", bg: "#fff7ed" },
  lemon_ginger_honey_shot:  { name: "Lemon, Ginger, Honey", accent: "#ca8a04", bg: "#fefce8" },
  lemon_ginger_honey_share: { name: "Lemon, Ginger, Honey", accent: "#ca8a04", bg: "#fefce8" },
  apple_ginger_shot:        { name: "Apple Ginger",          accent: "#3f6212", bg: "#f7fee7" },
  apple_ginger_share:       { name: "Apple Ginger",          accent: "#3f6212", bg: "#f7fee7" },
  turmeric_shot:            { name: "Turmeric Boost",        accent: "#d97706", bg: "#fffbeb" },
  turmeric_share:           { name: "Turmeric Boost",        accent: "#d97706", bg: "#fffbeb" },
};

export function primaryMeta(ingredients: string[]) {
  for (const slug of ingredients) {
    const m = SLUG_META[slug];
    if (m) return m;
  }
  return { name: "Juice", accent: "#c2410c", bg: "#fff7ed" };
}

export function ingredientLabels(ingredients: string[]) {
  return ingredients
    .map((k) => INGREDIENT_META[k]?.label ?? k)
    .join(", ");
}

export { FREQ_LABEL };
