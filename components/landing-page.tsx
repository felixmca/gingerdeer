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
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    desc: "Ginger, lemon, turmeric and apple. Everything your team needs, no decisions required.",
    ingredientKey: "allinone_shot",
  },
  {
    id: "lemon_ginger_honey",
    name: "Lemon, Ginger, Honey",
    accent: "#ca8a04",
    bg: "#fefce8",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    desc: "Bright cold-pressed lemon with fresh ginger and raw honey. A crowd-pleaser for any team.",
    ingredientKey: "lemon_ginger_honey_shot",
  },
  {
    id: "apple_ginger",
    name: "Apple Ginger",
    accent: "#3f6212",
    bg: "#f7fee7",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    desc: "Cold-pressed apple with a sharp ginger kick. Naturally sweet, crisp, and refreshing.",
    ingredientKey: "apple_ginger_shot",
  },
  {
    id: "turmeric",
    name: "Turmeric Boost",
    accent: "#d97706",
    bg: "#fffbeb",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    desc: "Turmeric, ginger, black pepper and honey. Anti-inflammatory in every sip.",
    ingredientKey: "turmeric_shot",
  },
] as const;

const TICKER_ITEMS = [
  "All-in-one",
  "Lemon, Ginger, Honey",
  "Apple Ginger",
  "Turmeric Boost",
  "100ml shots",
  "1L share bottles",
  "Weekly delivery",
  "Team wellness",
];

export function LandingPage() {
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [prefill, setPrefill] = useState<FunnelPrefill | undefined>(undefined);
  const [selectedIngredient, setSelectedIngredient] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      setLoggedIn(!!session);
      if (!session?.user) return;
      const user = session.user;
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

  function openFunnel(ingredientKey?: string) {
    setSelectedIngredient(ingredientKey);
    setFunnelOpen(true);
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      {/* ── Header ── */}
      <header className="lp-header">
        <div className="lp-header__inner">
          <a href="/" className="logo" aria-label="Juice for Teams home">
            <span className="logo__mark" aria-hidden="true" />
            <span className="logo__text">Juice for Teams</span>
          </a>
          <nav aria-label="Primary">
            <ul className="lp-nav">
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#blends">The blends</a></li>
              <li><a href="#why-juice">Why juice</a></li>
              <li><a href="#for-hr">For HR</a></li>
            </ul>
          </nav>
          <div className="lp-header__actions">
            {loggedIn ? (
              <a href="/dashboard" className="btn btn--ghost btn--sm">Dashboard</a>
            ) : (
              <a href="/auth/login" className="btn btn--ghost btn--sm">Login</a>
            )}
            <button type="button" className="btn btn--primary btn--sm" onClick={() => openFunnel()}>
              Get started
            </button>
          </div>
        </div>
      </header>

      <main id="main">

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero__inner">

            {/* Left: Copy */}
            <div className="lp-hero__copy">
              <span className="lp-eyebrow lp-eyebrow--accent">B2B · Cold-Pressed · Team Wellness</span>
              <h1 className="lp-hero__hed">
                Wellness that<br />
                shows up<br />
                <em>every week.</em>
              </h1>
              <p className="lp-hero__sub">
                Offer a tangible perk employees actually use. Cold-pressed ginger shots and juices, delivered on the schedule your team chooses — not just for birthdays.
              </p>
              <div className="lp-hero__actions">
                <button type="button" className="btn btn--primary btn--lg" onClick={() => openFunnel()}>
                  Start for your team
                </button>
                <a href="#how-it-works" className="btn btn--ghost btn--lg">
                  See how it works
                </a>
              </div>
              <ul className="lp-trust" role="list">
                <li>Flexible cadence</li>
                <li>Scales with headcount</li>
                <li>One invoice, simple ops</li>
              </ul>
            </div>

            {/* Right: 2×2 juice tile grid */}
            <div className="lp-hero__visual" aria-hidden="true">
              {PRODUCTS.map((p) => (
                <div
                  key={p.id}
                  className="lp-hero__tile"
                  style={{ background: p.bg }}
                >
                  <div
                    className="lp-hero__tile-bottle"
                    style={{
                      background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 35%, #fff) 0%, ${p.accent} 55%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                      boxShadow: `0 6px 16px color-mix(in srgb, ${p.accent} 28%, transparent)`,
                    }}
                  />
                  <p className="lp-hero__tile-name">{p.name}</p>
                  <p className="lp-hero__tile-formats">{p.shotPrice} shot · {p.sharePrice} 1L</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── Ticker ── */}
        <div className="lp-ticker" aria-hidden="true">
          <div className="lp-ticker__track">
            {/* Each item + separator, duplicated for seamless loop */}
            {[...TICKER_ITEMS, ...TICKER_ITEMS].flatMap((item, i) => [
              <span key={`i${i}`} className="lp-ticker__item">{item}</span>,
              <span key={`s${i}`} className="lp-ticker__sep">·</span>,
            ])}
          </div>
        </div>

        {/* ── How it works ── */}
        <section id="how-it-works" className="lp-how">
          <div className="lp-wrap lp-how__inner">
            <div className="lp-how__intro">
              <span className="lp-eyebrow">How it works</span>
              <h2 className="lp-section-hed">Three steps to a healthier team.</h2>
              <p className="lp-section-sub">
                Same motion as any recurring perk — set it once, let it run.
              </p>
            </div>
            <div className="lp-how__steps">
              <div className="lp-how__step">
                <span className="lp-how__num">01</span>
                <h3>Pick your rhythm</h3>
                <p>Weekly, biweekly, or monthly deliveries — whatever matches your culture and budget.</p>
              </div>
              <div className="lp-how__step">
                <span className="lp-how__num">02</span>
                <h3>Size each drop</h3>
                <p>Shots per person, bottles for the fridge, or a mix. Scale up or down as you hire.</p>
              </div>
              <div className="lp-how__step">
                <span className="lp-how__num">03</span>
                <h3>We handle the rest</h3>
                <p>Coordinated drops to your office or hybrid hubs. Predictable reporting for finance.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── The blends (product bento) ── */}
        <section id="blends" className="lp-blends">
          <div className="lp-wrap">
            <div className="lp-blends__head">
              <span className="lp-eyebrow">The range</span>
              <h2 className="lp-section-hed">Four blends. Two formats.</h2>
              <p className="lp-section-sub">
                Individual 100ml shots or 1L share bottles — both available for every blend.
              </p>
            </div>
            <div className="lp-bento">
              {PRODUCTS.map((p) => (
                <div
                  key={p.id}
                  className="lp-bento__card"
                  style={{ background: p.bg, borderColor: `color-mix(in srgb, ${p.accent} 20%, transparent)` }}
                  onClick={() => openFunnel(p.ingredientKey)}
                >
                  <div
                    className="lp-bento__bottle"
                    style={{
                      background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 35%, #fff) 0%, ${p.accent} 55%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
                      boxShadow: `0 6px 18px color-mix(in srgb, ${p.accent} 25%, transparent)`,
                    }}
                  />
                  <div className="lp-bento__info">
                    <p className="lp-bento__name">{p.name}</p>
                    <p className="lp-bento__price">{p.shotPrice} shot · {p.sharePrice} 1L share</p>
                    <button
                      type="button"
                      className="lp-bento__btn"
                      style={{ color: p.accent }}
                      onClick={(e) => { e.stopPropagation(); openFunnel(p.ingredientKey); }}
                    >
                      Add to subscription →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Playbook / workflow ── */}
        <section id="workflow" className="lp-playbook">
          <div className="lp-wrap lp-playbook__inner">
            <div className="lp-playbook__copy">
              <span className="lp-eyebrow">The playbook</span>
              <h2 className="lp-section-hed">Same motion as your favourite team perks.</h2>
              <p>
                Many companies already subscribe employees to recurring treats. Juice fits the same flow: sign up, configure, and the deliveries take care of themselves.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => openFunnel()}>
                Walk through the flow
              </button>
            </div>
            <ol className="lp-playbook__steps">
              <li className="lp-playbook__step">
                <span className="lp-playbook__num">01</span>
                <div className="lp-playbook__step-body">
                  <h4>Create your account</h4>
                  <p>Work email and company details — takes under a minute.</p>
                </div>
              </li>
              <li className="lp-playbook__step">
                <span className="lp-playbook__num">02</span>
                <div className="lp-playbook__step-body">
                  <h4>Choose your blend</h4>
                  <p>Pick one or mix and match from our four cold-pressed options.</p>
                </div>
              </li>
              <li className="lp-playbook__step">
                <span className="lp-playbook__num">03</span>
                <div className="lp-playbook__step-body">
                  <h4>Set your cadence</h4>
                  <p>How often deliveries arrive and what day works for your office.</p>
                </div>
              </li>
              <li className="lp-playbook__step">
                <span className="lp-playbook__num">04</span>
                <div className="lp-playbook__step-body">
                  <h4>Size the drop</h4>
                  <p>Team size with a live cost calculator — no surprises on the invoice.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ── Why ginger (dark) ── */}
        <section id="why-juice" className="lp-why">
          <div className="lp-wrap lp-why__inner">
            <div>
              <span className="lp-eyebrow lp-eyebrow--light">Why ginger for employees</span>
              <p className="lp-why__pull">
                "The wellness perk that doesn't wait for a birthday."
              </p>
            </div>
            <ul className="lp-why__list" role="list">
              <li>Branded or white-label options for larger rollouts</li>
              <li>Dietary transparency — ingredients and allergens for People teams</li>
              <li>Optional pilot with one floor or region before company-wide rollout</li>
              <li>Year-round, consistent — not episodic like event treats</li>
            </ul>
          </div>
        </section>

        {/* ── For HR ── */}
        <section id="for-hr" className="lp-hr">
          <div className="lp-wrap lp-hr__inner">
            <div>
              <span className="lp-eyebrow">For HR &amp; People leaders</span>
              <h2 className="lp-hr__hed">
                Invest in how your<br />team <em>feels.</em>
              </h2>
              <blockquote>
                <p className="lp-hr__quote">
                  "We're exploring whether companies want ginger juice for employees on subscription — same motion as cake perks, but always on."
                </p>
                <footer className="lp-hr__source">— Built for People &amp; HR leaders</footer>
              </blockquote>
            </div>
            <button type="button" className="btn btn--primary btn--lg" onClick={() => openFunnel()}>
              Request access
            </button>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <p className="lp-footer__brand">Juice for Teams</p>
          <p className="lp-footer__meta">B2B ginger juice &amp; shots · Subscription pricing on inquiry</p>
        </div>
      </footer>

      <FunnelModal
        open={funnelOpen}
        onClose={() => setFunnelOpen(false)}
        prefill={prefill}
        preselectedIngredient={selectedIngredient}
        loggedIn={loggedIn}
      />
    </>
  );
}
