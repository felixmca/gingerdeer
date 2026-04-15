/**
 * Canonical product catalogue for Juice for Teams.
 * Each product has two purchasable SKUs: shot (100ml) and share (1L bottle).
 * These replace the old allinone / lemon_ginger_honey / apple_ginger / turmeric products.
 */

import {
  SHOT_PRICE_EX_VAT,
  BOTTLE_PRICE_EX_VAT,
  VAT_RATE,
  FREQ_DELIVERIES_PER_MONTH,
  type Frequency,
} from "./funnel-logic";

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  copy: string;
  ingredientsList: string[];
  accent: string;
  bg: string;
  sortOrder: number;
}

export const PRODUCTS: Product[] = [
  {
    slug: "classic_ginger",
    name: "Classic Ginger",
    tagline: "Invigorate",
    description:
      "A bold, spicy ginger classic made to wake up the palate and sharpen the senses.",
    copy: "A sharp ginger kick with citrus lift and warming spice. Classic Ginger is our no-nonsense invigorating blend — bright, fiery, and made to get you going.",
    ingredientsList: ["Ginger", "lemon", "cayenne", "black pepper", "turmeric"],
    accent: "#c2410c",
    bg: "#fff7ed",
    sortOrder: 1,
  },
  {
    slug: "green_citrus",
    name: "Green Citrus",
    tagline: "Revitalise",
    description:
      "A fresher, greener blend designed to feel clean, crisp, and uplifting.",
    copy: "Clean, crisp, and refreshing. Green Citrus pairs cooling greens with apple, lemon, mint, and a touch of ginger for a blend that feels light, bright, and revitalising.",
    ingredientsList: ["Apple", "cucumber", "spinach", "lemon", "mint", "ginger"],
    accent: "#3f6212",
    bg: "#f7fee7",
    sortOrder: 2,
  },
  {
    slug: "berry_beet",
    name: "Berry Beet",
    tagline: "Restore",
    description:
      "A deeper, earthier blend with rich fruit notes and a more nourishing feel.",
    copy: "Rich berries meet earthy beetroot in a blend that feels smooth, rounded, and restorative. Berry Beet is for when you want something grounding, fruity, and full-bodied.",
    ingredientsList: ["Beetroot", "strawberry", "raspberry", "apple", "lemon", "ginger"],
    accent: "#9f1239",
    bg: "#fff1f2",
    sortOrder: 3,
  },
  {
    slug: "golden_carrot",
    name: "Golden Carrot",
    tagline: "Glow",
    description:
      "A warm, sunny blend with a smoother profile and a subtly spiced finish.",
    copy: "Sweet carrot and orange balanced with turmeric, lemon, and ginger. Golden Carrot is a bright, golden blend crafted to leave you feeling refreshed, vibrant, and glowing.",
    ingredientsList: ["Carrot", "orange", "turmeric", "lemon", "ginger", "black pepper"],
    accent: "#d97706",
    bg: "#fffbeb",
    sortOrder: 4,
  },
];

export const PRODUCT_BY_SLUG: Record<string, Product> = Object.fromEntries(
  PRODUCTS.map((p) => [p.slug, p])
);

// ── Formats ───────────────────────────────────────────────────────────────────

export type Format = "shot" | "share";

export const FORMAT_META: Record<
  Format,
  { label: string; unitLabel: string; unitLabelPlural: string; price: number }
> = {
  shot: {
    label: "100ml shot",
    unitLabel: "shot",
    unitLabelPlural: "shots",
    price: SHOT_PRICE_EX_VAT,
  },
  share: {
    label: "1L share bottle",
    unitLabel: "bottle",
    unitLabelPlural: "bottles",
    price: BOTTLE_PRICE_EX_VAT,
  },
};

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface SubscriptionPrice {
  pricePerDeliveryExVat: number;
  pricePerMonthExVat: number;
  vatPerMonth: number;
  totalPerMonthIncVat: number;
}

/**
 * Compute monthly subscription pricing from quantity per delivery + frequency.
 * Replaces the old team_size × multiplier model.
 */
export function computeSubscriptionPrice(
  format: Format,
  quantityPerDelivery: number,
  frequency: Frequency
): SubscriptionPrice {
  const unitPrice = FORMAT_META[format].price;
  const deliveriesPerMonth = frequency
    ? (FREQ_DELIVERIES_PER_MONTH[frequency] ?? 1)
    : 1;

  const pricePerDeliveryExVat = parseFloat(
    (unitPrice * quantityPerDelivery).toFixed(2)
  );
  const pricePerMonthExVat = parseFloat(
    (pricePerDeliveryExVat * deliveriesPerMonth).toFixed(2)
  );
  const vatPerMonth = parseFloat((pricePerMonthExVat * VAT_RATE).toFixed(2));
  const totalPerMonthIncVat = parseFloat(
    (pricePerMonthExVat + vatPerMonth).toFixed(2)
  );

  return {
    pricePerDeliveryExVat,
    pricePerMonthExVat,
    vatPerMonth,
    totalPerMonthIncVat,
  };
}

export interface OneOffPrice {
  subtotalExVat: number;
  vat: number;
  totalIncVat: number;
}

/** Compute one-off order pricing from quantity. */
export function computeOneOffPrice(
  format: Format,
  quantity: number
): OneOffPrice {
  const unitPrice = FORMAT_META[format].price;
  const subtotalExVat = parseFloat((unitPrice * quantity).toFixed(2));
  const vat = parseFloat((subtotalExVat * VAT_RATE).toFixed(2));
  const totalIncVat = parseFloat((subtotalExVat + vat).toFixed(2));
  return { subtotalExVat, vat, totalIncVat };
}
