import CheckoutWizard from "@/components/checkout/checkout-wizard";

export const metadata = { title: "Checkout — Juice for Teams" };

export default function CheckoutPage() {
  return (
    <div className="adm-page">
      <div className="adm-page__header">
        <div>
          <h1 className="adm-page__title">Start your subscription</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-ink-muted)" }}>
            Configure your juice delivery and complete payment in minutes.
          </p>
        </div>
      </div>
      <CheckoutWizard />
    </div>
  );
}
