import { Resend } from "resend";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Juice for Teams <onboarding@resend.dev>";

export interface FullLeadBody {
  ingredients?: string[];
  frequency?: string;
  quantity_tier?: string;
  team_size?: number;
  shots_per_drop?: number;
  bottles_per_drop?: number;
  shots_per_month?: number;
  bottles_per_month?: number;
  price_per_drop_ex_vat?: number;
  price_per_month_ex_vat?: number;
  vat_per_month?: number;
  total_per_month_inc_vat?: number;
}

export async function sendStep1Email(
  client: Resend,
  { to, company }: { to: string; company: string }
) {
  const ctaUrl = `${APP_URL}/auth/login`;
  await client.emails.send({
    from: FROM,
    to,
    subject: "Finish setting up your Juice for Teams subscription",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">You're halfway there, ${company}</h1>
        <p style="color:#57534e">You've started configuring a <strong>Juice for Teams</strong> subscription.
        Finish choosing your blend, delivery frequency, and team size to see your personalised quote.</p>
        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          Finish choosing your subscription →
        </a>
        <p style="font-size:13px;color:#78716c">
          Not ready yet? No worries — your details are saved and you can come back any time.
        </p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}

export async function sendQuoteEmail(
  client: Resend,
  {
    to,
    company,
    body,
  }: { to: string; company: string; body: FullLeadBody }
) {
  const ctaUrl = `${APP_URL}/auth/login`;
  const fmtGBP = (n?: number) =>
    n !== undefined && n !== null ? `£${n.toFixed(2)}` : "—";
  const freqMap: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
  };
  const tierMap: Record<string, string> = {
    light: "Light",
    standard: "Standard",
    generous: "Generous",
  };

  const ingredientLabels = (body.ingredients ?? []).join(", ") || "—";
  const freq = freqMap[body.frequency ?? ""] ?? body.frequency ?? "—";
  const tier = tierMap[body.quantity_tier ?? ""] ?? body.quantity_tier ?? "—";

  await client.emails.send({
    from: FROM,
    to,
    subject: `Your Juice for Teams quote — ${company}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">Your personalised quote</h1>
        <p style="color:#57534e">Hi ${company}, here's a summary of the subscription you configured.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e;width:50%">Blend</td>
            <td style="padding:8px 0;font-weight:600">${ingredientLabels}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Delivery</td>
            <td style="padding:8px 0;font-weight:600">${freq}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Team size</td>
            <td style="padding:8px 0;font-weight:600">${body.team_size ?? "—"} people · ${tier}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Per delivery</td>
            <td style="padding:8px 0;font-weight:600">${body.shots_per_drop ?? 0} shots · ${body.bottles_per_drop ?? 0} bottles</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Per delivery (ex. VAT)</td>
            <td style="padding:8px 0;font-weight:600">${fmtGBP(body.price_per_drop_ex_vat)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Monthly (ex. VAT)</td>
            <td style="padding:8px 0;font-weight:600">${fmtGBP(body.price_per_month_ex_vat)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">VAT (20%)</td>
            <td style="padding:8px 0;font-weight:600">${fmtGBP(body.vat_per_month)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#1c1917;font-weight:700">Total / month (inc. VAT)</td>
            <td style="padding:10px 0;font-weight:700;color:#c2410c;font-size:16px">${fmtGBP(body.total_per_month_inc_vat)}</td>
          </tr>
        </table>

        <p style="color:#57534e;font-size:14px">
          This is an estimate. Final pricing is confirmed before your first delivery.
        </p>

        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          Complete account sign up to confirm →
        </a>

        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}
