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

export async function sendExistingUserLoginPromptEmail(
  client: Resend,
  { to, company }: { to: string; company: string }
) {
  const ctaUrl = `${APP_URL}/auth/login`;
  await client.emails.send({
    from: FROM,
    to,
    subject: "You already have a Juice for Teams account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">Welcome back, ${company}</h1>
        <p style="color:#57534e">
          We noticed you already have a Juice for Teams account linked to this email address.
          Sign in to continue building your subscription from where you left off.
        </p>
        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          Sign in to your account →
        </a>
        <p style="font-size:13px;color:#78716c">
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}

export async function sendSubscriptionCreatedEmail(
  client: Resend,
  {
    to,
    company,
    body,
  }: { to: string; company: string; body: FullLeadBody }
) {
  const ctaUrl = `${APP_URL}/dashboard`;
  const fmtGBP = (n?: number) =>
    n !== undefined && n !== null ? `£${n.toFixed(2)}` : "—";
  const freqMap: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
  };
  const freq = freqMap[body.frequency ?? ""] ?? body.frequency ?? "—";

  await client.emails.send({
    from: FROM,
    to,
    subject: "Your Juice for Teams subscription is confirmed",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">Subscription confirmed!</h1>
        <p style="color:#57534e">
          Great news, ${company}. Your Juice for Teams subscription is now active.
          We'll be in touch shortly to confirm your first delivery date.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e;width:50%">Delivery frequency</td>
            <td style="padding:8px 0;font-weight:600">${freq}</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Team size</td>
            <td style="padding:8px 0;font-weight:600">${body.team_size ?? "—"} people</td>
          </tr>
          <tr style="border-bottom:1px solid #e7e5e4">
            <td style="padding:8px 0;color:#57534e">Monthly (ex. VAT)</td>
            <td style="padding:8px 0;font-weight:600">${fmtGBP(body.price_per_month_ex_vat)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#1c1917;font-weight:700">Total / month (inc. VAT)</td>
            <td style="padding:10px 0;font-weight:700;color:#c2410c;font-size:16px">${fmtGBP(body.total_per_month_inc_vat)}</td>
          </tr>
        </table>

        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          View your dashboard →
        </a>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}

export async function sendLeadFollowUpEmail(
  client: Resend,
  {
    to,
    company,
    dayLabel,
  }: { to: string; company: string; dayLabel: "24h" | "3d" | "7d" }
) {
  const ctaUrl = `${APP_URL}/auth/login`;

  const messages: Record<string, { subject: string; body: string }> = {
    "24h": {
      subject: "Did you get a chance to look at your Juice for Teams quote?",
      body: `Hi ${company}, just checking in — you started configuring a Juice for Teams subscription yesterday.
             Your quote is ready and waiting. Click below to finish signing up and lock in your first delivery.`,
    },
    "3d": {
      subject: "Still thinking about Juice for Teams?",
      body: `Hi ${company}, we noticed you haven't completed your Juice for Teams subscription yet.
             If you have any questions about delivery, pricing, or how it all works, just reply to this email.
             We'd love to help.`,
    },
    "7d": {
      subject: "Your Juice for Teams quote expires soon",
      body: `Hi ${company}, your personalised Juice for Teams quote has been saved for a week now.
             We don't want you to miss out — sign up today and we'll get your first delivery organised within the week.`,
    },
  };

  const { subject, body: bodyText } = messages[dayLabel];

  await client.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">Your quote is still waiting</h1>
        <p style="color:#57534e">${bodyText}</p>
        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          Complete your signup →
        </a>
        <p style="font-size:13px;color:#78716c">
          Not interested? Reply "unsubscribe" and we won't contact you again.
        </p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}

export async function sendPendingSubReminderEmail(
  client: Resend,
  { to, company }: { to: string; company: string }
) {
  const ctaUrl = `${APP_URL}/dashboard`;
  await client.emails.send({
    from: FROM,
    to,
    subject: "Your Juice for Teams subscription is pending — we're on it",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">Your subscription is being set up</h1>
        <p style="color:#57534e">
          Hi ${company}, your Juice for Teams subscription is currently pending confirmation.
          Our team is reviewing your order and will confirm your first delivery date within 1–2 business days.
        </p>
        <p style="color:#57534e">
          In the meantime, you can view your subscription details in your dashboard.
        </p>
        <a href="${ctaUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          View dashboard →
        </a>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
        <p style="font-size:12px;color:#a8a29e">Juice for Teams · B2B ginger juice subscriptions</p>
      </div>
    `,
  });
}

export async function sendPostDeliveryFeedbackEmail(
  client: Resend,
  { to, company }: { to: string; company: string }
) {
  const feedbackUrl = `${APP_URL}/feedback`;
  await client.emails.send({
    from: FROM,
    to,
    subject: "How was your Juice for Teams delivery?",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:22px;margin-bottom:8px">How did we do, ${company}?</h1>
        <p style="color:#57534e">
          Your latest Juice for Teams delivery should have arrived. We'd love to know what you and your team think!
          It only takes 30 seconds and helps us make each delivery better than the last.
        </p>
        <a href="${feedbackUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#c2410c;color:#fff;
                  border-radius:999px;text-decoration:none;font-weight:600">
          Leave feedback →
        </a>
        <p style="font-size:13px;color:#78716c">
          Questions or issues with your delivery? Just reply to this email — we'll sort it out.
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
