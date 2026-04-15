/**
 * Shared types and display metadata for subscriptions.
 * Used by the subscription list page and detail modal.
 */

import { FREQ_LABEL, INGREDIENT_META } from "./funnel-logic";

export type SubStatus = "checkout_draft" | "pending" | "active" | "paused" | "cancelled";

export const STATUS_LABELS: Record<SubStatus, string> = {
  checkout_draft: "Draft",
  pending:        "Pending",
  active:         "Active",
  paused:         "Paused",
  cancelled:      "Cancelled",
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
  // New canonical fields
  product_slug?: string | null;
  format?: "shot" | "share" | null;
  quantity_per_delivery?: number | null;
  preferred_day?: string | null;
}

export const SLUG_META: Record<string, { name: string; accent: string; bg: string }> = {
  // Current products
  classic_ginger_shot:  { name: "Classic Ginger",  accent: "#c2410c", bg: "#fff7ed" },
  classic_ginger_share: { name: "Classic Ginger",  accent: "#c2410c", bg: "#fff7ed" },
  green_citrus_shot:    { name: "Green Citrus",     accent: "#3f6212", bg: "#f7fee7" },
  green_citrus_share:   { name: "Green Citrus",     accent: "#3f6212", bg: "#f7fee7" },
  berry_beet_shot:      { name: "Berry Beet",       accent: "#9f1239", bg: "#fff1f2" },
  berry_beet_share:     { name: "Berry Beet",       accent: "#9f1239", bg: "#fff1f2" },
  golden_carrot_shot:   { name: "Golden Carrot",    accent: "#d97706", bg: "#fffbeb" },
  golden_carrot_share:  { name: "Golden Carrot",    accent: "#d97706", bg: "#fffbeb" },
  // Legacy product slugs (backward compat)
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
  // Prefer product_slug-derived meta first; fall back to first ingredient
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
