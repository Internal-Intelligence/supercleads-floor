import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authEnabled, GROK_PROVIDERS, signIn, signInWithEmail } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SuperCWordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function loginErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  const lower = raw.toLowerCase();
  if (lower.includes("invalid origin") || lower.includes("invalid_origin")) {
    return "This window blocked sign-in. Allow pop-ups and tap Continue with Google again.";
  }
  if (lower.includes("popup") || lower.includes("pop-up")) {
    return "Allow pop-ups for this page, then tap Continue with Google again.";
  }
  return raw || fallback;
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"google" | "x" | "email" | null>(null);
  const [showEmail, setShowEmail] = useState(true);

  if (isPending) {
    return <div className="min-h-dvh bg-bg" />;
  }
  if (user) return <Navigate to="/" />;

  async function onGoogle() {
    setBusy("google");
    setError(null);
    try {
      await signIn("grok-google", { callbackURL: "/" });
    } catch (err) {
      setError(loginErrorMessage(err, "Google sign-in failed"));
      setBusy(null);
    }
  }

  async function onProvider(providerId: string, kind: "google" | "x") {
    setBusy(kind);
    setError(null);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(loginErrorMessage(err, "Sign-in failed"));
      setBusy(null);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    try {
      await signInWithEmail({ email, password, name, mode });
      window.location.href = "/";
    } catch (err) {
      setError(loginErrorMessage(err, "Sign-in failed"));
      setBusy(null);
    }
  }

  const google = GROK_PROVIDERS.find((p) => p.idp === "google");
  const others = GROK_PROVIDERS.filter((p) => p.idp !== "google");

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] text-fg">
      <div className="w-full max-w-sm space-y-8">
        <SuperCWordmark />
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Get on the floor</h1>
          <p className="text-sm text-muted">
            Sign in with Google. Your seat opens on the SuperC board — same account
            every day.
          </p>
        </div>

        {authEnabled ? (
          <div className="space-y-4">
            {google ? (
              <Button
                type="button"
                className="w-full"
                disabled={busy !== null}
                onClick={() => void onGoogle()}
              >
                <GoogleMark />
                {busy === "google" ? "Opening Google…" : "Continue with Google"}
              </Button>
            ) : null}

            {others.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="ink"
                className="w-full"
                disabled={busy !== null}
                onClick={() => void onProvider(p.providerId, "x")}
              >
                Continue with {p.label}
              </Button>
            ))}

            {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

            <div className="flex items-center gap-3 text-[11px] tracking-wide text-subtle uppercase">
              <span className="h-px flex-1 bg-border" />
              Or email
              <span className="h-px flex-1 bg-border" />
            </div>

            {showEmail ? (
              <form className="space-y-3" onSubmit={(e) => void onEmail(e)}>
                {mode === "up" ? (
                  <label className="block space-y-1.5">
                    <Label>Name on the board</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jaydan"
                      autoComplete="name"
                    />
                  </label>
                ) : null}
                <label className="block space-y-1.5">
                  <Label>Work email</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@supercleads.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="ink" className="w-full" disabled={busy !== null}>
                  {mode === "up" ? "Create my seat" : "Sign in with email"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted hover:text-fg"
                  onClick={() => {
                    setMode(mode === "up" ? "in" : "up");
                    setError(null);
                  }}
                >
                  {mode === "up" ? "Already have a password? Sign in" : "Need a password account?"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="w-full text-center text-sm text-muted hover:text-fg"
                onClick={() => setShowEmail(true)}
              >
                Use email and password instead
              </button>
            )}

            <p className="text-center text-xs text-subtle">
              Allow pop-ups once so Google can open. Floor control is
              teamconnect@supercleads.com.
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.12-1.43.36-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
