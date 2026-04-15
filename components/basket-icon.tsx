"use client";

import { useEffect, useState } from "react";

export function BasketIcon() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem("ol_basket");
        const items = raw ? JSON.parse(raw) : [];
        setCount(Array.isArray(items) ? items.length : 0);
      } catch {
        setCount(0);
      }
    }

    read();

    // Re-read whenever another tab or the same tab updates localStorage
    window.addEventListener("storage", read);
    // Also poll occasionally so same-tab "add to basket" is reflected
    const interval = setInterval(read, 2000);
    return () => {
      window.removeEventListener("storage", read);
      clearInterval(interval);
    };
  }, []);

  return (
    <a href="/dashboard/basket" className="db-topbar__basket" aria-label={`Basket${count > 0 ? ` (${count} item${count !== 1 ? "s" : ""})` : ""}`}>
      {/* Shopping bag icon */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      {count > 0 && (
        <span className="db-topbar__basket-count" aria-hidden="true">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </a>
  );
}
