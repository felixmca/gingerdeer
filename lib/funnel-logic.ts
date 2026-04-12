// Ingredient keys match the slugs in the Supabase `ingredients` reference table.
// shots   = 100ml individual shot bottles required per person per delivery
// bottles = 1L share bottles required per person per delivery
//           (1 bottle = 10 servings, so 0.1 per person)
export const INGREDIENT_META: Record<
  string,
  { label: string; shots: number; bottles: number }
> = {
  allinone_shot:             { label: "All-in-one (100ml shot)",           shots: 1,   bottles: 0   },
  allinone_share:            { label: "All-in-one (1L share bottle)",      shots: 0,   bottles: 0.1 },
  lemon_ginger_honey_shot:   { label: "Lemon, Ginger, Honey (100ml shot)", shots: 1,   bottles: 0   },
  lemon_ginger_honey_share:  { label: "Lemon, Ginger, Honey (1L share)",   shots: 0,   bottles: 0.1 },
  apple_ginger_shot:         { label: "Apple Ginger (100ml shot)",          shots: 1,   bottles: 0   },
  apple_ginger_share:        { label: "Apple Ginger (1L share bottle)",     shots: 0,   bottles: 0.1 },
  turmeric_shot:             { label: "Turmeric Boost (100ml shot)",        shots: 1,   bottles: 0   },
  turmeric_share:            { label: "Turmeric Boost (1L share bottle)",   shots: 0,   bottles: 0.1 },
};

export const FREQ_DELIVERIES_PER_MONTH: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
};

export const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export const FUNNEL_TITLES: Record<number, string> = {
  1: "Create your company account",
  2: "Choose your drinks",
  3: "How often should we deliver?",
  4: "Size each delivery",
};

// Pricing (ex. VAT)
export const SHOT_PRICE_EX_VAT = 3.50;
export const BOTTLE_PRICE_EX_VAT = 25.00;
export const VAT_RATE = 0.2;

// Per-person multiplier steps exposed in the UI
export const MULT_STEPS = [0.5, 1.0, 1.5, 2.0] as const;
export type MultStep = typeof MULT_STEPS[number];

export type Frequency = "weekly" | "biweekly" | "monthly" | null;

export interface Plan {
  keys: string[];
  labels: string[];
  shotsPerDrop: number;
  bottlesPerDrop: number;
  shotsMonth: number;
  bottlesMonth: number;
  team: number;
  /** Per-person multiplier (0.5 | 1.0 | 1.5 | 2.0) stored as string for the DB */
  tier: string;
  freq: Frequency;
  pricePerDropExVat: number;
  pricePerMonthExVat: number;
  vatPerMonth: number;
  totalPerMonthIncVat: number;
}

/**
 * Compute delivery quantities and pricing.
 *
 * @param ingredientKeys  Selected ingredient slugs
 * @param multiplier      Per-person quantity multiplier (default 1.0 = 1 unit per person)
 * @param team            Number of people receiving the delivery
 * @param freq            Delivery frequency
 */
export function computePlan(
  ingredientKeys: string[],
  multiplier: number,
  team: number,
  freq: Frequency
): Plan {
  let shotsPerPerson = 0;
  let bottlesPerPerson = 0;
  const labels: string[] = [];

  ingredientKeys.forEach((k) => {
    const m = INGREDIENT_META[k];
    if (!m) return;
    shotsPerPerson += m.shots;
    bottlesPerPerson += m.bottles;
    labels.push(m.label);
  });

  const shotsPerDrop    = Math.round(team * shotsPerPerson * multiplier);
  const bottlesPerDrop  = Math.round(team * bottlesPerPerson * multiplier);
  const perMonth        = freq ? FREQ_DELIVERIES_PER_MONTH[freq] ?? 1 : 1;
  const shotsMonth      = Math.round(shotsPerDrop * perMonth);
  const bottlesMonth    = Math.round(bottlesPerDrop * perMonth);

  const pricePerDropExVat   = parseFloat((shotsPerDrop * SHOT_PRICE_EX_VAT + bottlesPerDrop * BOTTLE_PRICE_EX_VAT).toFixed(2));
  const pricePerMonthExVat  = parseFloat((pricePerDropExVat * perMonth).toFixed(2));
  const vatPerMonth         = parseFloat((pricePerMonthExVat * VAT_RATE).toFixed(2));
  const totalPerMonthIncVat = parseFloat((pricePerMonthExVat + vatPerMonth).toFixed(2));

  return {
    keys: ingredientKeys,
    labels,
    shotsPerDrop,
    bottlesPerDrop,
    shotsMonth,
    bottlesMonth,
    team,
    tier: String(multiplier),
    freq,
    pricePerDropExVat,
    pricePerMonthExVat,
    vatPerMonth,
    totalPerMonthIncVat,
  };
}
