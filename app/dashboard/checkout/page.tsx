"use client";

import { useEffect, useState } from "react";
import { OrderLauncher, EmbeddedCheckoutPanel } from "@/components/order-launcher";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutPage() {
  const [ready, setReady]               = useState(false);
  const [loggedIn, setLoggedIn]         = useState(false);
  const [userEmail, setUserEmail]       = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);

  // Preselected values restored from localStorage after auth redirect
  const [preType, setPreType]           = useState<"subscription" | "one_off" | undefined>();
  const [preSlug, setPreSlug]           = useState<string | undefined>();

  useEffect(() => {
    async function init() {
      // 1. Check auth
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authed = !!session;
      setLoggedIn(authed);
      setUserEmail(session?.user?.email ?? "");

      // 2. Direct payment: client secret in sessionStorage (set by OrderLauncher)
      const secret = sessionStorage.getItem("ol_client_secret");
      if (secret) {
        sessionStorage.removeItem("ol_client_secret");
        sessionStorage.removeItem("ol_order_type");
        setClientSecret(secret);
        setReady(true);
        return;
      }

      // 3. Post-auth redirect: pending plan in localStorage
      const raw = localStorage.getItem("ol_pending_plan");
      if (raw) {
        try {
          const plan = JSON.parse(raw) as {
            orderType?: string;
            // New format
            lineItems?: Array<{ productSlug?: string }>;
            // Legacy format
            productSlug?: string;
          };
          localStorage.removeItem("ol_pending_plan");
          setPreType(plan.orderType as "subscription" | "one_off" | undefined);
          // Try new lineItems format first, then legacy productSlug
          const slug = plan.lineItems?.[0]?.productSlug ?? plan.productSlug;
          setPreSlug(slug);
        } catch { /* ignore */ }
      }

      setLauncherOpen(true);
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="adm-page">
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-ink-muted)" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div className="adm-page">
        <div className="adm-page__header">
          <div>
            <h1 className="adm-page__title">Complete payment</h1>
          </div>
        </div>
        <EmbeddedCheckoutPanel
          clientSecret={clientSecret}
          onBack={() => { setClientSecret(null); setLauncherOpen(true); }}
        />
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">New order</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-ink-muted)" }}>
            Subscribe or place a one-off order for your team.
          </p>
        </div>
      </div>

      <OrderLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        preselectedType={preType}
        preselectedProductSlug={preSlug}
        loggedIn={loggedIn}
        userEmail={userEmail}
      />
    </div>
  );
}
