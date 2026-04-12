"use client";

import { FunnelModal, type FunnelPrefill } from "@/components/funnel-modal";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const PRODUCTS = [
  {
    id: "allinone",
    name: "All-in-one",
    accent: "#c2410c",
    bg: "#fff7ed",
    desc: "Our signature wellness blend — ginger, lemon, turmeric and apple all in one. Everything your team needs for a daily health ritual, no decisions required.",
    sizes: [
      { key: "allinone_shot",  size: "100ml", price: "£3.50", unit: "per shot",        quantities: [10, 25, 50, 100] },
      { key: "allinone_share", size: "1L",    price: "£25.00", unit: "per share bottle", quantities: [1, 2, 5, 10]    },
    ],
  },
  {
    id: "lemon_ginger_honey",
    name: "Lemon, Ginger, Honey",
    accent: "#ca8a04",
    bg: "#fefce8",
    desc: "Bright cold-pressed lemon balanced with fresh ginger and raw honey. Soothing, naturally sweetened and light on the palate — a crowd-pleaser for any team.",
    sizes: [
      { key: "lemon_ginger_honey_shot",  size: "100ml", price: "£3.50",  unit: "per shot",        quantities: [10, 25, 50, 100] },
      { key: "lemon_ginger_honey_share", size: "1L",    price: "£25.00", unit: "per share bottle", quantities: [1, 2, 5, 10]    },
    ],
  },
  {
    id: "apple_ginger",
    name: "Apple Ginger",
    accent: "#3f6212",
    bg: "#f7fee7",
    desc: "Cold-pressed apple juice with a sharp ginger kick. Naturally sweet, crisply refreshing — ideal served straight from the office fridge as a mid-afternoon pick-me-up.",
    sizes: [
      { key: "apple_ginger_shot",  size: "100ml", price: "£3.50",  unit: "per shot",        quantities: [10, 25, 50, 100] },
      { key: "apple_ginger_share", size: "1L",    price: "£25.00", unit: "per share bottle", quantities: [1, 2, 5, 10]    },
    ],
  },
  {
    id: "turmeric",
    name: "Turmeric Boost",
    accent: "#d97706",
    bg: "#fffbeb",
    desc: "Golden wellness in every sip — turmeric, ginger, black pepper for absorption, and a touch of honey. Anti-inflammatory and antioxidant, made for teams who take health seriously.",
    sizes: [
      { key: "turmeric_shot",  size: "100ml", price: "£3.50",  unit: "per shot",        quantities: [10, 25, 50, 100] },
      { key: "turmeric_share", size: "1L",    price: "£25.00", unit: "per share bottle", quantities: [1, 2, 5, 10]    },
    ],
  },
];

export default function JuiceTypesPage() {
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [prefill, setPrefill] = useState<FunnelPrefill | undefined>(undefined);
  const [selectedIngredient, setSelectedIngredient] = useState<string | undefined>(undefined);

  // Track selected size per product (default to each product's first size)
  const [selectedSizeKeys, setSelectedSizeKeys] = useState<Record<string, string>>(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.id, p.sizes[0].key]))
  );

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      setLoggedIn(!!session);
      if (!session?.user) return;

      const user = session.user;
      // Fetch their most recent linked lead for prefill
      const { data: lead } = await supabase
        .from("leads")
        .select("id, email, company, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrefill({
        email: lead?.email ?? user.email ?? "",
        company: lead?.company ?? "",
        role: lead?.role ?? "",
        leadId: lead?.id,
      });
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session);
      if (!session) setPrefill(undefined);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function openFunnelForProduct(ingredientKey: string) {
    setSelectedIngredient(ingredientKey);
    setFunnelOpen(true);
  }

  function openFunnelGeneral() {
    setSelectedIngredient(undefined);
    setFunnelOpen(true);
  }

  return (
    <div className="jt-page">
      {/* ── Header ── */}
      <header className="site-header">
        <div className="wrap site-header__inner">
          <a href="/" className="logo" aria-label="Juice for Teams home">
            <span className="logo__mark" aria-hidden="true" />
            <span className="logo__text">Juice for Teams</span>
          </a>
          <nav className="nav" aria-label="Primary">
            <a href="/#how-it-works">How it works</a>
            <a href="/#why-juice">Why juice</a>
            <a href="/juice-types" aria-current="page">Juice Types</a>
            <a href="/#for-hr">For HR</a>
          </nav>
          <div className="header-actions">
            {loggedIn ? (
              <a href="/dashboard" className="btn btn--ghost btn--sm">Dashboard</a>
            ) : (
              <a href="/auth/login" className="btn btn--ghost btn--sm">Login / Sign up</a>
            )}
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={openFunnelGeneral}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="wrap jt-main">
        {/* ── Page title ── */}
        <div className="jt-heading">
          <span className="jt-heading__icon" aria-hidden="true">🧃</span>
          <div>
            <h1 className="jt-heading__title">Juice Types</h1>
            <p className="jt-heading__sub">
              Browse our selection of cold-pressed juices and shots available
              for your team subscription.
            </p>
          </div>
        </div>

        {/* ── Product grid ── */}
        <div className="jt-grid">
          {PRODUCTS.map((p) => {
            const selectedKey = selectedSizeKeys[p.id] ?? p.sizes[0].key;
            const selectedSize = p.sizes.find((s) => s.key === selectedKey) ?? p.sizes[0];

            return (
              <article key={p.id} className="jt-card">
                {/* Illustration */}
                <div
                  className="jt-card__visual"
                  style={{ background: p.bg }}
                  aria-hidden="true"
                >
                  <div
                    className={`jt-card__bottle ${selectedSize.size === "500ml" ? "jt-card__bottle--tall" : ""}`}
                    style={{
                      background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 40%, #fff) 0%, ${p.accent} 60%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                      boxShadow: `0 8px 20px color-mix(in srgb, ${p.accent} 30%, transparent)`,
                    }}
                  />
                  <span
                    className="jt-card__size-badge"
                    style={{ background: p.accent }}
                  >
                    {selectedSize.size}
                  </span>
                </div>

                {/* Body */}
                <div className="jt-card__body">
                  <div className="jt-card__top">
                    <h2 className="jt-card__name">{p.name}</h2>
                    <span
                      className="jt-card__price"
                      style={{ color: p.accent }}
                    >
                      {selectedSize.price} <small>{selectedSize.unit}</small>
                    </span>
                  </div>

                  <p className="jt-card__desc">{p.desc}</p>

                  <div className="jt-card__footer">
                    {/* Size selector */}
                    <p className="jt-card__qty-label">Size</p>
                    <div className="jt-card__sizes">
                      {p.sizes.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          className={`jt-size-pill${s.key === selectedKey ? " jt-size-pill--active" : ""}`}
                          style={s.key === selectedKey ? { background: p.accent, borderColor: p.accent, color: "#fff" } : {}}
                          onClick={() => setSelectedSizeKeys((prev) => ({ ...prev, [p.id]: s.key }))}
                        >
                          {s.size}
                        </button>
                      ))}
                    </div>

                    {/* Quantities for selected size */}
                    <p className="jt-card__qty-label" style={{ marginTop: "0.6rem" }}>
                      Available per delivery
                    </p>
                    <div className="jt-card__qtys">
                      {selectedSize.quantities.map((q) => (
                        <span key={q} className="jt-qty-pill">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--primary jt-card__cta"
                    onClick={() => openFunnelForProduct(selectedKey)}
                  >
                    Add to subscription
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="jt-bottom-cta">
          <p>Mix and match — choose one or more juice types when you configure your subscription.</p>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={openFunnelGeneral}
          >
            Configure your subscription
          </button>
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer__inner">
          <p className="site-footer__brand">Juice for Teams</p>
          <p className="site-footer__meta">
            B2B ginger juice &amp; shots · Subscription pricing on inquiry
          </p>
        </div>
      </footer>

      <FunnelModal
        open={funnelOpen}
        onClose={() => setFunnelOpen(false)}
        prefill={prefill}
        preselectedIngredient={selectedIngredient}
        loggedIn={loggedIn}
      />
    </div>
  );
}
