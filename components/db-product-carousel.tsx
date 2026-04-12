"use client";

import { useState } from "react";

const PRODUCTS = [
  {
    id: "allinone",
    name: "All-in-one",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    accent: "#c2410c",
    bg: "#fff7ed",
    desc: "Ginger, lemon, turmeric and apple in one daily shot. Everything your team needs, no decisions required.",
    tall: false,
  },
  {
    id: "lemon_ginger_honey",
    name: "Lemon, Ginger, Honey",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    accent: "#ca8a04",
    bg: "#fefce8",
    desc: "Bright cold-pressed lemon with fresh ginger and raw honey. Soothing and naturally sweetened.",
    tall: false,
  },
  {
    id: "apple_ginger",
    name: "Apple Ginger",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    accent: "#3f6212",
    bg: "#f7fee7",
    desc: "Cold-pressed apple with a sharp ginger kick. Naturally sweet and crisp — perfect for the office fridge.",
    tall: true,
  },
  {
    id: "turmeric",
    name: "Turmeric Boost",
    shotPrice: "£3.50",
    sharePrice: "£25.00",
    accent: "#d97706",
    bg: "#fffbeb",
    desc: "Turmeric, ginger, black pepper for absorption, and honey. Anti-inflammatory in a single shot.",
    tall: false,
  },
] as const;

export function DbProductCarousel() {
  const [index, setIndex] = useState(0);
  const p = PRODUCTS[index];

  return (
    <div className="db-carousel">
      <div className="db-carousel__card">
        <div className="db-carousel__header">
          <span className="db-carousel__source">Cold-Pressed Juice</span>
          <div className="db-carousel__nav">
            <button
              type="button"
              className="db-carousel__arrow"
              aria-label="Previous product"
              onClick={() => setIndex((i) => (i - 1 + PRODUCTS.length) % PRODUCTS.length)}
            >
              ←
            </button>
            <button
              type="button"
              className="db-carousel__arrow"
              aria-label="Next product"
              onClick={() => setIndex((i) => (i + 1) % PRODUCTS.length)}
            >
              →
            </button>
          </div>
        </div>

        <div className="db-carousel__visual" style={{ background: p.bg }}>
          <div
            className={`jt-card__bottle${p.tall ? " jt-card__bottle--tall" : ""}`}
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${p.accent} 40%, #fff) 0%, ${p.accent} 60%, color-mix(in srgb, ${p.accent} 60%, #000) 100%)`,
              boxShadow: `0 8px 20px color-mix(in srgb, ${p.accent} 30%, transparent)`,
            }}
          />
        </div>

        <div className="db-carousel__info">
          <div className="db-carousel__info-top">
            <div>
              <p className="db-carousel__name">{p.name}</p>
              <p className="db-carousel__meta">
                <span style={{ color: p.accent }}>{p.shotPrice}</span> 100ml shot
                &nbsp;·&nbsp;
                <span style={{ color: p.accent }}>{p.sharePrice}</span> 1L share
              </p>
            </div>
            <span className="db-carousel__dot" style={{ background: p.accent }} />
          </div>
          <p className="db-carousel__desc">{p.desc}</p>
          <div className="db-carousel__pips">
            {PRODUCTS.map((prod, i) => (
              <button
                key={prod.id}
                type="button"
                className={`db-carousel__pip${i === index ? " db-carousel__pip--active" : ""}`}
                style={i === index ? { background: p.accent } : {}}
                aria-label={`Show ${prod.name}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
