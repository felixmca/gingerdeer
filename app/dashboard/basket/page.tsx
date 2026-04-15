"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_BY_SLUG, FORMAT_META } from "@/lib/products";
import { FREQ_LABEL } from "@/lib/funnel-logic";

interface BasketEntry {
  id: string;
  mode: "subscription" | "one_off";
  lineItems: Array<{ productSlug: string; format: "shot" | "share"; quantity: number }>;
  frequency?: string;
  preferredDay?: string;
  deliveryDate?: string;
  deliveryNotes?: string;
  pricing: { totalPerMonthIncVat?: number; totalIncVat?: number };
  createdAt: string;
}

export default function BasketPage() {
  const router = useRouter();
  const [items, setItems]     = useState<BasketEntry[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ol_basket");
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, []);

  function removeItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    localStorage.setItem("ol_basket", JSON.stringify(next));
  }

  async function checkoutItem(entry: BasketEntry) {
    setLoading(entry.id);
    setError("");
    try {
      const body: Record<string, unknown> = {
        mode:      entry.mode,
        lineItems: entry.lineItems,
        deliveryNotes: entry.deliveryNotes,
      };
      if (entry.mode === "subscription") {
        body.frequency    = entry.frequency;
        body.preferredDay = entry.preferredDay;
      } else {
        body.deliveryDate = entry.deliveryDate;
      }

      const res  = await fetch("/api/checkout/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start checkout.");

      // Remove from basket before redirecting
      removeItem(entry.id);
      sessionStorage.setItem("ol_client_secret", json.clientSecret);
      sessionStorage.setItem("ol_order_type", entry.mode);
      router.push("/dashboard/checkout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  function formatLineItems(entry: BasketEntry) {
    return entry.lineItems.map((i) => {
      const p = PRODUCT_BY_SLUG[i.productSlug];
      const f = FORMAT_META[i.format];
      return `${i.quantity} × ${p?.name ?? i.productSlug} (${f?.label ?? i.format})`;
    }).join(", ");
  }

  return (
    <div className="adm-page">
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Basket</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-ink-muted)" }}>
            Saved orders ready to check out.
          </p>
        </div>
        {items.length > 0 && (
          <a href="/dashboard/checkout" className="btn btn--primary btn--sm">
            + New order
          </a>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--color-accent)", marginBottom: "1rem", fontSize: "0.875rem" }}>{error}</p>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--color-ink-muted)" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Your basket is empty</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Add a subscription or one-off order from the checkout flow.
          </p>
          <a href="/dashboard/checkout" className="btn btn--primary">Start an order</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "640px" }}>
          {items.map((entry) => {
            const price = entry.mode === "subscription"
              ? entry.pricing.totalPerMonthIncVat
              : entry.pricing.totalIncVat;
            const priceLabel = entry.mode === "subscription"
              ? `£${price?.toFixed(2)}/mo`
              : `£${price?.toFixed(2)}`;
            const freqLabel = entry.mode === "subscription" && entry.frequency
              ? FREQ_LABEL[entry.frequency] ?? entry.frequency
              : null;

            return (
              <div key={entry.id} className="ol-plan-aside" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "0.9375rem" }}>
                      {entry.mode === "subscription" ? "Subscription" : "One-off order"}
                    </p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
                      {formatLineItems(entry)}
                    </p>
                    {freqLabel && (
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
                        {freqLabel}{entry.preferredDay ? ` · ${entry.preferredDay}s` : ""}
                      </p>
                    )}
                    {entry.deliveryDate && (
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
                        Delivery: {new Date(entry.deliveryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "1rem", whiteSpace: "nowrap" }}>{priceLabel}</span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => checkoutItem(entry)}
                    disabled={loading === entry.id}
                  >
                    {loading === entry.id ? "Please wait…" : "Pay now →"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => removeItem(entry.id)}
                    disabled={loading === entry.id}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
