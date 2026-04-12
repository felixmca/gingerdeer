"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(authError ? "Authentication failed. Please try again." : "");
  const [signupDone, setSignupDone] = useState(false);

  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  async function handleGoogleOAuth() {
    setPending(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
    // on success the browser redirects — no further action needed
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      router.push(next);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      setSignupDone(true);
    }
    setPending(false);
  }

  if (signupDone) {
    return (
      <div className="auth-confirm">
        <div className="auth-confirm__icon" aria-hidden />
        <h2 className="auth-confirm__title">Check your email</h2>
        <p className="auth-confirm__body">
          We've sent a confirmation link to <strong>{email}</strong>.
          Click it to activate your account and return here.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="auth-card__title">
        {mode === "login" ? "Sign in to your account" : "Create your account"}
      </h1>
      <p className="auth-card__sub">
        {mode === "login"
          ? "Access your Juice for Teams subscription dashboard."
          : "Set up your Juice for Teams account to manage your subscription."}
      </p>

      <button
        type="button"
        className="btn btn--google"
        onClick={handleGoogleOAuth}
        disabled={pending}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form onSubmit={handleEmailSubmit} noValidate>
        <label className="field">
          <span className="field__label">Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Your password" : "Choose a password (8+ chars)"}
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="funnel__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary auth-submit"
          disabled={pending}
        >
          {pending
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="auth-toggle">
        {mode === "login" ? (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              className="auth-toggle__btn"
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="auth-toggle__btn"
              onClick={() => { setMode("login"); setError(""); }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <a href="/" className="auth-logo" aria-label="Juice for Teams home">
        <span className="logo__mark" aria-hidden="true" />
        <span className="logo__text">Juice for Teams</span>
      </a>
      <div className="auth-card">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
