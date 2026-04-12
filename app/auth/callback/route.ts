import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback
 *
 * Handles Supabase OAuth redirects and email-confirmation links.
 * After exchanging the code for a session it:
 *  1. Links the user's account to any existing lead with the same email.
 *  2. Marks signup_complete = true on that lead.
 *  3. Redirects to /dashboard (or the `next` query param).
 *
 * Setup required in Supabase dashboard:
 *   Authentication → URL Configuration → Redirect URLs → add:
 *   http://localhost:3000/auth/callback  (dev)
 *   https://your-domain.com/auth/callback  (prod)
 *
 * Setup required in Google Cloud Console (for OAuth):
 *   Authorized redirect URIs → add:
 *   https://<your-supabase-project>.supabase.co/auth/v1/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeErr) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // Link any lead with this email to the newly authenticated user
        try {
          const service = createServiceClient();
          await service
            .from("leads")
            .update({ user_id: user.id, signup_complete: true })
            .eq("email", user.email)
            .is("user_id", null);
        } catch (err) {
          // Non-fatal — log and continue to dashboard
          console.error("[/auth/callback] Lead linking error:", err);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to login with an error flag
  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
