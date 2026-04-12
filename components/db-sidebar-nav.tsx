"use client";

import { usePathname } from "next/navigation";

export function DbSidebarNav() {
  const path = usePathname();

  function cls(href: string) {
    const active =
      href === "/dashboard"
        ? path === "/dashboard"
        : path === href || path.startsWith(href + "/");
    return `db-nav__item${active ? " db-nav__item--active" : ""}`;
  }

  return (
    <nav className="db-nav" aria-label="Dashboard navigation">
      <a href="/dashboard" className={cls("/dashboard")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 5.5L7.5 1L13.5 5.5V13.5H9.5V9.5H5.5V13.5H1.5V5.5Z" />
        </svg>
        Home
      </a>

      <span className="db-nav__section">Brand</span>

      <a href="/dashboard/orders" className={cls("/dashboard/orders")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
          <path d="M4.5 6.5h6M4.5 9.5h4" />
        </svg>
        Orders
      </a>

      <a href="/dashboard/juice-types" className={cls("/dashboard/juice-types")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 2h5l1.5 9.5H3.5L5 2Z" />
          <path d="M3.5 6h8" />
        </svg>
        Juice Types
      </a>

      <span className="db-nav__section">Manage</span>

      <a href="/dashboard/subscriptions" className={cls("/dashboard/subscriptions")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <rect x="1.5" y="3.5" width="12" height="9" rx="1.5" />
          <path d="M5 3.5V2.5a2.5 2.5 0 015 0v1" />
        </svg>
        Subscriptions
      </a>

      <a href="/dashboard/one-off" className={cls("/dashboard/one-off")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" />
          <path d="M5 2v2M10 2v2M1.5 7h12" />
        </svg>
        One-off Orders
      </a>

      <a href="/dashboard/reviews" className={cls("/dashboard/reviews")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.5 1.5L9.3 5.3L13.5 5.9L10.5 8.8L11.2 13L7.5 11L3.8 13L4.5 8.8L1.5 5.9L5.7 5.3L7.5 1.5Z" />
        </svg>
        Reviews
      </a>

      <span className="db-nav__section">Other</span>

      <a href="/dashboard/settings" className={cls("/dashboard/settings")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="2" />
          <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.1 1.1M10.8 10.8l1.1 1.1M3.1 11.9l1.1-1.1M10.8 4.2l1.1-1.1" />
        </svg>
        Settings
      </a>

      <a href="/dashboard/feedback" className={cls("/dashboard/feedback")}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 1.5h12v9h-5L5 13.5V10.5H1.5v-9Z" />
        </svg>
        Feedback
      </a>

      <div className="db-nav__spacer" />

      <a href="/auth/signout" className="db-nav__item db-nav__item--signout">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 7.5H2M5 4.5l-3 3 3 3" />
          <path d="M6 2h7.5v11H6" />
        </svg>
        Sign out
      </a>
    </nav>
  );
}
