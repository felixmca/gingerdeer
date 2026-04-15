import Stripe from "stripe";

/**
 * Server-side Stripe client.
 * Never import this in client components — it uses the secret key.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

/** Convert a GBP amount (e.g. 210.00) to Stripe integer pence (21000). */
export function toPence(gbp: number): number {
  return Math.round(gbp * 100);
}
