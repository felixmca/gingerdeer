"use client";

import { OrderLauncher } from "@/components/order-launcher";
import { PRODUCTS } from "@/lib/products";
import { useState } from "react";

export function DbJuiceTypesPage() {
  const [launcherOpen, setLauncherOpen]       = useState(false);
  const [preselectedSlug, setPreselectedSlug] = useState<string | undefined>(undefined);
  const [selectedFormats, setSelectedFormats] = useState<Record<string, "shot" | "share">>(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.slug, "shot" as const]))
  );

  function openForProduct(slug: string) {
    setPreselectedSlug(slug);
    setLauncherOpen(true);
  }

  return (
    <div className="jt-page jt-page--dashboard">
      {/* ── Page heading ── */}
      <div className="jt-heading">
        <div>
          <h1 className="jt-heading__title">Juice Types</h1>
          <p className="jt-heading__sub">
            Browse our four cold-pressed blends — available as 100ml shots or 1L share bottles.
          </p>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div className="jt-grid">
        {PRODUCTS.map((p) => {
          const fmt = selectedFormats[p.slug] ?? "shot";
          const price = fmt === "shot" ? "£3.50" : "£25.00";
          const unit  = fmt === "shot" ? "per 100ml shot" : "per 1L share bottle";

          return (
            <article key={p.slug} className="jt-card">
              <div className="jt-card__visual" style={{ background: p.bg }} aria-hidden="true">
                <div
                  className="jt-card__bottle"
                  style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 40%, #fff) 0%, ${p.accent} 60%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                    boxShadow: `0 8px 20px color-mix(in srgb, ${p.accent} 30%, transparent)`,
                  }}
                />
                <span className="jt-card__size-badge" style={{ background: p.accent }}>
                  {fmt === "shot" ? "100ml" : "1L"}
                </span>
              </div>

              <div className="jt-card__body">
                <div className="jt-card__top">
                  <h2 className="jt-card__name">{p.name}</h2>
                  <span className="jt-card__price" style={{ color: p.accent }}>
                    {price} <small>{unit}</small>
                  </span>
                </div>

                <p className="jt-card__desc">{p.copy}</p>

                <div className="jt-card__footer">
                  <p className="jt-card__qty-label">Format</p>
                  <div className="jt-card__sizes">
                    {(["shot", "share"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`jt-size-pill${fmt === f ? " jt-size-pill--active" : ""}`}
                        style={fmt === f ? { background: p.accent, borderColor: p.accent, color: "#fff" } : {}}
                        onClick={() => setSelectedFormats((prev) => ({ ...prev, [p.slug]: f }))}
                      >
                        {f === "shot" ? "100ml shot" : "1L share"}
                      </button>
                    ))}
                  </div>

                  <p className="jt-card__qty-label" style={{ marginTop: "0.6rem" }}>Ingredients</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-ink-muted)", margin: 0 }}>
                    {p.ingredientsList.join(", ")}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn--primary jt-card__cta"
                  onClick={() => openForProduct(p.slug)}
                >
                  Order now
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* ── Bottom CTA ── */}
      <div className="jt-bottom-cta">
        <p>Subscribe for recurring deliveries or place a one-off order — both available for all blends.</p>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => { setPreselectedSlug(undefined); setLauncherOpen(true); }}
        >
          Start an order
        </button>
      </div>

      <OrderLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        preselectedProductSlug={preselectedSlug}
        loggedIn={true}
      />
    </div>
  );
}
