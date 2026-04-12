import type { CSSProperties } from "react";

export const metadata = { title: "Home — Juice for Teams" };

const PRODUCTS = [
  {
    id: "allinone",
    name: "All-in-one",
    accent: "#c2410c",
    bg: "#fff7ed",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
  },
  {
    id: "lemon_ginger_honey",
    name: "Lemon, Ginger, Honey",
    accent: "#ca8a04",
    bg: "#fefce8",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
  },
  {
    id: "apple_ginger",
    name: "Apple Ginger",
    accent: "#3f6212",
    bg: "#f7fee7",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
  },
  {
    id: "turmeric",
    name: "Turmeric Boost",
    accent: "#d97706",
    bg: "#fffbeb",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
  },
];

const QUICK_LINKS = [
  {
    href: "/dashboard/orders",
    title: "Orders",
    sub: "View upcoming and past deliveries",
    arrow: "→",
  },
  {
    href: "/dashboard/subscriptions",
    title: "Subscription",
    sub: "Configure your recurring delivery",
    arrow: "→",
  },
  {
    href: "/dashboard/juice-types",
    title: "Juice Types",
    sub: "Browse all four cold-pressed blends",
    arrow: "→",
  },
];

export default function DashboardPage() {
  return (
    <div className="db-home-v2">
      {/* ── Main: copy + bento ── */}
      <div className="db-home-v2__main">

        {/* Editorial copy */}
        <div className="db-home-v2__copy">
          <p className="db-home-v2__eyebrow">Juice for Teams</p>
          <h1 className="db-home-v2__hed">
            Your team's<br />
            <em>daily ritual.</em>
          </h1>
          <p className="db-home-v2__body">
            Cold-pressed ginger shots and juices, delivered on your schedule.
            Pick a favourite or mix and match — your blend, your cadence.
          </p>
          <div className="db-home-v2__ctas">
            <a href="/dashboard/subscriptions" className="btn btn--primary btn--sm">
              Configure subscription
            </a>
            <a href="/dashboard/juice-types" className="btn btn--ghost btn--sm">
              Browse blends
            </a>
          </div>
        </div>

        {/* 2×2 product bento */}
        <div className="db-home-v2__bento">
          {PRODUCTS.map((p) => (
            <a
              key={p.id}
              href="/dashboard/juice-types"
              className="db-home-v2__tile"
              style={{
                background: p.bg,
                border: `1.5px solid color-mix(in srgb, ${p.accent} 18%, transparent)`,
              } as CSSProperties}
            >
              <div
                className="db-home-v2__tile-bottle"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 35%, #fff) 0%, ${p.accent} 55%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                  boxShadow: `0 5px 14px color-mix(in srgb, ${p.accent} 25%, transparent)`,
                } as CSSProperties}
              />
              <div>
                <p className="db-home-v2__tile-name">{p.name}</p>
                <p className="db-home-v2__tile-price">
                  {p.shotPrice} shot · {p.sharePrice} 1L
                </p>
              </div>
            </a>
          ))}
        </div>

      </div>

      {/* ── Quick links ── */}
      <div className="db-home-v2__links">
        {QUICK_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="db-home-v2__link">
            <span className="db-home-v2__link-title">{link.title}</span>
            <span className="db-home-v2__link-sub">{link.sub}</span>
            <span className="db-home-v2__link-arrow">{link.arrow}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
