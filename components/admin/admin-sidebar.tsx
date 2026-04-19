"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function AdminSidebar() {
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("adm-sidebar-collapsed") === "true");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("adm-sidebar-collapsed", String(next));
      return next;
    });
  }

  function cls(href: string) {
    const active =
      href === "/admin"
        ? path === "/admin"
        : path === href || path.startsWith(href + "/");
    return `adm-nav__item${active ? " adm-nav__item--active" : ""}`;
  }

  return (
    <aside className={`adm-sidebar${collapsed ? " adm-sidebar--collapsed" : ""}`}>
      {/* Brand */}
      <div className="adm-sidebar__brand">
        <a href="/" className="logo" aria-label="Juice for Teams home">
          <span className="logo__mark" aria-hidden="true" />
          <span className="logo__text">Juice for Teams</span>
        </a>
      </div>

      {/* Nav */}
      <nav className="adm-nav" aria-label="CRM navigation">

        {/* Pipeline section */}
        <span className="adm-nav__section">Pipeline</span>

        <a href="/admin/leads" className={cls("/admin/leads")} title="Leads">
          {/* Person with plus — new incoming contact */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="6" cy="4.5" r="2.5" />
            <path d="M1 13c0-2.76 2.24-5 5-5h1" />
            <path d="M11.5 9v5M9 11.5h5" />
          </svg>
          <span>Leads</span>
        </a>

        <a href="/admin/contacts" className={cls("/admin/contacts")} title="Users">
          {/* Address book / person card */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" />
            <circle cx="7.5" cy="6" r="2" />
            <path d="M4 13c0-1.93 1.57-3.5 3.5-3.5S11 11.07 11 13" />
          </svg>
          <span>Users</span>
        </a>

        <a href="/admin/accounts" className={cls("/admin/accounts")} title="Accounts">
          {/* Building / company */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.5" y="4.5" width="12" height="9" rx="1" />
            <path d="M4.5 4.5V3a3 3 0 016 0v1.5" />
            <path d="M5.5 9.5h1M8.5 9.5h1" />
          </svg>
          <span>Accounts</span>
        </a>

        <a href="/admin/opportunities" className={cls("/admin/opportunities")} title="Subscriptions">
          {/* Funnel / pipeline */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 2.5h12l-4.5 5v5l-3-1.5V7.5L1.5 2.5Z" />
          </svg>
          <span>Subscriptions</span>
        </a>

        {/* Marketing section */}
        <span className="adm-nav__section">Marketing</span>

        <a href="/admin/prospects" className={cls("/admin/prospects")} title="Prospects">
          {/* Target / crosshair */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="5.5" />
            <circle cx="7.5" cy="7.5" r="2.5" />
            <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2" />
          </svg>
          <span>Prospects</span>
        </a>

        <a href="/admin/lists" className={cls("/admin/lists")} title="Lists">
          {/* Bullet list */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="2.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
            <path d="M5.5 4.5h8" />
            <circle cx="2.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
            <path d="M5.5 7.5h8" />
            <circle cx="2.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
            <path d="M5.5 10.5h8" />
          </svg>
          <span>Lists</span>
        </a>

        <a href="/admin/campaigns" className={cls("/admin/campaigns")} title="Campaigns">
          {/* Megaphone */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 5.5v4h2l5 3V2.5L4 5.5H2Z" />
            <path d="M12 5a3 3 0 010 5" />
          </svg>
          <span>Campaigns</span>
        </a>

        {/* Comms section */}
        <span className="adm-nav__section">Comms</span>

        <a href="/admin/emails" className={cls("/admin/emails")} title="Emails">
          {/* Envelope */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" />
            <path d="M1.5 5l6 4 6-4" />
          </svg>
          <span>Emails</span>
        </a>

        {/* Data section */}
        <span className="adm-nav__section">Data</span>

        <a href="/admin/reports" className={cls("/admin/reports")} title="Reports">
          {/* Bar chart */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 13.5v-9M5.5 13.5v-6M9.5 13.5V5M13.5 13.5V2" />
            <path d="M1.5 13.5h12" />
          </svg>
          <span>Reports</span>
        </a>

        <a href="/admin/schema" className={cls("/admin/schema")} title="Schema">
          {/* Table / grid */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" />
            <path d="M1 5.5h13M5 5.5v8" />
          </svg>
          <span>Schema</span>
        </a>

        <a href="/admin/billing" className={cls("/admin/billing")} title="Billing">
          {/* Credit card */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" />
            <path d="M1.5 6.5h12" />
            <path d="M4 9.5h2" />
          </svg>
          <span>Billing</span>
        </a>

        <a href="/admin/query" className={cls("/admin/query")} title="AI Query">
          {/* Sparkle / wand */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 1.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
            <path d="M12 8.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" />
            <path d="M2 13l4.5-4.5" />
          </svg>
          <span>AI Query</span>
        </a>

        <div className="adm-nav__spacer" />

        {/* Back to dashboard */}
        <a href="/dashboard" className="adm-nav__item" title="Dashboard">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 5.5L7.5 1L13.5 5.5V13.5H9.5V9.5H5.5V13.5H1.5V5.5Z" />
          </svg>
          <span>Dashboard</span>
        </a>

        {/* Collapse toggle */}
        <button
          type="button"
          className="adm-nav__item adm-nav__toggle-btn"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {collapsed
              ? <path d="M5 2.5l5 5-5 5" />
              : <path d="M10 2.5L5 7.5l5 5" />
            }
          </svg>
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>

        {/* Sign out */}
        <a href="/auth/signout" className="adm-nav__item adm-nav__item--signout" title="Sign out">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 7.5H2M5 4.5l-3 3 3 3" />
            <path d="M6 2h7.5v11H6" />
          </svg>
          <span>Sign out</span>
        </a>

      </nav>
    </aside>
  );
}
