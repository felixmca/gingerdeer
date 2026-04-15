import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

function fmtGBP(pence: number) {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const metadata = { title: "Order Confirmed — Juice for Teams" };

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { session_id } = await searchParams;
  if (!session_id) redirect("/dashboard");

  let status      = "unknown";
  let amountTotal = 0;
  let customerEmail: string | null = null;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    status        = session.status ?? "unknown";
    amountTotal   = session.amount_total ?? 0;
    customerEmail = session.customer_details?.email ?? user.email ?? null;
  } catch {
    // session not found or Stripe error — show generic error
    status = "error";
  }

  const success = status === "complete";

  return (
    <div className="adm-page">
      <div className="co-return">
        {success ? (
          <>
            <div className="co-return__icon co-return__icon--success" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2.5 7.5l3.5 3.5 6.5-6.5" />
              </svg>
            </div>
            <h1 className="co-return__heading">You&apos;re all set!</h1>
            <p className="co-return__body">
              Your subscription is confirmed
              {amountTotal > 0 && <> — first payment of <strong>{fmtGBP(amountTotal)}</strong></>}.
              {customerEmail && <> A receipt has been sent to <strong>{customerEmail}</strong>.</>}
            </p>
            <p className="co-return__body">
              Your first delivery will be arranged shortly. You&apos;ll receive a confirmation email with the details.
            </p>
            <div className="co-return__actions">
              <Link href="/dashboard/subscriptions" className="adm-btn adm-btn--primary">
                View subscription
              </Link>
              <Link href="/dashboard" className="adm-btn adm-btn--ghost">
                Go to dashboard
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="co-return__icon co-return__icon--error" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l9 9M12 3l-9 9" />
              </svg>
            </div>
            <h1 className="co-return__heading">Payment incomplete</h1>
            <p className="co-return__body">
              It looks like your payment didn&apos;t go through. No charge has been made.
            </p>
            <div className="co-return__actions">
              <Link href="/dashboard/checkout" className="adm-btn adm-btn--primary">
                Try again
              </Link>
              <Link href="/dashboard" className="adm-btn adm-btn--ghost">
                Go to dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
